/**
 * GestureGate Context Provider
 * 
 * Provides a global context for the Gesture Gate feature.
 * Wraps protected actions and shows the modal when needed.
 */

'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import GestureGateModal from '../components/GestureGateModal';

interface GestureGateContextValue {
  /**
   * Wrap an action that should be protected by the gesture gate.
   * Returns a promise that resolves when the gate is passed.
   */
  protectAction: <T>(action: () => Promise<T> | T) => Promise<T>;
  
  /**
   * Check if the gesture gate is currently active
   */
  isGateActive: boolean;
  
  /**
   * Bypass the gate (for testing/debug purposes)
   */
  bypassGate: () => void;
}

const GestureGateContext = createContext<GestureGateContextValue | null>(null);

export function useGestureGate() {
  const context = useContext(GestureGateContext);
  if (!context) {
    throw new Error('useGestureGate must be used within a GestureGateProvider');
  }
  return context;
}

interface GestureGateProviderProps {
  children: ReactNode;
  /**
   * Target gesture count required to pass (default: 50)
   */
  targetCount?: number;
  /**
   * Time limit in seconds (default: 30)
   */
  timeLimit?: number;
  /**
   * Whether the gate is enabled (default: true)
   */
  enabled?: boolean;
}

export function GestureGateProvider({
  children,
  targetCount = 50,
  timeLimit = 30,
  enabled = true
}: GestureGateProviderProps) {
  const [isGateActive, setIsGateActive] = useState(false);
  const pendingActionRef = useRef<{
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    action: () => Promise<unknown> | unknown;
  } | null>(null);

  const protectAction = useCallback(<T,>(action: () => Promise<T> | T): Promise<T> => {
    // If gate is disabled, just run the action
    if (!enabled) {
      return Promise.resolve(action());
    }

    return new Promise((resolve, reject) => {
      pendingActionRef.current = {
        resolve: resolve as (value: unknown) => void,
        reject,
        action
      };
      setIsGateActive(true);
    });
  }, [enabled]);

  const handleSuccess = useCallback(async () => {
    if (pendingActionRef.current) {
      const { resolve, action } = pendingActionRef.current;
      try {
        const result = await action();
        resolve(result);
      } catch (error) {
        pendingActionRef.current.reject(error as Error);
      }
    }
    pendingActionRef.current = null;
    setIsGateActive(false);
  }, []);

  const handleCancel = useCallback(() => {
    if (pendingActionRef.current) {
      pendingActionRef.current.reject(new Error('Gesture gate cancelled'));
    }
    pendingActionRef.current = null;
    setIsGateActive(false);
  }, []);

  const bypassGate = useCallback(() => {
    handleSuccess();
  }, [handleSuccess]);

  const contextValue: GestureGateContextValue = {
    protectAction,
    isGateActive,
    bypassGate
  };

  return (
    <GestureGateContext.Provider value={contextValue}>
      {children}
      <GestureGateModal
        isOpen={isGateActive}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        targetCount={targetCount}
        timeLimit={timeLimit}
      />
    </GestureGateContext.Provider>
  );
}
