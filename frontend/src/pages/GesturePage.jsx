import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  VideoOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Cpu,
  Zap,
  Hand
} from 'lucide-react';
import { VideoGestureDetector } from '../gesture/GestureDetector';
import { toggleLight } from '../services/firebase';
import { emitTelemetryEvent } from '../services/api';

export default function GesturePage({ telemetry, onNotify }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [detectedGesture, setDetectedGesture] = useState('SEARCHING');
  const [confidence, setConfidence] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [activeGestureMetrics, setActiveGestureMetrics] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const metricsIntervalRef = useRef(null);

  // Keep a mutable ref to telemetry so callbacks always read fresh state
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;

  const light1State = telemetry.light1;
  const light2State = telemetry.light2;
  const light3State = telemetry.light3;

  const handleGestureAction = async (gesture, conf) => {
    setDetectedGesture(gesture);
    setConfidence(conf);

    try {
      if (gesture === 'LIGHT_ON') {
        // Unconditionally turn Light 1 and Light 3 ON in Firebase RTDB
        await toggleLight(1, true);
        await toggleLight(3, true);
        await emitTelemetryEvent('gesture_detected', { action: 'LIGHT_ON', confidence: conf });
        onNotify(`🖐️ Open Palm Recognized: Light 1 & 3 turned ON (${conf}%)`, 'success');
      } else if (gesture === 'LIGHT_OFF') {
        // Unconditionally turn Light 1 and Light 3 OFF in Firebase RTDB
        await toggleLight(1, false);
        await toggleLight(3, false);
        await emitTelemetryEvent('gesture_detected', { action: 'LIGHT_OFF', confidence: conf });
        onNotify(`✊ Closed Fist Recognized: Light 1 & 3 turned OFF (${conf}%)`, 'info');
      } else if (gesture === 'PINCH_TOGGLE') {
        const nextState = !telemetryRef.current.light1;
        await toggleLight(1, nextState);
        await toggleLight(3, nextState);
        await emitTelemetryEvent('gesture_detected', { action: 'PINCH_TOGGLE', state: nextState, confidence: conf });
        onNotify(`🤏 Pinch Gesture: Light 1 & 3 toggled ${nextState ? 'ON' : 'OFF'} (${conf}%)`, 'warning');
      } else if (gesture === 'VICTORY') {
        const nextL2 = !telemetryRef.current.light2;
        await toggleLight(2, nextL2);
        await emitTelemetryEvent('gesture_detected', { action: 'VICTORY_TOGGLE', state: nextL2, confidence: conf });
        onNotify(`✌️ Peace Sign: Light 2 toggled ${nextL2 ? 'ON' : 'OFF'} (${conf}%)`, 'success');
      }
    } catch (err) {
      console.error('[GesturePage] Action execution error:', err);
      onNotify(`Error executing gesture action: ${err.message}`, 'danger');
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);

      // Initialize MediaPipe Neural Hand Detector
      if (videoRef.current && canvasRef.current) {
        detectorRef.current = new VideoGestureDetector(
          videoRef.current,
          canvasRef.current,
          handleGestureAction
        );
        detectorRef.current.start();

        // Polling metrics for live UI HUD
        metricsIntervalRef.current = setInterval(() => {
          if (detectorRef.current) {
            const m = detectorRef.current.getMetrics();
            setActiveGestureMetrics(m);
            if (m.gesture && m.gesture !== 'UNKNOWN') {
              setDetectedGesture(m.gesture);
              setConfidence(m.confidence || 0);
            }
          }
        }, 120);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Could not access webcam. Please allow camera permissions in your browser.');
      onNotify('Camera access denied or unavailable.', 'danger');
    }
  };

  const stopCamera = () => {
    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
    }
    if (detectorRef.current) {
      detectorRef.current.stop();
      detectorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setDetectedGesture('SEARCHING');
    setConfidence(0);
    setActiveGestureMetrics(null);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const fingers = activeGestureMetrics?.fingers || { thumb: false, index: false, middle: false, ring: false, pinky: false };
  const isHandTracked = activeGestureMetrics?.handDetected;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Gesture Legend Card (Clean user required format matching screenshot 2) */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">MediaPipe 21-Landmark Vision Gesture Control</h3>
            <span className="card-subtitle">AI-powered 3D hand skeleton tracking & optical actuation</span>
          </div>
          <Cpu size={26} color="#6366f1" />
        </div>

        {/* 4 Clean Gesture Cards with proper Unicode arrows */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginTop: '16px' }}>
          {/* Card 1: Open Palm */}
          <div style={{ background: '#f0fdf4', padding: '14px 16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontWeight: 700, color: '#166534', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🖐️</span> Open Palm
            </div>
            <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px', fontWeight: 500 }}>
              All fingers up → Turns Light 1 & 3 <strong>ON</strong>
            </div>
          </div>

          {/* Card 2: Closed Fist */}
          <div style={{ background: '#fef2f2', padding: '14px 16px', borderRadius: '12px', border: '1px solid #fecaca' }}>
            <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✊</span> Closed Fist
            </div>
            <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '4px', fontWeight: 500 }}>
              All fingers curled → Turns Light 1 & 3 <strong>OFF</strong>
            </div>
          </div>

          {/* Card 3: Precision Pinch */}
          <div style={{ background: '#fffbeb', padding: '14px 16px', borderRadius: '12px', border: '1px solid #fef08a' }}>
            <div style={{ fontWeight: 700, color: '#854d0e', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🤏</span> Precision Pinch
            </div>
            <div style={{ fontSize: '12px', color: '#a16207', marginTop: '4px', fontWeight: 500 }}>
              Thumb & index touch → <strong>Toggles</strong> Light 1 & 3
            </div>
          </div>

          {/* Card 4: Victory / Peace */}
          <div style={{ background: '#f5f3ff', padding: '14px 16px', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
            <div style={{ fontWeight: 700, color: '#5b21b6', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✌️</span> Victory / Peace
            </div>
            <div style={{ fontSize: '12px', color: '#6d28d9', marginTop: '4px', fontWeight: 500 }}>
              Two fingers up → <strong>Toggles</strong> Light 2
            </div>
          </div>
        </div>
      </div>

      {/* Main Video Detection Container & Interactive Canvas */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px' }}>
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '640px',
          height: '420px',
          background: '#0f172a',
          borderRadius: '18px',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {/* Webcam Video (Mirrored for natural mirror view) */}
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            playsInline
            muted
          />

          {/* 3D Skeleton Overlay Canvas (Mirrored with video) */}
          <canvas
            ref={canvasRef}
            width={640}
            height={420}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              transform: 'scaleX(-1)'
            }}
          />

          {/* Non-Mirrored Floating HUD Overlay (Always Crisp & Readable!) */}
          {cameraActive && isHandTracked && (
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '14px',
              padding: '12px 18px',
              color: '#f8fafc',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              zIndex: 10,
              pointerEvents: 'none'
            }}>
              <div style={{
                fontSize: '15px',
                fontWeight: 800,
                color: detectedGesture === 'LIGHT_ON' ? '#34d399' : (detectedGesture === 'LIGHT_OFF' ? '#f87171' : '#818cf8'),
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>
                  {detectedGesture === 'LIGHT_ON' ? '🖐️ OPEN PALM (LIGHT ON)' :
                   detectedGesture === 'LIGHT_OFF' ? '✊ CLOSED FIST (LIGHT OFF)' :
                   detectedGesture === 'PINCH' ? '🤏 PRECISION PINCH' :
                   detectedGesture === 'VICTORY' ? '✌️ VICTORY SIGN' : `GESTURE: ${detectedGesture}`}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace' }}>
                Confidence: <strong>{confidence}%</strong> | Pinch: <strong>{activeGestureMetrics?.pinchDist || '0.00'}</strong>
              </div>
            </div>
          )}

          {/* Inactive State Placeholder */}
          {!cameraActive && (
            <div style={{
              position: 'absolute',
              color: '#94a3b8',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              padding: '24px'
            }}>
              <div style={{
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8'
              }}>
                <VideoOff size={36} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
                Camera is Currently Inactive
              </div>
              <div style={{ fontSize: '12px', maxWidth: '340px' }}>
                Click <strong>"Start Camera Tracking"</strong> below to activate Google MediaPipe 21-landmark optical controls.
              </div>
            </div>
          )}
        </div>

        {cameraError && (
          <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={16} /> {cameraError}
          </div>
        )}

        {/* Live Multi-Finger State Indicators */}
        {cameraActive && (
          <div style={{
            width: '100%',
            maxWidth: '640px',
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            {['thumb', 'index', 'middle', 'ring', 'pinky'].map((f) => (
              <div
                key={f}
                style={{
                  flex: 1,
                  minWidth: '90px',
                  background: fingers[f] ? '#f0fdf4' : '#f8fafc',
                  border: `1px solid ${fingers[f] ? '#86efac' : '#e2e8f0'}`,
                  borderRadius: '10px',
                  padding: '8px 10px',
                  textAlign: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                  {f}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: fingers[f] ? '#166534' : '#94a3b8', marginTop: '2px' }}>
                  {fingers[f] ? '🟢 Extended' : '⚪ Curled'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Status Diagnostic Bar */}
        <div style={{
          width: '100%',
          maxWidth: '640px',
          marginTop: '16px',
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          textAlign: 'center',
          border: '1px solid #e2e8f0'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Tracker State</div>
            <div style={{ fontWeight: 800, color: cameraActive ? '#10b981' : '#ef4444', marginTop: '4px', fontSize: '14px' }}>
              {cameraActive ? (isHandTracked ? '🟢 HAND TRACKED' : '🟡 SEARCHING...') : '⚫ STOPPED'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Detected Gesture</div>
            <div style={{ fontWeight: 800, color: detectedGesture === 'LIGHT_ON' ? '#10b981' : (detectedGesture === 'LIGHT_OFF' ? '#ef4444' : '#4f46e5'), marginTop: '4px', fontSize: '14px' }}>
              {detectedGesture} {confidence > 0 && `(${confidence}%)`}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Light 1 / 3 State</div>
            <div style={{ fontWeight: 800, color: light1State ? '#10b981' : '#64748b', marginTop: '4px', fontSize: '14px' }}>
              {light1State ? '💡 LIGHTS ON' : '⚫ LIGHTS OFF'}
            </div>
          </div>
        </div>

        {/* Controls & Quick Simulators */}
        <div style={{ display: 'flex', gap: '14px', marginTop: '22px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {!cameraActive ? (
            <button
              onClick={startCamera}
              className="schedule-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                fontSize: '15px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Video size={18} /> Start Camera Tracking
            </button>
          ) : (
            <button
              onClick={stopCamera}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '12px 28px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)'
              }}
            >
              <VideoOff size={18} /> Stop Camera
            </button>
          )}

          {/* Test Simulators */}
          <button
            onClick={() => handleGestureAction('LIGHT_ON', 98)}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              padding: '12px 18px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={15} /> Sim: 🖐️ Palm (ON)
          </button>

          <button
            onClick={() => handleGestureAction('LIGHT_OFF', 98)}
            style={{
              backgroundColor: '#64748b',
              color: 'white',
              border: 'none',
              padding: '12px 18px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={15} /> Sim: ✊ Fist (OFF)
          </button>
        </div>
      </div>
    </div>
  );
}
