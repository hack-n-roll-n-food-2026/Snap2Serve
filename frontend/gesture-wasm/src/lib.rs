//! Gesture Gate WASM Module
//! 
//! This module provides gesture recognition and state machine logic for the
//! Snap2Serve "Gesture Gate" feature. It processes MediaPipe hand landmarks
//! to detect "6" and "7" gestures.
//!
//! ## Gesture Definitions (using MediaPipe 21 landmarks):
//! 
//! Finger extended detection uses tip-to-PIP comparison along y-axis.
//! 
//! Gesture "6": Left hand open palm facing upward (all fingers extended, wrist below fingers)
//! Gesture "7": Right hand open palm facing upward (all fingers extended, wrist below fingers)

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

/// Represents a single 2D/3D landmark point from MediaPipe
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Landmark {
    pub x: f32,
    pub y: f32,
    #[serde(default)]
    pub z: f32,
}

/// State of the gesture gate attempt
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum GateState {
    /// Waiting to start
    Idle,
    /// Currently running, counting gestures
    Running,
    /// Successfully reached target count
    Success,
    /// Time ran out before reaching target
    Failed,
}

impl GateState {
    fn as_str(&self) -> &'static str {
        match self {
            GateState::Idle => "idle",
            GateState::Running => "running",
            GateState::Success => "success",
            GateState::Failed => "failed",
        }
    }
}

/// Detected gesture type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum GestureType {
    None,
    Six,
    Seven,
}

impl GestureType {
    fn as_str(&self) -> &'static str {
        match self {
            GestureType::None => "none",
            GestureType::Six => "six",
            GestureType::Seven => "seven",
        }
    }
}

/// Result of processing a frame
#[derive(Debug, Serialize)]
pub struct FrameResult {
    pub gesture: String,
    pub state: String,
    pub count: u32,
    pub scored: bool,
}

/// The main gesture gate state machine
#[wasm_bindgen]
pub struct GestureGate {
    state: GateState,
    count: u32,
    target: u32,
    last_gesture: GestureType,
    /// Debounce: require gesture to change before counting again
    can_score: bool,
    /// Minimum consecutive frames for a gesture to be considered stable
    stable_frames: u32,
    current_stable_count: u32,
    pending_gesture: GestureType,
}

#[wasm_bindgen]
impl GestureGate {
    /// Create a new GestureGate with the specified target count
    #[wasm_bindgen(constructor)]
    pub fn new(target: u32) -> GestureGate {
        GestureGate {
            state: GateState::Idle,
            count: 0,
            target,
            last_gesture: GestureType::None,
            can_score: true,
            stable_frames: 3, // Require 3 consecutive frames
            current_stable_count: 0,
            pending_gesture: GestureType::None,
        }
    }

    /// Start the attempt
    #[wasm_bindgen]
    pub fn start(&mut self) {
        self.state = GateState::Running;
        self.count = 0;
        self.last_gesture = GestureType::None;
        self.can_score = true;
        self.current_stable_count = 0;
        self.pending_gesture = GestureType::None;
    }

    /// Reset the gate to idle state
    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.state = GateState::Idle;
        self.count = 0;
        self.last_gesture = GestureType::None;
        self.can_score = true;
        self.current_stable_count = 0;
        self.pending_gesture = GestureType::None;
    }

    /// Mark as failed (called when timer expires)
    #[wasm_bindgen]
    pub fn fail(&mut self) {
        if self.state == GateState::Running {
            self.state = GateState::Failed;
        }
    }

    /// Get current count
    #[wasm_bindgen]
    pub fn get_count(&self) -> u32 {
        self.count
    }

    /// Get current state as string
    #[wasm_bindgen]
    pub fn get_state(&self) -> String {
        self.state.as_str().to_string()
    }

    /// Check if gate is unlocked (success)
    #[wasm_bindgen]
    pub fn is_unlocked(&self) -> bool {
        self.state == GateState::Success
    }

    /// Check if gate has failed
    #[wasm_bindgen]
    pub fn is_failed(&self) -> bool {
        self.state == GateState::Failed
    }

    /// Check if gate is running
    #[wasm_bindgen]
    pub fn is_running(&self) -> bool {
        self.state == GateState::Running
    }

    /// Process a single hand's landmarks (21 points from MediaPipe)
    /// Returns a JS object with gesture, state, count, scored
    #[wasm_bindgen]
    pub fn process_landmarks(&mut self, landmarks_js: JsValue) -> JsValue {
        let landmarks: Vec<Landmark> = match serde_wasm_bindgen::from_value(landmarks_js) {
            Ok(l) => l,
            Err(_) => {
                return serde_wasm_bindgen::to_value(&FrameResult {
                    gesture: GestureType::None.as_str().to_string(),
                    state: self.state.as_str().to_string(),
                    count: self.count,
                    scored: false,
                }).unwrap_or(JsValue::NULL);
            }
        };

        let (gesture, scored) = self.process_landmarks_internal(&landmarks);

        serde_wasm_bindgen::to_value(&FrameResult {
            gesture: gesture.as_str().to_string(),
            state: self.state.as_str().to_string(),
            count: self.count,
            scored,
        }).unwrap_or(JsValue::NULL)
    }

    /// Process raw landmark arrays (for optimization)
    /// Expects flat arrays: [x0, y0, z0, x1, y1, z1, ...]
    #[wasm_bindgen]
    pub fn process_raw(&mut self, xs: &[f32], ys: &[f32]) -> JsValue {
        if xs.len() < 21 || ys.len() < 21 {
            return serde_wasm_bindgen::to_value(&FrameResult {
                gesture: GestureType::None.as_str().to_string(),
                state: self.state.as_str().to_string(),
                count: self.count,
                scored: false,
            }).unwrap_or(JsValue::NULL);
        }

        let landmarks: Vec<Landmark> = (0..21)
            .map(|i| Landmark {
                x: xs[i],
                y: ys[i],
                z: 0.0,
            })
            .collect();

        let (gesture, scored) = self.process_landmarks_internal(&landmarks);

        serde_wasm_bindgen::to_value(&FrameResult {
            gesture: gesture.as_str().to_string(),
            state: self.state.as_str().to_string(),
            count: self.count,
            scored,
        }).unwrap_or(JsValue::NULL)
    }
}

impl GestureGate {
    fn process_landmarks_internal(&mut self, landmarks: &[Landmark]) -> (GestureType, bool) {
        if landmarks.len() < 21 {
            return (GestureType::None, false);
        }

        // Detect current gesture
        let gesture = self.detect_gesture(landmarks);
        let mut scored = false;

        // Update stability tracking
        if gesture == self.pending_gesture && gesture != GestureType::None {
            self.current_stable_count += 1;
        } else {
            self.pending_gesture = gesture;
            self.current_stable_count = if gesture != GestureType::None { 1 } else { 0 };
        }

        // Only process scoring if running
        if self.state == GateState::Running {
            // Check if we have a stable gesture
            let stable_gesture = if self.current_stable_count >= self.stable_frames {
                gesture
            } else {
                GestureType::None
            };

            // Score if we have a valid stable gesture and can score
            if stable_gesture != GestureType::None && self.can_score {
                self.count += 1;
                self.last_gesture = stable_gesture;
                self.can_score = false;
                scored = true;

                // Check for success
                if self.count >= self.target {
                    self.state = GateState::Success;
                }
            }

            // Reset scoring ability when returning to None
            if gesture == GestureType::None {
                self.can_score = true;
            }
        }

        (gesture, scored)
    }

    /// Detect gesture from landmarks using finger extension heuristics
    fn detect_gesture(&self, lm: &[Landmark]) -> GestureType {
        // MediaPipe landmark indices:
        // 0: wrist
        // 1-4: thumb (CMC, MCP, IP, TIP)
        // 5-8: index (MCP, PIP, DIP, TIP)
        // 9-12: middle (MCP, PIP, DIP, TIP)
        // 13-16: ring (MCP, PIP, DIP, TIP)
        // 17-20: pinky (MCP, PIP, DIP, TIP)

        let thumb_extended = self.is_thumb_extended(lm);
        let index_extended = self.is_finger_extended(lm, 8, 6);
        let middle_extended = self.is_finger_extended(lm, 12, 10);
        let ring_extended = self.is_finger_extended(lm, 16, 14);
        let pinky_extended = self.is_finger_extended(lm, 20, 18);

        // Gesture "6": Thumb + Pinky extended, others folded
        // This represents "6" in some counting systems (thumb=5, pinky=1)
        if thumb_extended && pinky_extended && !index_extended && !middle_extended && !ring_extended {
            return GestureType::Six;
        }

        // Gesture "7": Index + Middle extended, others folded
        // This is the classic "peace sign" or "V" gesture
        if index_extended && middle_extended && !thumb_extended && !ring_extended && !pinky_extended {
            return GestureType::Seven;
        }

        GestureType::None
    }

    /// Check if thumb is extended
    /// Thumb uses horizontal comparison (x-axis) since it moves sideways
    fn is_thumb_extended(&self, lm: &[Landmark]) -> bool {
        // Thumb tip (4) should be significantly away from thumb IP (3) in x direction
        // We check if tip is further from palm center than IP
        let tip = lm[4];
        let ip = lm[3];
        let mcp = lm[2];

        // Calculate the thumb's extension direction based on wrist orientation
        // If thumb tip is further from MCP than IP is, thumb is extended
        let tip_to_mcp = ((tip.x - mcp.x).powi(2) + (tip.y - mcp.y).powi(2)).sqrt();
        let ip_to_mcp = ((ip.x - mcp.x).powi(2) + (ip.y - mcp.y).powi(2)).sqrt();

        tip_to_mcp > ip_to_mcp * 1.1 // Some margin
    }

    /// Check if a finger is extended
    /// A finger is extended if the tip is above (lower y value in image coords) the PIP joint
    fn is_finger_extended(&self, lm: &[Landmark], tip_idx: usize, pip_idx: usize) -> bool {
        // In MediaPipe's coordinate system, y increases downward
        // So an extended finger has tip.y < pip.y
        let tip = lm[tip_idx];
        let pip = lm[pip_idx];

        // Finger is extended if tip is above PIP (in screen coords, lower y = higher)
        tip.y < pip.y - 0.02 // Small threshold for noise
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gate_lifecycle() {
        let mut gate = GestureGate::new(5);
        assert_eq!(gate.get_state(), "idle");
        
        gate.start();
        assert_eq!(gate.get_state(), "running");
        
        gate.fail();
        assert_eq!(gate.get_state(), "failed");
        assert!(gate.is_failed());
        
        gate.reset();
        assert_eq!(gate.get_state(), "idle");
    }
}
