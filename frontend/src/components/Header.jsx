import React from 'react';
import logoImg from '../assets/Untitled-3.jpg';
import { Cpu, LogOut, Radio } from 'lucide-react';

export default function Header({ activeTab, isConnected, currentDevice, activeActor, onSwitchDevice }) {
  const getTabName = () => {
    switch (activeTab) {
      case 'dashboard': return 'Live Smart Controls';
      case 'analytics': return 'Telemetry & Stream Analytics';
      case 'gesture': return 'Camera Gesture Control';
      case 'chatbot': return 'Orbit AI Assistant';
      case 'health': return 'Pipeline & Service Health';
      case 'profile': return 'User Profile & Guest Access';
      default: return 'Overview';
    }
  };

  const deviceLabel = currentDevice?.deviceId || 'd5695';
  const deviceName = currentDevice?.name || `Device ${deviceLabel}`;

  return (
    <header className="header">
      <div className="header-left">
        <img src={logoImg} alt="WAVE Logo" className="header-logo" />
        <div className="header-title-wrap">
          <h1 className="header-title">WAVE</h1>
          <span className="header-subtitle">By Automattrix • {getTabName()}</span>
        </div>
      </div>

      <div className="header-right">
        {/* Active Device Badge */}
        <div className="device-header-pill" title={`Connected to: ${deviceName} (${deviceLabel})`}>
          <div className="device-pill-icon">
            <Radio size={14} />
          </div>
          <div className="device-pill-text">
            <span className="device-pill-tag">Node</span>
            <span className="device-pill-id">{deviceLabel}</span>
          </div>
        </div>

        {/* Live Firebase Connection Status */}
        <div className={`status-pill ${isConnected ? 'online' : 'offline'}`}>
          <div className="status-dot"></div>
          <span className="status-text">{isConnected ? 'Live Stream' : 'Connecting...'}</span>
        </div>

        {/* Switch Device / Logout Button */}
        {onSwitchDevice && (
          <button
            onClick={onSwitchDevice}
            className="switch-device-btn"
            title="Switch or Register Device"
            aria-label="Switch Device"
          >
            <LogOut size={15} />
            <span className="switch-text">Switch</span>
          </button>
        )}
      </div>
    </header>
  );
}
