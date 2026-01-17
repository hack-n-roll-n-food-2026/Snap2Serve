"use client";

// MediaPipe will be loaded dynamically to avoid SSR issues
let Hands: any = null;
let Camera: any = null;

async function loadMediaPipe() {
  if (Hands && Camera) return;
  const handsModule = await import("@mediapipe/hands");
  const cameraModule = await import("@mediapipe/camera_utils");
  Hands = handsModule.Hands;
  Camera = cameraModule.Camera;
}

export type DetectorHandle = {
  onDetected: (cb: () => void) => void;
  stop: () => void;
};

export type DetectorOptions = {
  mock?: boolean;
  debounceMs?: number;
};

// Gesture spec constants
const THRESHOLDS = {
  ampThresh: 0.12, // proportion of frame height
  vThresh: 0.35, // normalized velocity per second
  stillThresh: 0.1,
  tUpMax: 0.5, // seconds
  windowSize: 2.5, // seconds
  overlapThresh: 0.3, // 30% overlap tolerance
  landmarkTimeout: 300, // ms
  confidenceThresh: 0.7,
  emaAlpha: 0.4,
};

type HandState = {
  yNorm: number; // normalized y position [0, 1]
  yEma: number;
  vY: number; // velocity
  lastUpdate: number;
  confidence: number;
};

type GestureState = "Idle" | "LeftUp" | "RightUp";

export function createEmoteDetector() {
  let lastHit = 0;
  let cb: (() => void) | null = null;
  let stopped = true;
  let cleanupFns: Array<() => void> = [];

  function emit(opts: DetectorOptions) {
    const now = Date.now();
    const gap = opts.debounceMs ?? 700;
    if (now - lastHit >= gap) {
      lastHit = now;
      cb && cb();
    }
  }

  async function start(
    videoEl: HTMLVideoElement,
    opts: DetectorOptions = {}
  ): Promise<DetectorHandle> {
    stopped = false;

    // Request webcam
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      cleanupFns.push(() => {
        stream.getTracks().forEach((t) => t.stop());
      });
    } catch (err) {
      console.error("Camera permission error:", err);
      if (!opts.mock) throw err;
    }

    // Mock mode
    if (opts.mock) {
      const keyHandler = (e: KeyboardEvent) => {
        if (e.code === "Space") emit(opts);
      };
      window.addEventListener("keydown", keyHandler);
      cleanupFns.push(() => window.removeEventListener("keydown", keyHandler));

      const interval = setInterval(() => emit(opts), 2000);
      cleanupFns.push(() => clearInterval(interval));
    } else {
      // Real MediaPipe Hands detection
      await loadMediaPipe();

      const hands = new Hands({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // Hand state tracking
      const handState: { [key: string]: HandState } = {
        Left: { yNorm: 0.5, yEma: 0.5, vY: 0, lastUpdate: Date.now(), confidence: 0 },
        Right: { yNorm: 0.5, yEma: 0.5, vY: 0, lastUpdate: Date.now(), confidence: 0 },
      };

      // Gesture cycle tracking
      let gestureState: GestureState = "Idle";
      let cycleCount = 0;
      let cycleStart = Date.now();
      let leftUpWindow = { start: 0, end: 0 };
      let rightUpWindow = { start: 0, end: 0 };

      hands.onResults((results: any) => {
        if (stopped) return;

        const now = Date.now();

        // Reset if no hands detected for too long
        if (results.landmarks.length === 0) {
          const timeSinceLeft = now - handState.Left.lastUpdate;
          const timeSinceRight = now - handState.Right.lastUpdate;
          if (timeSinceLeft > THRESHOLDS.landmarkTimeout) handState.Left.confidence = 0;
          if (timeSinceRight > THRESHOLDS.landmarkTimeout) handState.Right.confidence = 0;
          return;
        }

        // Process each detected hand
        for (let i = 0; i < results.landmarks.length; i++) {
          const landmarks = results.landmarks[i];
          const handedness = results.handedness[i]?.label || "Unknown";
          const key = handedness === "Left" ? "Left" : "Right";

          // Extract center y from wrist + MCPs
          const wrist = landmarks[0];
          const mcps = [landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
          const allY = [wrist.y, ...mcps.map((m) => m.y)];
          const centerY = allY.reduce((a, b) => a + b, 0) / allY.length;

          // Normalize to video height
          const yNorm = centerY;

          // Apply EMA smoothing
          const prevYEma = handState[key].yEma;
          const yEma = THRESHOLDS.emaAlpha * yNorm + (1 - THRESHOLDS.emaAlpha) * prevYEma;

          // Compute velocity (approx)
          const dt = Math.max(1, now - handState[key].lastUpdate) / 1000;
          const vY = dt > 0 ? (yEma - prevYEma) / dt : 0;

          // Update state
          handState[key].yNorm = yNorm;
          handState[key].yEma = yEma;
          handState[key].vY = vY;
          handState[key].lastUpdate = now;
          handState[key].confidence = results.multiHandedness[i]?.score || 0.8;
        }

        // Process gesture logic
        processGesture(handState, now, opts);
      });

      function processGesture(state: { [key: string]: HandState }, now: number, opts: DetectorOptions) {
        const left = state.Left;
        const right = state.Right;

        // Check confidence
        if (left.confidence < THRESHOLDS.confidenceThresh) {
          left.vY = 0;
          left.confidence = 0;
        }
        if (right.confidence < THRESHOLDS.confidenceThresh) {
          right.vY = 0;
          right.confidence = 0;
        }

        // Detect up events (peak when velocity crosses zero from negative)
        const detectUp = (hand: HandState): boolean => {
          return (
            hand.vY >= -THRESHOLDS.vThresh &&
            hand.vY <= 0 &&
            hand.confidence >= THRESHOLDS.confidenceThresh
          );
        };

        const leftUp = detectUp(left);
        const rightUp = detectUp(right);

        // Check for alternation
        if (leftUp && gestureState !== "LeftUp") {
          // Only count if right is still or was recently moving
          if (right.confidence < THRESHOLDS.confidenceThresh || right.vY <= THRESHOLDS.stillThresh) {
            leftUpWindow = { start: now, end: now + THRESHOLDS.tUpMax * 1000 };
            if (gestureState === "RightUp") {
              cycleCount++;
              if (cycleCount >= 2 && now - cycleStart <= THRESHOLDS.windowSize * 1000) {
                emit(opts);
                cycleCount = 0;
                gestureState = "Idle";
                cycleStart = now;
              } else {
                gestureState = "LeftUp";
              }
            } else {
              gestureState = "LeftUp";
              if (cycleCount === 0) cycleStart = now;
            }
          }
        } else if (rightUp && gestureState !== "RightUp") {
          if (left.confidence < THRESHOLDS.confidenceThresh || left.vY <= THRESHOLDS.stillThresh) {
            rightUpWindow = { start: now, end: now + THRESHOLDS.tUpMax * 1000 };
            if (gestureState === "LeftUp") {
              cycleCount++;
              if (cycleCount >= 2 && now - cycleStart <= THRESHOLDS.windowSize * 1000) {
                emit(opts);
                cycleCount = 0;
                gestureState = "Idle";
                cycleStart = now;
              } else {
                gestureState = "RightUp";
              }
            } else {
              gestureState = "RightUp";
              if (cycleCount === 0) cycleStart = now;
            }
          }
        }

        // Reset if window exceeded
        if (now - cycleStart > THRESHOLDS.windowSize * 1000) {
          cycleCount = 0;
          gestureState = "Idle";
        }
      }

      // Camera setup for MediaPipe
      if (Camera && videoEl.videoWidth > 0) {
        const camera = new Camera(videoEl, {
          onFrame: async () => {
            await hands.send({ image: videoEl });
          },
          width: videoEl.videoWidth,
          height: videoEl.videoHeight,
        });

        camera.start();
        cleanupFns.push(() => {
          camera.stop();
          hands.close();
        });
      }
    }

    return {
      onDetected: (fn: () => void) => {
        cb = fn;
      },
      stop: () => {
        stopped = true;
        cleanupFns.forEach((f) => f());
        cleanupFns = [];
      },
    };
  }

  return { start };
}
