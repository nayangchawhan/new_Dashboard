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
  Thermometer,
  Droplets,
  Battery,
  Cpu,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Calendar,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Table as TableIcon,
  BarChart3
} from 'lucide-react';
import { compute24hStats } from '../services/firebase';

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

const METRIC_CONFIGS = {
  temperature: {
    title: 'Room Temperature History',
    subtitle: 'Real-time & 24-Hour continuous environmental thermal monitoring',
    unit: '°C',
    icon: Thermometer,
    primaryColor: '#10b981',
    alertColor: '#ef4444',
    bgGradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    thresholdVal: 30,
    normalLegend: '≤ 30°C (Normal / Green)',
    alertLegend: '> 30°C (High Alert / Red)',
    idealNote: 'Optimal indoor living range: 20°C – 26°C',
    classify: (val) => (val > 30 ? { label: 'High Alert', color: '#ef4444', isAlert: true } : { label: 'Normal', color: '#10b981', isAlert: false }),
    getSegmentColors: () => ({
      borderColor: (ctx) => {
        const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
        return val > 30 ? '#ef4444' : '#10b981';
      },
      backgroundColor: (ctx) => {
        const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
        return val > 30 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)';
      }
    })
  },
  humidity: {
    title: 'Relative Humidity History',
    subtitle: 'Ambient moisture saturation with dry, optimal, and high alert detection',
    unit: '%',
    icon: Droplets,
    primaryColor: '#0ea5e9',
    alertColor: '#ef4444',
    bgGradient: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
    thresholdVal: 70,
    normalLegend: '30% – 70% (Optimal Range)',
    alertLegend: '> 70% High / < 30% Dry',
    idealNote: 'Recommended comfort range: 40% – 60%',
    classify: (val) => {
      if (val > 70) return { label: 'High Humidity', color: '#ef4444', isAlert: true };
      if (val < 30) return { label: 'Dry Air', color: '#f59e0b', isAlert: true };
      return { label: 'Optimal', color: '#0ea5e9', isAlert: false };
    },
    getSegmentColors: () => ({
      borderColor: (ctx) => {
        const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
        if (val > 70) return '#ef4444';
        if (val < 30) return '#f59e0b';
        return '#0ea5e9';
      },
      backgroundColor: (ctx) => {
        const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
        if (val > 70) return 'rgba(239, 68, 68, 0.18)';
        if (val < 30) return 'rgba(245, 158, 11, 0.18)';
        return 'rgba(14, 165, 233, 0.18)';
      }
    })
  },
  battery: {
    title: 'Sensor Battery Level History',
    subtitle: 'Discharge lifecycle & power level health monitoring',
    unit: '%',
    icon: Battery,
    primaryColor: '#10b981',
    alertColor: '#ef4444',
    bgGradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    thresholdVal: 30,
    normalLegend: '> 60% (Healthy)',
    alertLegend: '< 30% (Critical Alert)',
    idealNote: 'Recharge or replace battery when level falls below 30%',
    classify: (val) => {
      if (val < 30) return { label: 'Critical Low', color: '#ef4444', isAlert: true };
      if (val < 60) return { label: 'Moderate', color: '#f59e0b', isAlert: false };
      return { label: 'Healthy', color: '#10b981', isAlert: false };
    },
    getSegmentColors: () => ({
      borderColor: (ctx) => {
        const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
        if (val < 30) return '#ef4444';
        if (val < 60) return '#f59e0b';
        return '#10b981';
      },
      backgroundColor: (ctx) => {
        const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
        if (val < 30) return 'rgba(239, 68, 68, 0.18)';
        if (val < 60) return 'rgba(245, 158, 11, 0.18)';
        return 'rgba(16, 185, 129, 0.18)';
      }
    })
  },
  hubTemp: {
    title: 'Hub Pi CPU Temperature History',
    subtitle: 'Raspberry Pi System-on-Chip thermal performance & clock throttling monitor',
    unit: '°C',
    icon: Cpu,
    primaryColor: '#8b5cf6',
    alertColor: '#ef4444',
    bgGradient: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
    thresholdVal: 55,
    normalLegend: '≤ 55°C (Cool & Optimal)',
    alertLegend: '> 55°C (Throttling Warning)',
    idealNote: 'Keep SoC under 55°C to avoid hardware thermal throttling',
    classify: (val) => (val > 55 ? { label: 'Thermal Warning', color: '#ef4444', isAlert: true } : { label: 'Cool & Optimal', color: '#8b5cf6', isAlert: false }),
    getSegmentColors: () => ({
      borderColor: (ctx) => {
        const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
        return val > 55 ? '#ef4444' : '#8b5cf6';
      },
      backgroundColor: (ctx) => {
        const val = ctx.p1?.parsed?.y ?? ctx.p0?.parsed?.y ?? 0;
        return val > 55 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(139, 92, 246, 0.18)';
      }
    })
  }
};

export default function MetricDetailModal({
  metricKey = 'temperature',
  historyData = {},
  liveValue = null,
  onClose
}) {
  const [timeRangeHours, setTimeRangeHours] = useState(24);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'hourly' | 'table'

  const config = METRIC_CONFIGS[metricKey] || METRIC_CONFIGS.temperature;
  const MetricIcon = config.icon;

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent background body scrolling while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Compute 24-hour / selected time range statistics
  const stats = useMemo(() => {
    const all = historyData?.allPoints && historyData.allPoints.length > 0
      ? historyData.allPoints
      : (historyData?.points || []);
    return compute24hStats(all, timeRangeHours);
  }, [historyData, timeRangeHours]);

  const displayCurrent = liveValue !== null && liveValue !== undefined ? liveValue : stats.current;
  const currentStatus = config.classify(displayCurrent);

  // Calculate percentage in normal vs alert thresholds
  const thresholdBreakdown = useMemo(() => {
    if (!stats.filteredPoints.length) return { normalPct: 100, alertPct: 0, normalCount: 0, alertCount: 0 };
    let normalCount = 0;
    let alertCount = 0;

    stats.filteredPoints.forEach(p => {
      const c = config.classify(p.value);
      if (c.isAlert) alertCount++;
      else normalCount++;
    });

    const total = stats.filteredPoints.length;
    return {
      normalPct: Math.round((normalCount / total) * 100),
      alertPct: Math.round((alertCount / total) * 100),
      normalCount,
      alertCount
    };
  }, [stats.filteredPoints, config]);

  // Build high-resolution Chart.js dataset for expanded view
  const chartData = useMemo(() => {
    const pts = stats.filteredPoints;
    const labels = pts.map(p => p.timeStr || `#${p.index}`);
    const values = pts.map(p => p.value);
    const pointBgColors = values.map(v => config.classify(v).color);
    const segmentColors = config.getSegmentColors();

    return {
      labels,
      datasets: [
        {
          label: config.title,
          data: values,
          borderColor: config.primaryColor,
          backgroundColor: `${config.primaryColor}22`,
          segment: segmentColors,
          pointBackgroundColor: pointBgColors,
          pointBorderColor: pointBgColors,
          pointRadius: pts.length > 60 ? 2 : 4,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.3
        }
      ]
    };
  }, [stats.filteredPoints, config]);

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
        bodyFont: { size: 15, weight: 'bold' },
        callbacks: {
          title: (items) => {
            if (!items.length) return '';
            const idx = items[0].dataIndex;
            const pt = stats.filteredPoints[idx];
            return pt?.fullDateStr || items[0].label;
          },
          label: (context) => {
            const val = context.parsed.y;
            const classification = config.classify(val);
            return ` ${config.title}: ${val} ${config.unit} • [${classification.label}]`;
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
          maxTicksLimit: 12
        }
      },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          callback: (val) => `${val}${config.unit}`
        }
      }
    }
  };

  // Export Data to CSV function
  const handleExportCSV = () => {
    const pts = stats.filteredPoints;
    if (!pts.length) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Timestamp,Date_Time,Metric,Value,Unit,Status\n';

    pts.forEach(p => {
      const classification = config.classify(p.value);
      const row = [
        p.timestamp,
        `"${p.fullDateStr || p.timeStr}"`,
        `"${config.title}"`,
        p.value,
        config.unit,
        `"${classification.label}"`
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${metricKey}_24h_telemetry_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="metric-modal-backdrop" onClick={onClose}>
      <div className="metric-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Header Bar */}
        <div className="metric-modal-header">
          <div className="metric-modal-header-left">
            <div className="metric-modal-icon-badge" style={{ background: config.bgGradient }}>
              <MetricIcon size={24} color="#ffffff" />
            </div>
            <div>
              <div className="metric-modal-title-row">
                <h2 className="metric-modal-title">{config.title}</h2>
                <span
                  className="metric-modal-status-badge"
                  style={{
                    backgroundColor: `${currentStatus.color}18`,
                    color: currentStatus.color,
                    borderColor: `${currentStatus.color}40`
                  }}
                >
                  <span className="live-pulse-dot" style={{ backgroundColor: currentStatus.color }}></span>
                  {currentStatus.label} ({displayCurrent}{config.unit})
                </span>
              </div>
              <p className="metric-modal-subtitle">{config.subtitle}</p>
            </div>
          </div>

          <div className="metric-modal-header-right">
            {/* Time Range Selector Filter */}
            <div className="time-range-pills">
              {[
                { label: '1 Hr', hours: 1 },
                { label: '6 Hrs', hours: 6 },
                { label: '12 Hrs', hours: 12 },
                { label: '24 Hrs', hours: 24 },
                { label: 'All Data', hours: 0 }
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

        {/* 24h Summary Stat Cards Grid */}
        <div className="modal-stats-grid">
          {/* 1. 24h Average */}
          <div className="modal-stat-card">
            <div className="modal-stat-header">
              <span className="modal-stat-label">24h Average Value</span>
              <Activity size={16} className="modal-stat-icon text-indigo" />
            </div>
            <div className="modal-stat-value">
              <span>{stats.avg}</span>
              <span className="modal-stat-unit">{config.unit}</span>
            </div>
            <div className="modal-stat-sub">
              Volatile Std Dev: ±{stats.stdDev}{config.unit}
            </div>
          </div>

          {/* 2. 24h Maximum */}
          <div className="modal-stat-card">
            <div className="modal-stat-header">
              <span className="modal-stat-label">24h Maximum Peak</span>
              <ArrowUpRight size={16} className="modal-stat-icon text-rose" />
            </div>
            <div className="modal-stat-value text-rose">
              <span>{stats.max}</span>
              <span className="modal-stat-unit">{config.unit}</span>
            </div>
            <div className="modal-stat-sub">
              Peak at: {stats.maxPoint?.timeStr || 'Recorded today'}
            </div>
          </div>

          {/* 3. 24h Minimum */}
          <div className="modal-stat-card">
            <div className="modal-stat-header">
              <span className="modal-stat-label">24h Minimum Valley</span>
              <ArrowDownRight size={16} className="modal-stat-icon text-emerald" />
            </div>
            <div className="modal-stat-value text-emerald">
              <span>{stats.min}</span>
              <span className="modal-stat-unit">{config.unit}</span>
            </div>
            <div className="modal-stat-sub">
              Lowest at: {stats.minPoint?.timeStr || 'Recorded today'}
            </div>
          </div>

          {/* 4. Total Readings Count */}
          <div className="modal-stat-card">
            <div className="modal-stat-header">
              <span className="modal-stat-label">Window Sample Count</span>
              <Clock size={16} className="modal-stat-icon text-sky" />
            </div>
            <div className="modal-stat-value">
              <span>{stats.count}</span>
              <span className="modal-stat-unit">pts</span>
            </div>
            <div className="modal-stat-sub">
              Delta Span: Δ {stats.delta}{config.unit}
            </div>
          </div>
        </div>

        {/* View Navigation Tabs & Actions */}
        <div className="modal-tabs-bar">
          <div className="modal-tabs-left">
            <button
              className={`modal-tab-btn ${activeTab === 'chart' ? 'active' : ''}`}
              onClick={() => setActiveTab('chart')}
            >
              <Activity size={16} /> 24-Hour Graph View
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'hourly' ? 'active' : ''}`}
              onClick={() => setActiveTab('hourly')}
            >
              <BarChart3 size={16} /> Hourly Breakdown
            </button>
            <button
              className={`modal-tab-btn ${activeTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveTab('table')}
            >
              <TableIcon size={16} /> Data Records Log ({stats.count})
            </button>
          </div>

          <button className="modal-export-btn" onClick={handleExportCSV}>
            <Download size={15} /> Export Dataset (CSV)
          </button>
        </div>

        {/* Tab 1: High-Definition Chart View */}
        {activeTab === 'chart' && (
          <div className="modal-tab-content">
            <div className="modal-chart-box">
              <div style={{ height: '340px', width: '100%' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Threshold Legend & Compliance Bar */}
            <div className="modal-compliance-card">
              <div className="modal-compliance-header">
                <span className="compliance-title">24-Hour Stream Threshold Compliance</span>
                <span className="compliance-note">{config.idealNote}</span>
              </div>

              <div className="compliance-progress-bar">
                <div
                  className="progress-segment normal"
                  style={{ width: `${thresholdBreakdown.normalPct}%` }}
                  title={`Normal: ${thresholdBreakdown.normalPct}%`}
                ></div>
                <div
                  className="progress-segment alert"
                  style={{ width: `${thresholdBreakdown.alertPct}%` }}
                  title={`Alert: ${thresholdBreakdown.alertPct}%`}
                ></div>
              </div>

              <div className="compliance-legend-row">
                <div className="compliance-chip">
                  <span className="legend-dot green"></span>
                  <span>{config.normalLegend}: <strong>{thresholdBreakdown.normalPct}%</strong> ({thresholdBreakdown.normalCount} samples)</span>
                </div>
                <div className="compliance-chip">
                  <span className="legend-dot red"></span>
                  <span>{config.alertLegend}: <strong>{thresholdBreakdown.alertPct}%</strong> ({thresholdBreakdown.alertCount} samples)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Hourly Breakdown Grid */}
        {activeTab === 'hourly' && (
          <div className="modal-tab-content">
            <div className="hourly-breakdown-container">
              <div className="hourly-summary-header">
                <h3>Hourly Average & Peak Aggregations</h3>
                <span>Aggregated hourly windows from IoT telemetry timestamps</span>
              </div>

              {stats.hourlyBuckets.length === 0 ? (
                <div className="empty-tab-state">No hourly buckets available for this time range.</div>
              ) : (
                <div className="hourly-grid">
                  {stats.hourlyBuckets.map((bucket, idx) => {
                    const status = config.classify(bucket.avg);
                    return (
                      <div key={idx} className="hourly-card">
                        <div className="hourly-card-top">
                          <span className="hourly-time">{bucket.hourLabel}</span>
                          <span className="hourly-samples-tag">{bucket.count} readings</span>
                        </div>
                        <div className="hourly-avg-row">
                          <span className="hourly-avg-val" style={{ color: status.color }}>
                            {bucket.avg}{config.unit}
                          </span>
                          <span className="hourly-status-tag" style={{ color: status.color, background: `${status.color}15` }}>
                            {status.label}
                          </span>
                        </div>
                        <div className="hourly-minmax-row">
                          <span>Min: <strong>{bucket.min}{config.unit}</strong></span>
                          <span>Max: <strong>{bucket.max}{config.unit}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Historical Records Table */}
        {activeTab === 'table' && (
          <div className="modal-tab-content">
            <div className="table-wrapper-box">
              <table className="modal-data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date & Time</th>
                    <th>Reading Value</th>
                    <th>Threshold Status</th>
                    <th>Variance from 24h Avg ({stats.avg}{config.unit})</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.filteredPoints.slice().reverse().slice(0, 100).map((pt, idx) => {
                    const status = config.classify(pt.value);
                    const diff = +(pt.value - stats.avg).toFixed(2);
                    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
                    return (
                      <tr key={pt.key || idx}>
                        <td className="text-muted">#{stats.filteredPoints.length - idx}</td>
                        <td className="font-mono">{pt.fullDateStr || pt.timeStr}</td>
                        <td className="font-bold">
                          <span style={{ color: status.color }}>
                            {pt.value} {config.unit}
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-status-pill"
                            style={{
                              backgroundColor: `${status.color}18`,
                              color: status.color,
                              borderColor: `${status.color}35`
                            }}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className={diff > 0 ? 'text-rose' : diff < 0 ? 'text-sky' : 'text-muted'}>
                          {diffStr} {config.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {stats.filteredPoints.length > 100 && (
                <div className="table-footer-notice">
                  Showing latest 100 of {stats.filteredPoints.length} total records. Use the "Export Dataset" button to download all records.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
