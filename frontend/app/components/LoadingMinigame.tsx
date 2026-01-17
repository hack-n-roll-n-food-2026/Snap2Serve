"use client";

import React, { useEffect, useRef, useState } from "react";
import { createEmoteDetector } from "@/lib/EmoteDetector";

type Props = {
  durationMs?: number;
  onDone?: (score: number) => void;
  mock?: boolean;
};

export default function LoadingMinigame({ durationMs = 30000, onDone, mock = true }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [count, setCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(durationMs / 1000);
  const handleRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let timer: any;
    let countRef = { val: 0 };
    (async () => {
      const detector = createEmoteDetector();
      const handle = await detector.start(videoRef.current!, { mock, debounceMs: 300 });
      handleRef.current = handle;
      handle.onDetected(() => {
        countRef.val += 1;
        setCount(countRef.val);
      });
      // Update timer every 50ms for smooth countdown
      timer = setInterval(() => {
        setTimeLeft((t) => (t > 0 ? Math.max(0, t - 0.05) : 0));
      }, 50);
      // Wait full duration, then call onDone
      await new Promise(resolve => setTimeout(resolve, durationMs));
      onDone?.(countRef.val);
    })();
    return () => {
      clearInterval(timer);
      try { handleRef.current?.stop(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={S.overlay}>
      <div style={S.panel}>
        <div style={S.head}>Six–Seven Minigame</div>
        <div style={{ display: "flex", gap: 14 }}>
          <div>
            <div style={S.label}>Time</div>
            <div style={S.value}>{Math.ceil(timeLeft)}s</div>
          </div>
          <div>
            <div style={S.label}>Score</div>
            <div style={S.value}>{count}</div>
          </div>
        </div>
        <video ref={videoRef} playsInline muted style={S.video} />
        <div style={S.hint}>Show the six–seven emote to increase your score while we load…</div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "grid", placeItems: "center", zIndex: 1000 },
  panel: { width: 480, background: "#fff", color: "#0f172a", borderRadius: 16, padding: 16, boxShadow: "0 20px 60px rgba(0,0,0,.45)" },
  head: { fontSize: 18, fontWeight: 950, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: 700, opacity: 0.7 },
  value: { fontSize: 26, fontWeight: 950 },
  video: { marginTop: 12, width: "100%", borderRadius: 12, border: "1px solid #ddd" },
  hint: { marginTop: 10, fontSize: 12, opacity: 0.75 },
};
