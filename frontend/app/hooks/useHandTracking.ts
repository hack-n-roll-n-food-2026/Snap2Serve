/**
 * Custom hook for MediaPipe hand tracking
 * Uses @mediapipe/tasks-vision for hand landmark detection
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// MediaPipe Hands types
interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

interface HandLandmarkerResult {
  landmarks: HandLandmark[][];
  worldLandmarks: HandLandmark[][];
  handedness: { categoryName: string; score: number }[][];
}

interface HandLandmarker {
  detectForVideo(video: HTMLVideoElement, timestamp: number): HandLandmarkerResult;
  close(): void;
}

interface UseHandTrackingOptions {
  onFrame?: (landmarks: HandLandmark[] | null, handedness: string | null, timestamp: number) => void;
  enabled?: boolean;
}

interface UseHandTrackingReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  landmarks: HandLandmark[] | null;
  handedness: string | null;
}

export function useHandTracking(options: UseHandTrackingOptions = {}): UseHandTrackingReturn {
  const { onFrame, enabled = true } = options;
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<HandLandmark[] | null>(null);
  const [handedness, setHandedness] = useState<string | null>(null);

  // Initialize MediaPipe HandLandmarker
  const initHandLandmarker = useCallback(async () => {
    try {
      // Dynamically import MediaPipe to avoid SSR issues
      let vision;
      try {
        vision = await import('@mediapipe/tasks-vision');
      } catch {
        console.warn('MediaPipe not installed. Please run: npm install @mediapipe/tasks-vision');
        setError('MediaPipe not installed. Please run: npm install @mediapipe/tasks-vision');
        return;
      }
      const { HandLandmarker, FilesetResolver } = vision;

      // Load the WASM files
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Create the HandLandmarker
      const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      handLandmarkerRef.current = handLandmarker;
      setIsReady(true);
    } catch (err) {
      console.error('Failed to initialize HandLandmarker:', err);
      setError('Failed to initialize hand tracking. Please try again.');
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Initialize hand landmarker if not done yet
      if (!handLandmarkerRef.current) {
        await initHandLandmarker();
      }

    } catch (err) {
      console.error('Failed to start camera:', err);
      setError('Failed to access camera. Please ensure camera permissions are granted.');
    }
  }, [initHandLandmarker]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setLandmarks(null);
    setHandedness(null);
  }, []);

  // Detection loop
  useEffect(() => {
    if (!enabled || !isReady || !videoRef.current) {
      return;
    }

    let lastTime = -1;

    const detectFrame = () => {
      if (!handLandmarkerRef.current || !videoRef.current) {
        animationFrameRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      const video = videoRef.current;
      const now = performance.now();

      // Only process if video is playing and time has advanced
      if (video.readyState >= 2 && now !== lastTime) {
        lastTime = now;

        try {
          const result = handLandmarkerRef.current.detectForVideo(video, now);
          
          // Get first hand landmarks and handedness if any
          const handLandmarks = result.landmarks.length > 0 ? result.landmarks[0] : null;
          // Note: MediaPipe returns handedness from camera's perspective, so "Left" in result means right hand (mirrored)
          const detectedHandedness = result.handedness.length > 0 ? result.handedness[0][0]?.categoryName : null;
          // Flip handedness since camera is mirrored
          const actualHandedness = detectedHandedness === 'Left' ? 'Right' : detectedHandedness === 'Right' ? 'Left' : null;
          setLandmarks(handLandmarks);
          setHandedness(actualHandedness);

          // Call the onFrame callback
          if (onFrame) {
            onFrame(handLandmarks, actualHandedness, now);
          }

          // Draw landmarks on canvas
          if (canvasRef.current && video.videoWidth && video.videoHeight) {
            drawLandmarks(canvasRef.current, video, handLandmarks);
          }
        } catch (err) {
          console.error('Detection error:', err);
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectFrame);
    };

    detectFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, isReady, onFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    isReady,
    error,
    startCamera,
    stopCamera,
    landmarks,
    handedness
  };
}

// Helper function to draw hand landmarks on canvas
function drawLandmarks(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: HandLandmark[] | null
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Set canvas size to match video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!landmarks) return;

  // Draw connections
  const connections = [
    // Thumb
    [0, 1], [1, 2], [2, 3], [3, 4],
    // Index
    [0, 5], [5, 6], [6, 7], [7, 8],
    // Middle
    [0, 9], [9, 10], [10, 11], [11, 12],
    // Ring
    [0, 13], [13, 14], [14, 15], [15, 16],
    // Pinky
    [0, 17], [17, 18], [18, 19], [19, 20],
    // Palm
    [5, 9], [9, 13], [13, 17]
  ];

  ctx.strokeStyle = '#00FF00';
  ctx.lineWidth = 2;

  for (const [start, end] of connections) {
    const startLm = landmarks[start];
    const endLm = landmarks[end];
    
    ctx.beginPath();
    ctx.moveTo(startLm.x * canvas.width, startLm.y * canvas.height);
    ctx.lineTo(endLm.x * canvas.width, endLm.y * canvas.height);
    ctx.stroke();
  }

  // Draw landmarks
  for (const landmark of landmarks) {
    const x = landmark.x * canvas.width;
    const y = landmark.y * canvas.height;
    
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, 2 * Math.PI);
    ctx.fill();
  }
}
