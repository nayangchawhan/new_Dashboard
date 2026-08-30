import React, { useState, useEffect } from 'react';
import { Clock, Maximize2, Lock } from 'lucide-react';
import { updateSchedule } from '../services/firebase';

export default function ScheduleCard({
  light3State,
  disabled,
  isPermitted = true,
  canEditSchedule = true,
  activeActor = null,
  scheduleData,
  onToggleLight3,
  onNotify,
  onExpand
}) {
  const [onTime, setOnTime] = useState('22:00');
  const [offTime, setOffTime] = useState('06:00');
  const inputId = 'light_3';
  const isInputDisabled = disabled || !isPermitted;

  useEffect(() => {
    if (scheduleData?.light_schedule_on) setOnTime(scheduleData.light_schedule_on);
    if (scheduleData?.light_schedule_off) setOffTime(scheduleData.light_schedule_off);
  }, [scheduleData]);

  const handleSaveSchedule = async () => {
    if (!canEditSchedule) {
      onNotify('Scheduler modification is restricted to Homeowner / Family Members.', 'warning');
      return;
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(onTime) || !timeRegex.test(offTime)) {
      onNotify('Please enter valid times in HH:MM format.', 'warning');
      return;
    }

    try {
      await updateSchedule(onTime, offTime, activeActor);
      onNotify('Schedule updated successfully in Firebase!', 'success');
    } catch (err) {
      onNotify('Failed to update schedule: ' + err.message, 'danger');
    }
  };

  return (
    <div
      className={`card ${light3State ? 'vibrate' : ''} clickable ${!isPermitted ? 'opacity-80' : ''}`}
      onClick={() => onExpand && onExpand()}
      title={isPermitted ? "Click card to expand 24h on/off duration analytics and history" : "Access restricted by Homeowner"}
    >
      <div className="card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 className="card-title">Light 3 & Scheduler</h3>
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
            {isPermitted ? 'Automated schedule & duration analytics' : 'Device not granted in your guest access'}
          </span>
        </div>
        <i className={`fas fa-lightbulb card-icon ${light3State ? 'active' : ''}`}></i>
      </div>

      <div className="wrap-check-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          id={inputId}
          checked={Boolean(light3State)}
          disabled={isInputDisabled}
          onChange={(e) => isPermitted && onToggleLight3(e.target.checked)}
        />
        <label htmlFor={inputId} className={`checkbox ${isInputDisabled ? 'disabled' : ''}`}>
          <div className="checkbox__inner">
            <div className="green__ball"></div>
          </div>
        </label>
        <div className="checkbox__text">
          <span className={`status-tag ${light3State ? 'on' : 'off'}`}>
            {light3State ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      <div className="schedule-box" onClick={(e) => e.stopPropagation()}>
        <div className="schedule-row">
          <span><Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> ON Time:</span>
          <input
            type="time"
            className="schedule-input"
            value={onTime}
            disabled={!canEditSchedule}
            onChange={(e) => setOnTime(e.target.value)}
          />
        </div>
        <div className="schedule-row">
          <span><Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> OFF Time:</span>
          <input
            type="time"
            className="schedule-input"
            value={offTime}
            disabled={!canEditSchedule}
            onChange={(e) => setOffTime(e.target.value)}
          />
        </div>
        <button
          className="schedule-btn"
          onClick={handleSaveSchedule}
          disabled={!canEditSchedule}
          style={!canEditSchedule ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
        >
          {canEditSchedule ? 'Set Schedule' : '🔒 Read-Only Schedule'}
        </button>
      </div>

      {!isPermitted && (
        <p style={{ fontSize: '11px', color: '#dc2626', textAlign: 'center', marginTop: '6px' }}>
          🔒 Restricted: Homeowner did not grant control for Light 3
        </p>
      )}
    </div>
  );
}
