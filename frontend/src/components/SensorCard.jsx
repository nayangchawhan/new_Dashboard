import React from 'react';
import { Thermometer, Droplets, Battery, Activity } from 'lucide-react';

export default function SensorCard({ temperature, humidity, battery, motion }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Room Telemetry</h3>
        <i className="fas fa-temperature-high card-icon"></i>
      </div>

      <div className="metric-row">
        <span className="metric-label">
          <Thermometer size={18} color="#e53e3e" />
          Temperature
        </span>
        <span className="metric-value">
          {typeof temperature === 'number' && !isNaN(temperature) ? `${temperature}°C` : '--'}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">
          <Droplets size={18} color="#3182ce" />
          Humidity
        </span>
        <span className="metric-value">
          {typeof humidity === 'number' && !isNaN(humidity) ? `${humidity}%` : '--'}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">
          <Battery size={18} color={typeof battery === 'number' && battery < 30 ? '#e53e3e' : '#38a169'} />
          Sensor Battery
        </span>
        <span className="metric-value" style={{ color: typeof battery === 'number' && battery < 30 ? '#e53e3e' : 'inherit' }}>
          {typeof battery === 'number' && !isNaN(battery) ? `${battery}%` : '--'}
        </span>
      </div>

      <div className="metric-row">
        <span className="metric-label">
          <Activity size={18} color={motion ? '#dd6b20' : '#718096'} />
          Motion Sensor
        </span>
        <span className={`status-tag ${motion ? 'on' : 'off'}`} style={{
          backgroundColor: motion ? '#feebc8' : '#edf2f7',
          color: motion ? '#c05621' : '#718096'
        }}>
          {motion ? 'Movement Detected' : 'Clear'}
        </span>
      </div>
    </div>
  );
}
