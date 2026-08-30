import React from 'react';
import { Lock, Unlock } from 'lucide-react';

export default function SafeModeCard({ safeMode, isPermitted = true, onToggle }) {
  const id = "masterSwitch";

  return (
    <div className={`card ${safeMode ? 'vibrate' : ''} ${!isPermitted ? 'opacity-80' : ''}`}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 className="card-title">Safe Mode Master Switch</h3>
          {!isPermitted && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Lock size={10} /> Family/Owner Only
            </span>
          )}
        </div>
        <i className="fa fa-lock card-icon"></i>
      </div>

      <div className="wrap-check-1">
        <input
          type="checkbox"
          id={id}
          checked={Boolean(safeMode)}
          disabled={!isPermitted}
          onChange={(e) => isPermitted && onToggle(e.target.checked)}
        />
        <label htmlFor={id} className={`checkbox ${!isPermitted ? 'disabled' : ''}`}>
          <div className="checkbox__inner">
            <div className="green__ball"></div>
          </div>
        </label>
        <div className="checkbox__text">
          <span className={`status-tag ${safeMode ? 'on' : 'off'}`}>
            {safeMode ? 'LOCKED' : 'UNLOCKED'}
          </span>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: !isPermitted ? '#dc2626' : '#718096', textAlign: 'center', marginTop: '8px' }}>
        {!isPermitted
          ? '🔒 Master Switch control is restricted to Homeowner / Family Members.'
          : safeMode
          ? '🔒 Safe Mode is Active. Motion triggers automated email alerts.'
          : '🔓 Safe Mode is Inactive. Normal operations.'}
      </p>
    </div>
  );
}
