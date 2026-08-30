/**
 * ORBIT Real-Time Hand Landmark & Gesture Recognition Engine
 * Powered by Google MediaPipe Hands (21 3D Landmarks)
 * 
 * Accurately detects:
 * - 🖐️ OPEN PALM (All fingers extended) -> Triggers LIGHT_ON (Light 1 & 3 ON)
 * - ✊ CLOSED FIST (All fingers curled) -> Triggers LIGHT_OFF (Light 1 & 3 OFF)
 * - 🤏 PINCH (Thumb & Index tips touching) -> Triggers PINCH_TOGGLE (Light 1 & 3)
 * - ✌️ VICTORY / PEACE (Index & Middle extended) -> Triggers VICTORY (Light 2)
 */

import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

// Hand landmark connections for drawing skeleton
export const HAND_CONNECTIONS = [
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
  // Palm Base Knuckles
  [5, 9], [9, 13], [13, 17]
];

export class VideoGestureDetector {
  constructor(videoElement, canvasElement, onGestureDetected) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;
    this.onGestureDetected = onGestureDetected;

    this.hands = null;
    this.camera = null;
    this.isRunning = false;

    // Debounce & Confirmation state
    this.lastTriggeredAction = null;
    this.consecutiveCount = 0;
    this.REQUIRED_CONSECUTIVE_FRAMES = 4; // ~120-150ms stable confirmation
    this.candidateGesture = 'IDLE';
    this.lastTriggerTime = 0;
    this.TRIGGER_COOLDOWN_MS = 1000; // 1.0s cooldown between consecutive triggers

    // Current state for UI telemetry
    this.latestMetrics = {
      gesture: 'SEARCHING',
      confidence: 0,
      fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
      pinchDist: 0,
      handDetected: false
    };

    this.initMediaPipe();
  }

  initMediaPipe() {
    try {
      this.hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
      });

      this.hands.onResults(this.onResults.bind(this));
    } catch (err) {
      console.error('[GestureDetector] Error initializing MediaPipe Hands:', err);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTriggeredAction = null;
    this.consecutiveCount = 0;

    if (!this.hands) {
      this.initMediaPipe();
    }

    if (this.video) {
      try {
        this.camera = new Camera(this.video, {
          onFrame: async () => {
            if (this.isRunning && this.hands && this.video && this.video.readyState >= 2) {
              await this.hands.send({ image: this.video });
            }
          },
          width: 640,
          height: 480
        });
        this.camera.start();
      } catch (err) {
        console.warn('[GestureDetector] Native Camera class init fallback to manual loop:', err);
        this.manualLoop();
      }
    }
  }

  manualLoop = async () => {
    if (!this.isRunning) return;
    if (this.hands && this.video && this.video.readyState >= 2) {
      try {
        await this.hands.send({ image: this.video });
      } catch (e) {
        console.warn('Frame send error:', e);
      }
    }
    requestAnimationFrame(this.manualLoop);
  };

  stop() {
    this.isRunning = false;
    if (this.camera) {
      try {
        this.camera.stop();
      } catch (e) {}
      this.camera = null;
    }
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.latestMetrics = {
      gesture: 'SEARCHING',
      confidence: 0,
      fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
      pinchDist: 0,
      handDetected: false
    };
  }

  /**
   * Calculates 3D Euclidean distance between two landmarks
   */
  dist(lm1, lm2) {
    const dx = lm1.x - lm2.x;
    const dy = lm1.y - lm2.y;
    const dz = (lm1.z || 0) - (lm2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Evaluates individual finger states & overall hand gesture
   */
  analyzeLandmarks(landmarks) {
    const wrist = landmarks[0];

    // 1. Check Index, Middle, Ring, Pinky extension
    // A finger is extended if its Tip is above PIP joint and distance to wrist > MCP distance
    const isIndexExtended = landmarks[8].y < landmarks[6].y && this.dist(landmarks[8], wrist) > this.dist(landmarks[6], wrist) * 1.1;
    const isMiddleExtended = landmarks[12].y < landmarks[10].y && this.dist(landmarks[12], wrist) > this.dist(landmarks[10], wrist) * 1.1;
    const isRingExtended = landmarks[16].y < landmarks[14].y && this.dist(landmarks[16], wrist) > this.dist(landmarks[14], wrist) * 1.1;
    const isPinkyExtended = landmarks[20].y < landmarks[18].y && this.dist(landmarks[20], wrist) > this.dist(landmarks[18], wrist) * 1.1;

    // 2. Thumb extension
    const isThumbExtended = this.dist(landmarks[4], landmarks[5]) > this.dist(landmarks[3], landmarks[5]) * 1.15 &&
                            this.dist(landmarks[4], wrist) > this.dist(landmarks[2], wrist);

    const fingers = {
      thumb: isThumbExtended,
      index: isIndexExtended,
      middle: isMiddleExtended,
      ring: isRingExtended,
      pinky: isPinkyExtended
    };

    const extendedCount = [isIndexExtended, isMiddleExtended, isRingExtended, isPinkyExtended].filter(Boolean).length;
    const pinchDist = this.dist(landmarks[4], landmarks[8]); // Thumb Tip to Index Tip

    let gesture = 'UNKNOWN';
    let confidence = 0;

    // GESTURE 1: 🖐️ OPEN PALM (All 4 main fingers extended + open thumb) -> LIGHT_ON
    if (extendedCount >= 4 || (extendedCount === 3 && isThumbExtended && pinchDist > 0.12)) {
      gesture = 'LIGHT_ON';
      confidence = Math.min(99, Math.round(85 + (extendedCount * 3) + (pinchDist * 30)));
    }
    // GESTURE 2: ✊ CLOSED FIST (All 4 fingers curled) -> LIGHT_OFF
    else if (extendedCount === 0 && !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      gesture = 'LIGHT_OFF';
      confidence = Math.min(99, Math.round(88 + (isThumbExtended ? 0 : 10)));
    }
    // GESTURE 3: 🤏 PINCH (Thumb tip and Index tip touching) -> PINCH_TOGGLE
    else if (pinchDist < 0.065 && (isMiddleExtended || extendedCount >= 1)) {
      gesture = 'PINCH';
      confidence = Math.min(96, Math.round((1 - (pinchDist / 0.065)) * 100));
    }
    // GESTURE 4: ✌️ VICTORY / PEACE (Index & Middle extended only)
    else if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      gesture = 'VICTORY';
      confidence = 94;
    }

    return {
      gesture,
      confidence,
      fingers,
      pinchDist: +(pinchDist.toFixed(3)),
      extendedCount
    };
  }

  /**
   * MediaPipe Results Callback
   */
  onResults(results) {
    if (!this.ctx || !this.canvas) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    this.ctx.save();
    this.ctx.clearRect(0, 0, width, height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const analysis = this.analyzeLandmarks(landmarks);

      this.latestMetrics = {
        ...analysis,
        handDetected: true
      };

      // 1. Draw Skeleton Connections
      const isPalm = analysis.gesture === 'LIGHT_ON';
      const isFist = analysis.gesture === 'LIGHT_OFF';
      this.ctx.strokeStyle = isPalm ? '#10b981' : (isFist ? '#ef4444' : '#818cf8');
      this.ctx.lineWidth = 3;

      for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];
        this.ctx.beginPath();
        this.ctx.moveTo(start.x * width, start.y * height);
        this.ctx.lineTo(end.x * width, end.y * height);
        this.ctx.stroke();
      }

      // 2. Draw Landmark Joint Nodes
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        const x = lm.x * width;
        const y = lm.y * height;

        this.ctx.beginPath();
        if ([4, 8, 12, 16, 20].includes(i)) {
          // Fingertips
          this.ctx.arc(x, y, 7, 0, 2 * Math.PI);
          this.ctx.fillStyle = isPalm ? '#34d399' : (isFist ? '#f87171' : '#a5b4fc');
        } else {
          // Knuckles / joints
          this.ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
          this.ctx.fillStyle = '#ffffff';
        }
        this.ctx.fill();
        this.ctx.strokeStyle = '#0f172a';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }

      // 3. Draw Pinch Guide line if fingers close
      if (analysis.pinchDist < 0.12) {
        this.ctx.beginPath();
        this.ctx.moveTo(landmarks[4].x * width, landmarks[4].y * height);
        this.ctx.lineTo(landmarks[8].x * width, landmarks[8].y * height);
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }

      // 4. Trigger Actuation with robust debouncing
      this.processDebouncedTrigger(analysis.gesture, analysis.confidence);

    } else {
      this.latestMetrics.handDetected = false;
      this.latestMetrics.gesture = 'SEARCHING';
      this.consecutiveCount = 0;
    }

    this.ctx.restore();
  }

  /**
   * Multi-frame confirmation to trigger hardware actuation
   */
  processDebouncedTrigger(gesture, confidence) {
    const now = Date.now();
    if (now - this.lastTriggerTime < this.TRIGGER_COOLDOWN_MS) {
      return; // In cooldown
    }

    if (gesture === 'LIGHT_ON' || gesture === 'LIGHT_OFF' || gesture === 'PINCH' || gesture === 'VICTORY') {
      if (this.candidateGesture === gesture && confidence >= 65) {
        this.consecutiveCount++;

        if (this.consecutiveCount >= this.REQUIRED_CONSECUTIVE_FRAMES) {
          if (this.lastTriggeredAction !== gesture || (now - this.lastTriggerTime >= 2000)) {
            this.lastTriggeredAction = gesture;
            this.lastTriggerTime = now;
            this.consecutiveCount = 0;

            const targetAction = gesture === 'PINCH' ? 'PINCH_TOGGLE' : gesture;
            if (this.onGestureDetected) {
              this.onGestureDetected(targetAction, confidence);
            }
          }
        }
      } else {
        this.candidateGesture = gesture;
        this.consecutiveCount = 1;
      }
    } else {
      this.consecutiveCount = 0;
    }
  }

  getMetrics() {
    return this.latestMetrics;
  }
}
