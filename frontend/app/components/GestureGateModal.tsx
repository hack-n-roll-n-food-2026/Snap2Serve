/**
 * GestureGateModal Component
 * 
 * A modal overlay that requires the user to complete a hand gesture challenge
 * before allowing them to proceed with a protected action.
 * 
 * Gesture Definitions:
 * - "6": Thumb + Pinky extended, Index + Middle + Ring folded
 * - "7": Index + Middle extended (peace sign), others folded
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useHandTracking } from '../hooks/useHandTracking';

// Fallback JavaScript gesture detection (used if WASM fails to load)
interface Landmark {
  x: number;
  y: number;
  z?: number;
}

type GateState = 'idle' | 'running' | 'success' | 'failed';

interface GestureGateModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  targetCount?: number;
  timeLimit?: number;
}

// JavaScript fallback for gesture detection
function detectGestureJS(landmarks: Landmark[] | null): 'none' | 'six' | 'seven' {
  if (!landmarks || landmarks.length < 21) return 'none';

  // Check finger extension
  const isFingerExtended = (tipIdx: number, pipIdx: number) => {
    return landmarks[tipIdx].y < landmarks[pipIdx].y - 0.02;
  };

  // Thumb uses distance from MCP
  const isThumbExtended = () => {
    const tip = landmarks[4];
    const ip = landmarks[3];
    const mcp = landmarks[2];
    const tipToMcp = Math.sqrt(Math.pow(tip.x - mcp.x, 2) + Math.pow(tip.y - mcp.y, 2));
    const ipToMcp = Math.sqrt(Math.pow(ip.x - mcp.x, 2) + Math.pow(ip.y - mcp.y, 2));
    return tipToMcp > ipToMcp * 1.1;
  };

  const thumb = isThumbExtended();
  const index = isFingerExtended(8, 6);
  const middle = isFingerExtended(12, 10);
  const ring = isFingerExtended(16, 14);
  const pinky = isFingerExtended(20, 18);

  // "6": Thumb + Pinky extended, others folded
  if (thumb && pinky && !index && !middle && !ring) {
    return 'six';
  }

  // "7": Index + Middle extended (peace sign), others folded
  if (index && middle && !thumb && !ring && !pinky) {
    return 'seven';
  }

  return 'none';
}

export default function GestureGateModal({
  isOpen,
  onSuccess,
  onCancel,
  targetCount = 50,
  timeLimit = 30
}: GestureGateModalProps) {
  const [gateState, setGateState] = useState<GateState>('idle');
  const [count, setCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [currentGesture, setCurrentGesture] = useState<'none' | 'six' | 'seven'>('none');
  const [lastScored, setLastScored] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Press Start to begin');
  
  // For debouncing gesture detection
  const canScoreRef = useRef(true);
  const stableCountRef = useRef(0);
  const pendingGestureRef = useRef<'none' | 'six' | 'seven'>('none');
  const STABLE_FRAMES = 3;

  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Hand tracking
  const {
    videoRef,
    canvasRef,
    isReady,
    error: trackingError,
    startCamera,
    stopCamera,
    landmarks
  } = useHandTracking({
    enabled: isOpen && gateState === 'running',
    onFrame: useCallback((lm: Landmark[] | null) => {
      if (gateState !== 'running') return;

      const gesture = detectGestureJS(lm);
      setCurrentGesture(gesture);

      // Stability tracking
      if (gesture === pendingGestureRef.current && gesture !== 'none') {
        stableCountRef.current++;
      } else {
        pendingGestureRef.current = gesture;
        stableCountRef.current = gesture !== 'none' ? 1 : 0;
      }

      // Score if stable and can score
      if (stableCountRef.current >= STABLE_FRAMES && gesture !== 'none' && canScoreRef.current) {
        setCount(prev => {
          const newCount = prev + 1;
          if (newCount >= targetCount) {
            setGateState('success');
            setStatusMessage('Success! Gate unlocked!');
          }
          return newCount;
        });
        setLastScored(true);
        canScoreRef.current = false;
        setTimeout(() => setLastScored(false), 200);
      }

      // Reset scoring when returning to 'none'
      if (gesture === 'none') {
        canScoreRef.current = true;
      }
    }, [gateState, targetCount])
  });

  // Start the challenge
  const handleStart = useCallback(async () => {
    setGateState('running');
    setCount(0);
    setTimeRemaining(timeLimit);
    canScoreRef.current = true;
    stableCountRef.current = 0;
    pendingGestureRef.current = 'none';
    setStatusMessage('Show 6 ✋ or 7 ✌️ to score!');
    
    await startCamera();
  }, [startCamera, timeLimit]);

  // Reset/restart the challenge
  const handleRestart = useCallback(() => {
    setGateState('idle');
    setCount(0);
    setTimeRemaining(timeLimit);
    canScoreRef.current = true;
    stableCountRef.current = 0;
    pendingGestureRef.current = 'none';
    setCurrentGesture('none');
    setStatusMessage('Press Start to begin');
    stopCamera();
  }, [stopCamera, timeLimit]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    stopCamera();
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setGateState('idle');
    setCount(0);
    setTimeRemaining(timeLimit);
    onCancel();
  }, [stopCamera, timeLimit, onCancel]);

  // Timer countdown
  useEffect(() => {
    if (gateState === 'running') {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setGateState('failed');
            setStatusMessage('Time\'s up! Press Restart to try again.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [gateState]);

  // Handle success
  useEffect(() => {
    if (gateState === 'success') {
      stopCamera();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Small delay before closing for feedback
      const timeout = setTimeout(() => {
        onSuccess();
        setGateState('idle');
        setCount(0);
        setTimeRemaining(timeLimit);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [gateState, onSuccess, stopCamera, timeLimit]);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setGateState('idle');
      setCount(0);
      setTimeRemaining(timeLimit);
    }
  }, [isOpen, stopCamera, timeLimit]);

  if (!isOpen) return null;

  const progress = (count / targetCount) * 100;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>🖐️ Gesture Gate</h2>
          <p style={styles.subtitle}>Complete the hand gesture challenge to continue</p>
        </div>

        {/* Video container */}
        <div style={styles.videoContainer}>
          <video
            ref={videoRef}
            style={styles.video}
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            style={styles.canvas}
          />
          
          {/* Overlay for idle state */}
          {gateState === 'idle' && (
            <div style={styles.videoOverlay}>
              <div style={styles.gestureDemos}>
                <div style={styles.gestureDemo}>
                  <span style={styles.gestureEmoji}>🤙</span>
                  <span style={styles.gestureLabel}>Show "6"</span>
                  <span style={styles.gestureDesc}>Thumb + Pinky extended</span>
                </div>
                <div style={styles.gestureDemo}>
                  <span style={styles.gestureEmoji}>✌️</span>
                  <span style={styles.gestureLabel}>Show "7"</span>
                  <span style={styles.gestureDesc}>Index + Middle extended</span>
                </div>
              </div>
            </div>
          )}

          {/* Success overlay */}
          {gateState === 'success' && (
            <div style={styles.successOverlay}>
              <span style={styles.successIcon}>✅</span>
              <span style={styles.successText}>Unlocked!</span>
            </div>
          )}

          {/* Failed overlay */}
          {gateState === 'failed' && (
            <div style={styles.failedOverlay}>
              <span style={styles.failedIcon}>❌</span>
              <span style={styles.failedText}>Time's up!</span>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={styles.statsRow}>
          {/* Timer */}
          <div style={styles.stat}>
            <span style={styles.statLabel}>Time</span>
            <span style={{
              ...styles.statValue,
              color: timeRemaining <= 10 ? '#ef4444' : '#fff'
            }}>
              {timeRemaining}s
            </span>
          </div>

          {/* Current gesture */}
          <div style={styles.stat}>
            <span style={styles.statLabel}>Gesture</span>
            <span style={{
              ...styles.statValue,
              color: currentGesture !== 'none' ? '#22c55e' : '#6b7280'
            }}>
              {currentGesture === 'six' ? '6 🤙' : currentGesture === 'seven' ? '7 ✌️' : '—'}
            </span>
          </div>

          {/* Count */}
          <div style={styles.stat}>
            <span style={styles.statLabel}>Score</span>
            <span style={{
              ...styles.statValue,
              color: lastScored ? '#22c55e' : '#fff',
              transform: lastScored ? 'scale(1.2)' : 'scale(1)',
              transition: 'all 0.1s ease'
            }}>
              {count}/{targetCount}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${progress}%`,
                backgroundColor: gateState === 'success' ? '#22c55e' : gateState === 'failed' ? '#ef4444' : '#D7B26A'
              }}
            />
          </div>
        </div>

        {/* Status message */}
        <div style={styles.statusMessage}>{statusMessage}</div>

        {/* Error message */}
        {trackingError && (
          <div style={styles.errorMessage}>{trackingError}</div>
        )}

        {/* Action buttons */}
        <div style={styles.buttonRow}>
          {gateState === 'idle' && (
            <button onClick={handleStart} style={styles.startButton}>
              Start Challenge
            </button>
          )}
          
          {(gateState === 'running' || gateState === 'failed') && (
            <button onClick={handleRestart} style={styles.restartButton}>
              {gateState === 'failed' ? 'Restart' : 'Reset'}
            </button>
          )}

          <button onClick={handleCancel} style={styles.cancelButton}>
            Cancel
          </button>
        </div>

        {/* Loading indicator */}
        {gateState === 'running' && !isReady && (
          <div style={styles.loadingOverlay}>
            <div style={styles.spinner} />
            <span>Initializing camera...</span>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(8px)'
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 24,
    maxWidth: 500,
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  header: {
    textAlign: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 28,
    fontWeight: 900,
    color: '#fff',
    margin: 0,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    margin: 0
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4/3',
    backgroundColor: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)' // Mirror for selfie view
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    transform: 'scaleX(-1)', // Mirror to match video
    pointerEvents: 'none'
  },
  videoOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  gestureDemos: {
    display: 'flex',
    gap: 32,
    padding: 20
  },
  gestureDemo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8
  },
  gestureEmoji: {
    fontSize: 48
  },
  gestureLabel: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff'
  },
  gestureDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center'
  },
  successOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16
  },
  successIcon: {
    fontSize: 64
  },
  successText: {
    fontSize: 32,
    fontWeight: 900,
    color: '#fff'
  },
  failedOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16
  },
  failedIcon: {
    fontSize: 64
  },
  failedText: {
    fontSize: 32,
    fontWeight: 900,
    color: '#fff'
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-around',
    marginBottom: 16
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  statValue: {
    fontSize: 24,
    fontWeight: 900,
    color: '#fff'
  },
  progressContainer: {
    marginBottom: 16
  },
  progressBar: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    transition: 'width 0.2s ease, background-color 0.3s ease'
  },
  statusMessage: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 20
  },
  errorMessage: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center'
  },
  buttonRow: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center'
  },
  startButton: {
    padding: '14px 32px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: '#D7B26A',
    color: '#111',
    fontSize: 16,
    fontWeight: 900,
    cursor: 'pointer',
    transition: 'transform 0.1s ease, box-shadow 0.1s ease'
  },
  restartButton: {
    padding: '14px 24px',
    borderRadius: 12,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer'
  },
  cancelButton: {
    padding: '14px 24px',
    borderRadius: 12,
    border: '1px solid rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer'
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    color: '#fff',
    fontSize: 14
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid rgba(255, 255, 255, 0.2)',
    borderTopColor: '#D7B26A',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
};
