import React, { useState } from 'react';
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
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  Cpu,
  Thermometer,
  Droplets,
  Battery,
  Flame,
  Activity,
  Zap,
  Info,
  Maximize2
} from 'lucide-react';
import { compute5mWindowMetrics } from '../services/streamAnalytics';
import MetricDetailModal from '../components/MetricDetailModal';

// Register ChartJS modules
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

export default function AnalyticsPage({ history, analytics, spikeAlerts = [], telemetry = {} }) {
  const { tempHistory, humHistory, btryHistory, pitempHistory } = history;
  const [selectedMetric, setSelectedMetric] = useState(null);

  // 1. Compute Live 5-Minute Sliding Window Metrics for Room Temperature
  const room5mMetrics = compute5mWindowMetrics(
    tempHistory?.points && tempHistory.points.length > 0 ? tempHistory.points : tempHistory?.values,
    analytics?.avgTemp5m ?? 28.5
  );

  // 2. Compute Live 5-Minute Sliding Window Metrics for Hub Pi Temperature
  const hub5mMetrics = compute5mWindowMetrics(
    pitempHistory?.points && pitempHistory.points.length > 0 ? pitempHistory.points : pitempHistory?.values,
    analytics?.hubAvgTemp5m ?? 46.5
  );

  const roomAvg5m = room5mMetrics.avgTemp5m;
  const isRoomHot = roomAvg5m > 30;
  const isHubHot = hub5mMetrics.avgTemp5m > 55;

  // Dynamic Chart Data Builders with Value-based Dynamic Segment Colors

  // 1. Temperature Chart: > 30°C => Red (#ef4444), <= 30°C => Green (#10b981)
  const createTempChartData = () => {
    const values = tempHistory?.values?.length ? tempHistory.values : [26, 27, 28, 27.5, 29];
    const labels = tempHistory?.labels?.length ? tempHistory.labels : ['1', '2', '3', '4', '5'];
    const pointBgColors = values.map(v => (v > 30 ? '#ef4444' : '#10b981'));
    const pointBorderColors = values.map(v => (v > 30 ? '#b91c1c' : '#047857'));

    return {
      labels,
      datasets: [
        {
          label: 'Room Temperature',
          data: values,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          segment: {
            borderColor: (ctx) => {
              const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
              return val > 30 ? '#ef4444' : '#10b981';
            },
            backgroundColor: (ctx) => {
              const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
              return val > 30 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
            }
          },
          pointBackgroundColor: pointBgColors,
          pointBorderColor: pointBorderColors,
          pointRadius: 4,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.35
        }
      ]
    };
  };

  // 2. Humidity Chart: Optimal 30%-70% => Blue (#0ea5e9), >70% => Red (#ef4444), <30% => Amber (#f59e0b)
  const createHumidityChartData = () => {
    const values = humHistory?.values?.length ? humHistory.values : [45, 48, 50, 52, 49];
    const labels = humHistory?.labels?.length ? humHistory.labels : ['1', '2', '3', '4', '5'];
    const pointBgColors = values.map(v => (v > 70 ? '#ef4444' : (v < 30 ? '#f59e0b' : '#0ea5e9')));

    return {
      labels,
      datasets: [
        {
          label: 'Humidity',
          data: values,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.12)',
          segment: {
            borderColor: (ctx) => {
              const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
              if (val > 70) return '#ef4444';
              if (val < 30) return '#f59e0b';
              return '#0ea5e9';
            },
            backgroundColor: (ctx) => {
              const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
              if (val > 70) return 'rgba(239, 68, 68, 0.15)';
              if (val < 30) return 'rgba(245, 158, 11, 0.15)';
              return 'rgba(14, 165, 233, 0.15)';
            }
          },
          pointBackgroundColor: pointBgColors,
          pointBorderColor: pointBgColors,
          pointRadius: 4,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.35
        }
      ]
    };
  };

  // 3. Battery Chart: >60% => Green (#10b981), 30%-60% => Amber (#f59e0b), <30% => Red (#ef4444)
  const createBatteryChartData = () => {
    const values = btryHistory?.values?.length ? btryHistory.values : [95, 95, 94, 94, 93];
    const labels = btryHistory?.labels?.length ? btryHistory.labels : ['1', '2', '3', '4', '5'];
    const pointBgColors = values.map(v => (v < 30 ? '#ef4444' : (v < 60 ? '#f59e0b' : '#10b981')));

    return {
      labels,
      datasets: [
        {
          label: 'Battery Level',
          data: values,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          segment: {
            borderColor: (ctx) => {
              const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
              if (val < 30) return '#ef4444';
              if (val < 60) return '#f59e0b';
              return '#10b981';
            },
            backgroundColor: (ctx) => {
              const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
              if (val < 30) return 'rgba(239, 68, 68, 0.15)';
              if (val < 60) return 'rgba(245, 158, 11, 0.15)';
              return 'rgba(16, 185, 129, 0.15)';
            }
          },
          pointBackgroundColor: pointBgColors,
          pointBorderColor: pointBgColors,
          pointRadius: 4,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.35
        }
      ]
    };
  };

  // 4. Hub Pi Temp Chart: > 55°C => Red (#ef4444), <= 55°C => Purple (#8b5cf6)
  const createHubTempChartData = () => {
    const values = pitempHistory?.values?.length ? pitempHistory.values : [46, 46.5, 47, 46.8, 47.2];
    const labels = pitempHistory?.labels?.length ? pitempHistory.labels : ['1', '2', '3', '4', '5'];
    const pointBgColors = values.map(v => (v > 55 ? '#ef4444' : '#8b5cf6'));

    return {
      labels,
      datasets: [
        {
          label: 'Hub Pi Temperature',
          data: values,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.12)',
          segment: {
            borderColor: (ctx) => {
              const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
              return val > 55 ? '#ef4444' : '#8b5cf6';
            },
            backgroundColor: (ctx) => {
              const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
              return val > 55 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 92, 246, 0.15)';
            }
          },
          pointBackgroundColor: pointBgColors,
          pointBorderColor: pointBgColors,
          pointRadius: 4,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.35
        }
      ]
    };
  };

  const chartOptions = (unit, thresholdVal = null) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a202c',
        padding: 10,
        cornerRadius: 8,
        titleFont: { size: 12 },
        bodyFont: { size: 14, weight: 'bold' },
        callbacks: {
          label: (context) => {
            const val = context.parsed.y;
            let note = '';
            if (unit === '°C') {
              note = val > 30 ? ' (🔴 Elevated >30°C)' : ' (🟢 Optimal ≤30°C)';
            }
            return `${val} ${unit}${note}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#718096', font: { size: 11 } }
      },
      y: {
        grid: { color: '#edf2f7' },
        ticks: {
          color: '#718096',
          font: { size: 11 },
          callback: (val) => `${val}${unit}`
        }
      }
    }
  });

  const getTrendIcon = (trend) => {
    if (trend === 'rising') return <TrendingUp size={18} color="#feb2b2" />;
    if (trend === 'falling') return <TrendingDown size={18} color="#90cdf4" />;
    return <Minus size={18} color="#e2e8f0" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Sudden Spike Alert Notifications Banner (if active spikes detected) */}
      {spikeAlerts && spikeAlerts.length > 0 && (
        <div className="spike-alerts-container">
          <div className="spike-alerts-header">
            <Zap size={18} className="spike-flash-icon" />
            <span className="spike-alerts-title">Real-Time Sensor Spike Anomaly Feed</span>
          </div>
          <div className="spike-alerts-list">
            {spikeAlerts.slice(-3).reverse().map((spike, idx) => (
              <div key={idx} className="spike-alert-chip">
                <span className="spike-time">{spike.timeStr || 'Now'}</span>
                <span className="spike-body">{spike.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apache Flink Stream Engine Banner: 5-Minute Window Real-Time Analytics */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)',
        color: 'white',
        padding: '24px 28px',
        borderRadius: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        boxShadow: '0 12px 30px rgba(124, 58, 237, 0.28)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow accent */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '160px',
          height: '160px',
          background: 'rgba(255, 255, 255, 0.12)',
          borderRadius: '50%',
          filter: 'blur(20px)',
          pointerEvents: 'none'
        }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.4px', opacity: 0.9, fontWeight: 700 }}>
              ⚡ Apache Flink Stream Processor Engine
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '2px', letterSpacing: '-0.5px' }}>
              5-Minute Tumbling & Sliding Window Analytics
            </div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.18)',
            backdropFilter: 'blur(8px)',
            padding: '7px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid rgba(255, 255, 255, 0.25)'
          }}>
            <Cpu size={15} /> Real-Time Sliding Window Active
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '16px',
          background: 'rgba(0, 0, 0, 0.18)',
          padding: '18px',
          borderRadius: '14px',
          backdropFilter: 'blur(6px)'
        }}>
          {/* Room Temp 5m Avg (COMPUTED IN REAL-TIME - Clickable) */}
          <div
            className="flink-metric-tile"
            onClick={() => setSelectedMetric('temperature')}
            title="Click to expand 24h Temperature Analytics"
          >
            <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.85, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Thermometer size={14} /> Room 5m Rolling Avg
              </span>
              <Maximize2 size={12} style={{ opacity: 0.7 }} />
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 800,
              color: isRoomHot ? '#fed7d7' : '#9ae6b4',
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px'
            }}>
              <span>{roomAvg5m}°C</span>
              <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.9 }}>
                {isRoomHot ? '(🔴 >30°C)' : '(🟢 Normal)'}
              </span>
            </div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              Min: {room5mMetrics.minTemp}°C | Max: {room5mMetrics.maxTemp}°C • ({room5mMetrics.sampleCount} pts in 5m)
            </div>
          </div>

          {/* Hub Pi 5m Avg (Clickable) */}
          <div
            className="flink-metric-tile"
            onClick={() => setSelectedMetric('hubTemp')}
            title="Click to expand 24h Hub Pi Thermal Analytics"
          >
            <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.85, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Cpu size={14} /> Hub Pi 5m Rolling Avg
              </span>
              <Maximize2 size={12} style={{ opacity: 0.7 }} />
            </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 800,
              color: isHubHot ? '#fed7d7' : 'white',
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px'
            }}>
              <span>{hub5mMetrics.avgTemp5m}°C</span>
              <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.9 }}>
                {isHubHot ? '(⚠️ Hot)' : '(Optimal)'}
              </span>
            </div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              Min: {hub5mMetrics.minTemp}°C | Max: {hub5mMetrics.maxTemp}°C
            </div>
          </div>

          {/* Hub Thermal Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.85, fontWeight: 600 }}>
              Hub Thermal Health
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px', color: isHubHot ? '#fed7d7' : '#9ae6b4' }}>
              {isHubHot ? '⚠️ Elevated (>55°C)' : '✅ Optimal (<55°C)'}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              Throttling Risk: {isHubHot ? 'Moderate' : 'None (Cool)'}
            </div>
          </div>

          {/* Room Temp Trend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.85, fontWeight: 600 }}>
              Temperature Trend (5m)
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {getTrendIcon(room5mMetrics.trend)}
              <span style={{ textTransform: 'capitalize' }}>{room5mMetrics.trend || 'Stable'}</span>
            </div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              Std Dev: ±{room5mMetrics.stdDev}°C
            </div>
          </div>

          {/* Anomaly Spike State */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.85, fontWeight: 600 }}>
              Stream Anomaly Status
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {room5mMetrics.anomalyDetected ? (
                <span style={{ color: '#feb2b2', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldAlert size={16} /> Thermal Deviation Spike!
                </span>
              ) : (
                <span style={{ color: '#9ae6b4' }}>🟢 Stream Stable</span>
              )}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>
              Spike Threshold: Δ 2.0°C / Δ 6%
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Telemetry Graphs Grid */}
      <div className="dashboard-grid">
        {/* 1. Temperature Chart with Dynamic Threshold Coloring */}
        <div
          className="card chart-card clickable"
          onClick={() => setSelectedMetric('temperature')}
          title="Click to view 24-hour expanded graph, max/min/avg stats & log"
        >
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="card-title">Room Temperature History</h3>
                <span className="card-expand-badge">
                  <Maximize2 size={12} /> Expand 24h
                </span>
              </div>
              <span className="card-subtitle">Real-time dynamic threshold color-coded stream</span>
            </div>
            <Thermometer size={24} color={isRoomHot ? '#ef4444' : '#10b981'} />
          </div>

          <div style={{ height: '220px' }}>
            <Line
              data={createTempChartData()}
              options={chartOptions('°C', 30)}
            />
          </div>

          {/* Threshold Color Legend */}
          <div className="chart-threshold-legend">
            <span className="legend-chip normal">
              <span className="legend-dot green"></span>
              <span>≤ 30°C (Normal / Green)</span>
            </span>
            <span className="legend-chip alert">
              <span className="legend-dot red"></span>
              <span>&gt; 30°C (High Alert / Red)</span>
            </span>
          </div>
        </div>

        {/* 2. Humidity Chart with Dynamic Threshold Coloring */}
        <div
          className="card chart-card clickable"
          onClick={() => setSelectedMetric('humidity')}
          title="Click to view 24-hour expanded graph, max/min/avg stats & log"
        >
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="card-title">Humidity History</h3>
                <span className="card-expand-badge">
                  <Maximize2 size={12} /> Expand 24h
                </span>
              </div>
              <span className="card-subtitle">Optimal range 30% - 70%</span>
            </div>
            <Droplets size={24} color="#0ea5e9" />
          </div>

          <div style={{ height: '220px' }}>
            <Line
              data={createHumidityChartData()}
              options={chartOptions('%')}
            />
          </div>

          {/* Threshold Color Legend */}
          <div className="chart-threshold-legend">
            <span className="legend-chip normal">
              <span className="legend-dot blue"></span>
              <span>30% - 70% (Optimal)</span>
            </span>
            <span className="legend-chip alert">
              <span className="legend-dot red"></span>
              <span>&gt; 70% High / &lt; 30% Dry</span>
            </span>
          </div>
        </div>

        {/* 3. Sensor Battery Level Chart */}
        <div
          className="card chart-card clickable"
          onClick={() => setSelectedMetric('battery')}
          title="Click to view 24-hour expanded graph, max/min/avg stats & log"
        >
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="card-title">Sensor Battery Level</h3>
                <span className="card-expand-badge">
                  <Maximize2 size={12} /> Expand 24h
                </span>
              </div>
              <span className="card-subtitle">Health threshold monitoring</span>
            </div>
            <Battery size={24} color="#10b981" />
          </div>

          <div style={{ height: '220px' }}>
            <Line
              data={createBatteryChartData()}
              options={chartOptions('%')}
            />
          </div>

          {/* Threshold Color Legend */}
          <div className="chart-threshold-legend">
            <span className="legend-chip normal">
              <span className="legend-dot green"></span>
              <span>&gt; 60% (Good)</span>
            </span>
            <span className="legend-chip warning">
              <span className="legend-dot amber"></span>
              <span>30% - 60% (Moderate)</span>
            </span>
            <span className="legend-chip alert">
              <span className="legend-dot red"></span>
              <span>&lt; 30% (Critical)</span>
            </span>
          </div>
        </div>

        {/* 4. Hub Pi CPU Temperature Chart */}
        <div
          className="card chart-card clickable"
          onClick={() => setSelectedMetric('hubTemp')}
          title="Click to view 24-hour expanded graph, max/min/avg stats & log"
        >
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="card-title">Hub Pi CPU Temperature</h3>
                <span className="card-expand-badge">
                  <Maximize2 size={12} /> Expand 24h
                </span>
              </div>
              <span className="card-subtitle">Thermal throttling threshold 55°C</span>
            </div>
            <Cpu size={24} color={isHubHot ? '#ef4444' : '#8b5cf6'} />
          </div>

          <div style={{ height: '220px' }}>
            <Line
              data={createHubTempChartData()}
              options={chartOptions('°C', 55)}
            />
          </div>

          {/* Threshold Color Legend */}
          <div className="chart-threshold-legend">
            <span className="legend-chip purple">
              <span className="legend-dot purple"></span>
              <span>≤ 55°C (Cool & Optimal)</span>
            </span>
            <span className="legend-chip alert">
              <span className="legend-dot red"></span>
              <span>&gt; 55°C (Throttling Warning)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Expanded 24-Hour Modal / Pop-Up View */}
      {selectedMetric && (
        <MetricDetailModal
          metricKey={selectedMetric}
          historyData={
            selectedMetric === 'temperature' ? tempHistory :
            selectedMetric === 'humidity' ? humHistory :
            selectedMetric === 'battery' ? btryHistory :
            selectedMetric === 'hubTemp' ? pitempHistory : {}
          }
          liveValue={
            selectedMetric === 'temperature' ? telemetry?.temperature :
            selectedMetric === 'humidity' ? telemetry?.humidity :
            selectedMetric === 'battery' ? telemetry?.battery :
            selectedMetric === 'hubTemp' ? telemetry?.hubTemp : null
          }
          onClose={() => setSelectedMetric(null)}
        />
      )}
    </div>
  );
}
