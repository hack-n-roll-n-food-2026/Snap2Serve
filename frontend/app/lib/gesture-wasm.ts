/**
 * TypeScript type definitions for gesture-wasm
 * This file provides types for the Rust WASM module
 */

export interface FrameResult {
  gesture: 'none' | 'six' | 'seven';
  state: 'idle' | 'running' | 'success' | 'failed';
  count: number;
  scored: boolean;
}

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export interface GestureGateWasm {
  new(target: number): GestureGateInstance;
}

export interface GestureGateInstance {
  start(): void;
  reset(): void;
  fail(): void;
  get_count(): number;
  get_state(): string;
  is_unlocked(): boolean;
  is_failed(): boolean;
  is_running(): boolean;
  process_landmarks(landmarks: Landmark[]): FrameResult;
  process_raw(xs: Float32Array, ys: Float32Array): FrameResult;
}

// Module initialization type
export interface GestureWasmModule {
  GestureGate: GestureGateWasm;
}

/**
 * Load the WASM module dynamically
 * This handles the async initialization of the WASM binary
 * Returns null if WASM is not available (fallback to JS implementation)
 */
export async function loadGestureWasm(): Promise<GestureWasmModule | null> {
  try {
    // Dynamic import of the WASM module
    // This path assumes wasm-pack output is in public/wasm
    const wasmModule = await import(
      /* webpackIgnore: true */
      '/wasm/gesture_wasm.js'
    );
    await wasmModule.default(); // Initialize the WASM
    return wasmModule as unknown as GestureWasmModule;
  } catch (error) {
    console.warn('WASM module not available, using JavaScript fallback:', error);
    return null;
  }
}
