import React from 'react';
import { Cpu, AlertTriangle } from 'lucide-react';

export default function HubTempCard({ hubTemp }) {
  const isValidNum = typeof hubTemp === 'number' && !isNaN(hubTemp);
  const isHigh = isValidNum && hubTemp > 55;
  const isCritical = isValidNum && hubTemp > 59;

  return (
    <div className={`card ${isCritical ? 'vibrate' : ''}`}>
      <div className="card-header">
        <h3 className="card-title">Hub Temperature</h3>
        <i className="fas fa-temperature-high card-icon"></i>
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <Cpu size={48} color={isCritical ? '#e53e3e' : isHigh ? '#dd6b20' : '#4a5568'} />
        <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '8px', color: isCritical ? '#e53e3e' : 'inherit' }}>
          {isValidNum ? `${hubTemp}°C` : '--'}
        </div>
        <p style={{ fontSize: '13px', color: '#718096', marginTop: '4px' }}>
          Raspberry Pi 4 Host Controller
        </p>
      </div>

      {isCritical && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: '#fff5f5',
          color: '#c53030',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600
        }}>
          <AlertTriangle size={16} />
          High Temperature Warning (&gt;59°C)
        </div>
      )}
    </div>
  );
}
