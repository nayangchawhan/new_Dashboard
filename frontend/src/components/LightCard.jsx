import React from 'react';
import { Lightbulb, Maximize2, Lock } from 'lucide-react';

export default function LightCard({ title, lightNum, state, disabled, isPermitted = true, onToggle, onExpand }) {
  const inputId = `light_${lightNum}`;
  const isInputDisabled = disabled || !isPermitted;

  return (
    <div
      className={`card ${state ? 'vibrate' : ''} clickable ${!isPermitted ? 'opacity-80' : ''}`}
      onClick={() => onExpand && onExpand()}
      title={isPermitted ? "Click card to expand 24h on/off duration analytics and history" : "Access restricted by Homeowner"}
    >
      <div className="card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 className="card-title">{title}</h3>
            {!isPermitted ? (
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <Lock size={10} /> Restricted
              </span>
            ) : onExpand ? (
              <span className="card-expand-badge">
                <Maximize2 size={12} /> 24h Stats
              </span>
            ) : null}
          </div>
          <span className="card-subtitle" style={{ fontSize: '11px', color: '#718096' }}>
            {isPermitted ? 'Click to view on/off timeline & durations' : 'Device not granted in your guest access'}
          </span>
        </div>
        <i className={`fas fa-lightbulb card-icon ${state ? 'active' : ''}`}></i>
      </div>

      <div className="wrap-check-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          id={inputId}
          checked={Boolean(state)}
          disabled={isInputDisabled}
          onChange={(e) => isPermitted && onToggle(e.target.checked)}
        />
        <label htmlFor={inputId} className={`checkbox ${isInputDisabled ? 'disabled' : ''}`}>
          <div className="checkbox__inner">
            <div className="green__ball"></div>
          </div>
        </label>
        <div className="checkbox__text">
          <span className={`status-tag ${state ? 'on' : 'off'}`}>
            {state ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {!isPermitted ? (
        <p style={{ fontSize: '11px', color: '#dc2626', textAlign: 'center', marginTop: '6px' }}>
          🔒 Restricted: Homeowner did not grant control for {title}
        </p>
      ) : disabled ? (
        <p style={{ fontSize: '11px', color: '#e53e3e', textAlign: 'center', marginTop: '6px' }}>
          Disabled while Safe Mode is active
        </p>
      ) : null}
    </div>
  );
}
