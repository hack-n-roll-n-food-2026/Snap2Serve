"use client";

import React, { useEffect, useRef, useState } from "react";
import { createEmoteDetector } from "@/lib/EmoteDetector";
import Link from "next/link";

export default function MinigamePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const detectorRef = useRef<ReturnType<typeof createEmoteDetector> | null>(null);
  const handleRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let timer: any;
    if (running) {
      timer = setInterval(() => {
        setTimeLeft((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    }
    return () => timer && clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (timeLeft === 0 && running) {
      stop();
    }
  }, [timeLeft, running]);

  async function start(mock = false) {
    setError(null);
    setCount(0);
    setTimeLeft(60);
    setRunning(true);
    try {
      const detector = createEmoteDetector();
      detectorRef.current = detector;
      const handle = await detector.start(videoRef.current!, { mock, debounceMs: 700 });
      handleRef.current = handle;
      handle.onDetected(() => setCount((c) => c + 1));
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Unable to start camera");
      setRunning(false);
    }
  }

  function stop() {
    setRunning(false);
    try { handleRef.current?.stop(); } catch {}
  }

  return (
    <div style={S.page}>
      <div style={S.topbar}>
        <Link href="/" style={S.back}>← Back</Link>
        <div style={{ fontWeight: 900 }}>Six–Seven Minigame</div>
        <div style={{ width: 80 }} />
      </div>

      <div style={S.container}>
        <div style={S.card}>
          <div style={S.row}>
            <div>
              <div style={S.heading}>Time Left</div>
              <div style={S.value}>{timeLeft}s</div>
            </div>
            <div>
              <div style={S.heading}>Count</div>
              <div style={S.value}>{count}</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <video ref={videoRef} playsInline muted style={S.video} />
          </div>

          {error && <div style={S.error}>{error}</div>}

          <div style={S.actions}>
            {!running ? (
              <>
                <button style={S.primary} onClick={() => start(false)}>Start (Camera)</button>
                <button style={S.secondary} onClick={() => start(true)}>Start (Mock)</button>
              </>
            ) : (
              <button style={S.stop} onClick={stop}>Stop</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0b0f14", color: "#fff" },
  topbar: { display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.08)" },
  back: { color: "rgba(255,255,255,.85)", textDecoration: "none", border: "1px solid rgba(255,255,255,.12)", padding: "6px 10px", borderRadius: 10 },
  container: { maxWidth: 820, margin: "0 auto", padding: 18 },
  card: { background: "rgba(255,255,255,.94)", color: "#0f172a", borderRadius: 18, padding: 18 },
  row: { display: "flex", gap: 24 },
  heading: { fontSize: 12, fontWeight: 800, opacity: 0.7 },
  value: { fontSize: 28, fontWeight: 950 },
  video: { width: "100%", borderRadius: 12, border: "1px solid rgba(0,0,0,.12)" },
  actions: { marginTop: 16, display: "flex", gap: 10 },
  primary: { padding: "10px 12px", borderRadius: 12, border: "none", background: "#22c55e", color: "#fff", fontWeight: 900, cursor: "pointer" },
  secondary: { padding: "10px 12px", borderRadius: 12, border: "1px solid #ccc", background: "#fff", color: "#333", fontWeight: 900, cursor: "pointer" },
  stop: { padding: "10px 12px", borderRadius: 12, border: "none", background: "#ef4444", color: "#fff", fontWeight: 900, cursor: "pointer" },
  error: { marginTop: 10, color: "#b91c1c", background: "rgba(239,68,68,.12)", padding: 8, borderRadius: 8 },
};
