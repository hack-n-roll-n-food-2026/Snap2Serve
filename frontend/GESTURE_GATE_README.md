# Gesture Gate Feature

A mini-game that blocks certain actions (search / ingredient detection / recipe fetch) until the user completes a hand-gesture challenge inside a popup card modal.

## Overview

The Gesture Gate requires users to perform hand gestures ("6" or "7") captured via their webcam before allowing them to proceed with protected actions like:
- Detecting ingredients from photos
- Finding/recommending recipes

## How It Works

1. When user clicks a protected action (e.g., "Detect Ingredients", "Get Recipes")
2. A modal popup appears with:
   - Live camera feed
   - Hand tracking overlay
   - 30-second countdown timer
   - Progress counter (0/50 gestures)
3. User must perform 50 valid gestures within 30 seconds to "unlock"
4. On success: modal closes and the original action proceeds
5. On failure: user can restart or cancel

## Gesture Definitions

Using MediaPipe's 21 hand landmarks:

### Gesture "6" 🤙
- **Thumb** extended (away from palm)
- **Pinky** extended (pointing up/out)
- **Index, Middle, Ring** folded (curled into palm)

This represents "6" in some hand-counting systems (thumb=5, pinky=1).

### Gesture "7" ✌️
- **Index** extended (pointing up)
- **Middle** extended (pointing up)
- **Thumb, Ring, Pinky** folded

This is the classic "peace sign" or "V" gesture.

## Technical Architecture

### Frontend (React + TypeScript + Next.js)
- `app/components/GestureGateModal.tsx` - Main modal component
- `app/context/GestureGateContext.tsx` - React context for protecting actions
- `app/hooks/useHandTracking.ts` - MediaPipe hand tracking hook
- `app/lib/gesture-wasm.ts` - TypeScript types for WASM module

### Gesture Scoring (Rust → WebAssembly)
- `gesture-wasm/src/lib.rs` - Core gesture detection & state machine
- Compiled to WASM via `wasm-pack`
- Called from TypeScript for performant gesture processing

### Dependencies
- `@mediapipe/tasks-vision` - Hand landmark detection
- `wasm-pack` - Rust → WASM compilation (build tool)

## Setup Instructions

### 1. Install JavaScript Dependencies

```bash
cd frontend
npm install
```

### 2. Build the WASM Module (Optional)

If you want to use the Rust WASM module for gesture scoring:

**Prerequisites:**
- [Rust](https://rustup.rs/) installed
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) installed

```bash
# Install wasm-pack if not already installed
cargo install wasm-pack

# Build the WASM module
cd frontend/gesture-wasm
wasm-pack build --target bundler --out-dir ../public/wasm
```

**Note:** The feature includes a JavaScript fallback, so the WASM build is optional for basic functionality.

### 3. Run the Development Server

```bash
cd frontend
npm run dev
```

## Configuration

The GestureGateProvider in `app/layout.tsx` accepts these props:

| Prop | Default | Description |
|------|---------|-------------|
| `targetCount` | 50 | Number of gestures required to unlock |
| `timeLimit` | 30 | Seconds allowed per attempt |
| `enabled` | true | Whether the gate is active |

Example:
```tsx
<GestureGateProvider targetCount={25} timeLimit={60} enabled={true}>
  {children}
</GestureGateProvider>
```

## Usage in Components

```tsx
import { useGestureGate } from '../context/GestureGateContext';

function MyComponent() {
  const { protectAction, isGateActive } = useGestureGate();

  const handleClick = async () => {
    try {
      await protectAction(async () => {
        // This code only runs after user passes the gesture gate
        await fetchData();
      });
    } catch (e) {
      if (e.message === "Gesture gate cancelled") {
        // User cancelled
        return;
      }
      // Handle other errors
    }
  };

  return <button onClick={handleClick}>Protected Action</button>;
}
```

## File Structure

```
frontend/
├── app/
│   ├── components/
│   │   └── GestureGateModal.tsx    # Modal UI component
│   ├── context/
│   │   └── GestureGateContext.tsx  # React context provider
│   ├── hooks/
│   │   └── useHandTracking.ts      # MediaPipe hook
│   ├── lib/
│   │   └── gesture-wasm.ts         # WASM types
│   ├── layout.tsx                   # Includes GestureGateProvider
│   └── globals.css                  # Animation keyframes
├── gesture-wasm/
│   ├── Cargo.toml                   # Rust project config
│   ├── src/
│   │   └── lib.rs                   # Rust gesture logic
│   └── build.ps1                    # Build script
└── public/
    └── wasm/                        # Compiled WASM output (gitignored)
```

## Browser Support

Requires:
- WebRTC (camera access)
- WebAssembly
- Modern browser (Chrome, Firefox, Safari, Edge)

## Troubleshooting

### Camera not working
- Ensure camera permissions are granted
- Check if another app is using the camera
- Try a different browser

### Gestures not detected
- Ensure good lighting
- Keep hand fully visible in frame
- Hold gestures steady for ~0.5 seconds
- Try moving hand closer to camera

### WASM not loading
- The JavaScript fallback will be used automatically
- To debug WASM: check browser console for errors
- Ensure WASM was built with correct target (`--target bundler`)
