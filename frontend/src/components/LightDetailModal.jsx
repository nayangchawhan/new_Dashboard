import React, { useState, useMemo, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  X,
  Lightbulb,
  Clock,
  Zap,
  Activity,
  CheckCircle2,
  Calendar,
  Download,
  Flame,
  ArrowRight,
  TrendingUp,
  Timer,
  Power,
  RotateCcw,
  ListFilter
} from 'lucide-react';
import { computeLightSessionStats } from '../services/firebase';

// Register ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function LightDetailModal({
  lightNum = 1,
  title = 'Light 1',
  historyData = {},
  currentState = false,
  disabled = false,
  onToggle,
  onClose
}) {
  const [timeRangeHours, setTimeRangeHours] = useState(24);
  const [activeTab, setActiveTab] = useState('sessions'); // 'sessions' | 'chart' | 'events'

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Compute session statistics
  const stats = useMemo(() => {
    const all = historyData?.allPoints && historyData.allPoints.length > 0
      ? historyData.allPoints
      : (historyData?.points || []);
    return computeLightSessionStats(all, timeRangeHours);
  }, [historyData, timeRangeHours]);

  const isLightCurrentlyOn = Boolean(currentState ?? stats.currentState);

  // Build Step-Line Chart Data for ON/OFF Transitions
  const chartData = useMemo(() => {
    const pts = stats.filteredPoints.length > 0
      ? stats.filteredPoints
      : [{ timeStr: 'Now', value: isLightCurrentlyOn ? 1 : 0 }];

    const labels = pts.map(p => p.timeStr || `#${p.index}`);
    const values = pts.map(p => (p.value === 1 || p.value === true || p.value === '1' || p.value === 'on' || p.value === 'ON') ? 1 : 0);

    return {
      labels,
      datasets: [
        {
          label: `${title} State`,
          data: values,
          borderColor: '#eab308',
          backgroundColor: 'rgba(234, 179, 8, 0.18)',
          stepped: 'before', // Square wave stepped line!
          pointBackgroundColor: values.map(v => (v === 1 ? '#eab308' : '#94a3b8')),
          pointBorderColor: values.map(v => (v === 1 ? '#ca8a04' : '#64748b')),
          pointRadius: pts.length > 40 ? 3 : 5,
          pointHoverRadius: 8,
          fill: true
        }
      ]
    };
  }, [stats.filteredPoints, isLightCurrentlyOn, title]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 12,
        cornerRadius: 10,
        titleColor: '#94a3b8',
        titleFont: { size: 12, weight: '600' },
        bodyColor: '#ffffff',
        bodyFont: { size: 14, weight: 'bold' },
        callbacks: {
          title: (items) => {
            if (!items.length) return '';
            const idx = items[0].dataIndex;
            const pt = stats.filteredPoints[idx];
            return pt?.fullDateStr || items[0].label;
          },
          label: (context) => {
            const val = context.parsed.y;
            return ` ${title}: ${val === 1 ? '💡 ON' : '🌑 OFF'}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 10
        }
      },
      y: {
        min: -0.1,
        max: 1.1,
        grid: { color: '#f1f5f9' },
        ticks: {
          stepSize: 1,
          color: '#64748b',
          font: { size: 12, weight: 'bold' },
          callback: (val) => (val === 1 ? 'ON (1)' : val === 0 ? 'OFF (0)' : '')
        }
      }
    }
  };

  // Export session data to CSV
  const handleExportCSV = () => {
    if (!stats.sessions.length) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Session_ID,Device,Turn_ON_Time,Turn_OFF_Time,Duration_Seconds,Duration_Formatted,Status\n';

    stats.sessions.forEach(s => {
      const row = [
        s.id,
        `"${title}"`,
        `"${s.onDateStr || s.onTimeStr}"`,
        `"${s.offDateStr || s.offTimeStr}"`,
        Math.round(s.durationMs / 1000),
        `"${s.durationFormatted}"`,
        s.isOngoing ? '"Active (Ongoing)"' : '"Completed"'
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}_sessions_24h_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="metric-modal-backdrop" onClick={onClose}>
      <div className="metric-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="metric-modal-header">
          <div className="metric-modal-header-left">
            <div
              className="metric-modal-icon-badge"
              style={{
                background: isLightCurrentlyOn
                  ? 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)'
                  : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                boxShadow: isLightCurrentlyOn ? '0 6px 16px rgba(234, 179, 8, 0.4)' : 'none'
              }}
            >
              <Lightbulb size={24} color="#ffffff" />
            </div>
            <div>
              <div className="metric-modal-title-row">
                <h2 className="metric-modal-title">{title} — Activity & Duration Analytics</h2>
                <span
                  className="metric-modal-status-badge"
                  style={{
                    backgroundColor: isLightCurrentlyOn ? '#fef3c7' : '#f1f5f9',
                    color: isLightCurrentlyOn ? '#92400e' : '#475569',
                    borderColor: isLightCurrentlyOn ? '#fde68a' : '#e2e8f0'
                  }}
                >
                  <span
                    className="live-pulse-dot"
                    style={{ backgroundColor: isLightCurrentlyOn ? '#eab308' : '#94a3b8' }}
                  ></span>
                  {isLightCurrentlyOn ? 'LIVE: ON' : 'LIVE: OFF'} ({stats.currentStateDurationFormatted})
                </span>
              </div>
              <p className="metric-modal-subtitle">
                Historical on/off timestamps, activation cycles, and exact session durations
              </p>
            </div>
          </div>

          <div className="metric-modal-header-right">
            {/* Direct Quick Toggle in Modal */}
            {onToggle && (
              <button
                className={`modal-toggle-quick-btn ${isLightCurrentlyOn ? 'on' : 'off'}`}
                onClick={() => onToggle(!isLightCurrentlyOn)}
                disabled={disabled}
                title={disabled ? 'Disabled in Safe Mode' : `Turn ${title} ${isLightCurrentlyOn ? 'OFF' : 'ON'}`}
              >
                <Power size={14} />
                <span>{isLightCurrentlyOn ? 'Switch OFF' : 'Switch ON'}</span>
              </button>
            )}

            {/* Time Range Filter Pills */}
            <div className="time-range-pills">
              {[
                { label: '1 Hr', hours: 1 },
                { label: '6 Hrs', hours: 6 },
                { label: '12 Hrs', hours: 12 },
                { label: '24 Hrs', hours: 24 },
                { label: 'All Time', hours: 0 }
              ].map((opt) => (
                <button
                  key={opt.hours}
                  className={`time-pill-btn ${timeRangeHours === opt.hours ? 'active' : ''}`}
                  onClick={() => setTimeRangeHours(opt.hours)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Close Button */}
            <button className="metric-modal-close-btn" onClick={onClose} aria-label="Close Modal">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Top Key Statistics Grid */}
        <div className="modal-stats-grid">
          {/* 1. Total Turn ON Time */}
          <div className="modal-stat-card">
            <div className="modal-stat-header">
              <span className="modal-stat-label">Total Turn ON Time</span>
              <Timer size={16} className="modal-stat-icon text-amber" style={{ color: '#eab308' }} />
            </div>
            <div className="modal-stat-value" style={{ color: '#b45309' }}>
              <span>{stats.totalOnFormatted}</span>
            </div>
            <div className="modal-stat-sub">
              Active Duty Cycle: <strong>{stats.onPercentage}%</strong> of window
            </div>
          </div>

          {/* 2. Total Turn OFF Time */}
          <div className="modal-stat-card">
            <div className="modal-stat-header">
              <span className="modal-stat-label">Total Turn OFF Time</span>
              <Clock size={16} className="modal-stat-icon text-sky" />
            </div>
            <div className="modal-stat-value">
              <span>{stats.totalOffFormatted}</span>
            </div>
            <div className="modal-stat-sub">
              Standby Idle: <strong>{stats.offPercentage}%</strong> of window
            </div>
          </div>

          {/* 3. Average ON Session Duration ("Each time it's on how much time it took to off") */}
          <div className="modal-stat-card">
            <div className="modal-stat-header">
              <span className="modal-stat-label">Avg ON Session Duration</span>
              <Activity size={16} className="modal-stat-icon text-indigo" />
            </div>
            <div className="modal-stat-value text-indigo">
              <span>{stats.avgSessionFormatted}</span>
            </div>
            <div className="modal-stat-sub">
              Longest: {stats.maxSessionFormatted || '0s'}
            </div>
          </div>

          {/* 4. Total Turn ON Cycles */}
          <div className="modal-stat-card">
            <div className="modal-stat-header">
              <span className="modal-stat-label">Turn ON Activations</span>
              <Zap size={16} className="modal-stat-icon text-emerald" />
            </div>
            <div className="modal-stat-value text-emerald">
              <span>{stats.sessionCount}</span>
              <span className="modal-stat-unit">cycles</span>
            </div>
            <div className="modal-stat-sub">
              {stats.completedSessionCount} completed • {stats.sessions.some(s => s.isOngoing) ? '1 active' : '0 active'}
            </div>
          </div>
        </div>

        {/* View Navigation Tabs Bar */}
        <div className="modal-tabs-bar">
          <div className="modal-tabs-left">
            <button
              className={`modal-tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
              onClick={() => setActiveTab('sessions')}
            >
              <Timer size={16} /> Sessions & Durations ({stats.sessions.length})
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'chart' ? 'active' : ''}`}
              onClick={() => setActiveTab('chart')}
            >
              <Activity size={16} /> State Transition Graph
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              <ListFilter size={16} /> All Toggle Events Log ({stats.events.length})
            </button>
          </div>

          <button className="modal-export-btn" onClick={handleExportCSV}>
            <Download size={15} /> Export Sessions (CSV)
          </button>
        </div>

        {/* Tab 1: Detailed Session Breakdown ("When was lights on and off and how much time it took to off") */}
        {activeTab === 'sessions' && (
          <div className="modal-tab-content">
            {/* Visual State Strip */}
            <div className="light-timeline-strip-card">
              <div className="light-timeline-strip-header">
                <span className="timeline-strip-title">24-Hour Duty Cycle Distribution</span>
                <span className="timeline-strip-sub">
                  🟢 <strong>{stats.onPercentage}% ON</strong> ({stats.totalOnFormatted}) • ⚪ <strong>{stats.offPercentage}% OFF</strong> ({stats.totalOffFormatted})
                </span>
              </div>
              <div className="light-duty-progress-bar">
                <div
                  className="duty-segment-on"
                  style={{ width: `${stats.onPercentage}%` }}
                  title={`Total ON: ${stats.onPercentage}%`}
                ></div>
                <div
                  className="duty-segment-off"
                  style={{ width: `${stats.offPercentage}%` }}
                  title={`Total OFF: ${stats.offPercentage}%`}
                ></div>
              </div>
            </div>

            {/* Sessions List */}
            <div className="light-sessions-container">
              <div className="sessions-list-header">
                <h3>Light ON Sessions & Active Durations</h3>
                <span>Detailed log of each activation: When turned ON $\rightarrow$ When turned OFF $\rightarrow$ Total Time Taken</span>
              </div>

              {stats.sessions.length === 0 ? (
                <div className="empty-tab-state">
                  <Lightbulb size={32} color="#cbd5e1" style={{ margin: '0 auto 8px auto' }} />
                  <p>No light activations recorded in this time range.</p>
                  <p style={{ fontSize: '11px', color: '#94a3b8' }}>Try selecting "All Time" to view full historical data.</p>
                </div>
              ) : (
                <div className="sessions-card-grid">
                  {stats.sessions.map((session) => (
                    <div key={session.id} className={`session-detail-card ${session.isOngoing ? 'ongoing' : ''}`}>
                      <div className="session-card-top">
                        <div className="session-badge-wrap">
                          <span className={`session-number-badge ${session.isOngoing ? 'ongoing' : ''}`}>
                            Session #{session.id}
                          </span>
                          {session.isOngoing && (
                            <span className="session-active-pill">
                              <span className="live-pulse-dot" style={{ backgroundColor: '#10b981' }}></span>
                              Currently Active
                            </span>
                          )}
                        </div>
                        <div className="session-duration-tag">
                          <Clock size={13} />
                          <span>Active for: <strong>{session.durationFormatted}</strong></span>
                        </div>
                      </div>

                      <div className="session-timeline-row">
                        {/* Turn ON Column */}
                        <div className="session-time-block on">
                          <span className="session-label">💡 Turned ON</span>
                          <span className="session-time-val">{session.onTimeStr}</span>
                          <span className="session-date-val">{session.onDateStr || 'Today'}</span>
                        </div>

                        {/* Middle Duration Arrow */}
                        <div className="session-duration-connector">
                          <span className="connector-duration">{session.durationFormatted}</span>
                          <div className="connector-line">
                            <ArrowRight size={14} className="connector-arrow" />
                          </div>
                        </div>

                        {/* Turn OFF Column */}
                        <div className={`session-time-block ${session.isOngoing ? 'active-block' : 'off'}`}>
                          <span className="session-label">
                            {session.isOngoing ? '🟢 Current State' : '🌑 Turned OFF'}
                          </span>
                          <span className="session-time-val">
                            {session.isOngoing ? 'Still Active' : session.offTimeStr}
                          </span>
                          <span className="session-date-val">
                            {session.isOngoing ? 'Running now' : (session.offDateStr || 'Today')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: State Transition Stepped Graph */}
        {activeTab === 'chart' && (
          <div className="modal-tab-content">
            <div className="modal-chart-box">
              <div style={{ height: '320px', width: '100%' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
            <div className="chart-legend-box">
              <div className="chart-legend-item">
                <span className="legend-dot" style={{ background: '#eab308' }}></span>
                <span><strong>State 1 (ON)</strong>: Light energized & active</span>
              </div>
              <div className="chart-legend-item">
                <span className="legend-dot" style={{ background: '#94a3b8' }}></span>
                <span><strong>State 0 (OFF)</strong>: Light turned off / Standby</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Complete Toggle Events Log Table */}
        {activeTab === 'events' && (
          <div className="modal-tab-content">
            <div className="table-wrapper-box">
              <table className="modal-data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date & Time</th>
                    <th>Action / Event</th>
                    <th>Preceding State Duration</th>
                    <th>Source / Method</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.events.map((evt, idx) => (
                    <tr key={evt.key || idx}>
                      <td className="text-muted">#{stats.events.length - idx}</td>
                      <td className="font-mono">{evt.fullDateStr || evt.timeStr}</td>
                      <td>
                        <span
                          className="table-status-pill"
                          style={{
                            backgroundColor: evt.state === 1 ? '#fef3c7' : '#f1f5f9',
                            color: evt.state === 1 ? '#b45309' : '#475569',
                            borderColor: evt.state === 1 ? '#fde68a' : '#e2e8f0'
                          }}
                        >
                          {evt.state === 1 ? '💡 Turned ON' : '🌑 Turned OFF'}
                        </span>
                      </td>
                      <td className="font-bold">
                        {evt.durationSincePrevMs > 0 ? evt.durationSincePrevFormatted : 'Initial state'}
                      </td>
                      <td className="text-muted" style={{ fontSize: '12px' }}>
                        IoT Switch / Web App / Gesture
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
