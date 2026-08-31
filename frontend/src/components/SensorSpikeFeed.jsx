import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Thermometer,
  Droplets,
  Cpu,
  ShieldAlert,
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Flame,
  Snowflake,
  RefreshCw,
  Clock,
  Sparkles,
  Bot,
  AlertTriangle,
  CheckCircle2,
  Activity,
  History,
  Compass,
  ArrowRight
} from 'lucide-react';
import { getThermalGuidance } from '../services/streamAnalytics';
import { fetchThermalHazardDiagnosis, fetchSpikeAiAnalysis } from '../services/api';

export default function SensorSpikeFeed({
  spikeAlerts = [],
  telemetry = {},
  analytics = {},
  history = {},
  onClearSpikes
}) {
  const [isFeedCollapsed, setIsFeedCollapsed] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'temperature' | 'humidity' | 'hubTemp'
  const [timeFilter, setTimeFilter] = useState('all'); // '1h' | '6h' | '12h' | '24h' | 'all'
  const [isGuidanceExpanded, setIsGuidanceExpanded] = useState(true);
  
  // Global AI Diagnosis State
  const [isAiDiagOpen, setIsAiDiagOpen] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // Per-Spike AI Analysis State: { [spikeId]: { data, loading } }
  const [spikeAiMap, setSpikeAiMap] = useState({});
  const [expandedSpikeAi, setExpandedSpikeAi] = useState({});

  const temperature = telemetry?.temperature ?? analytics?.avgTemp5m ?? 28.5;
  const humidity = telemetry?.humidity ?? 60.0;
  const hubTemp = telemetry?.hubTemp ?? 48.0;
  const trend = analytics?.trend || 'stable';
  const safeMode = Boolean(telemetry?.safeMode);
  const light1 = Boolean(telemetry?.light1);

  // Compute consecutive rising intervals from recent history
  const consecutiveRiseCount = useMemo(() => {
    const points = history?.tempHistory?.points || [];
    if (points.length < 2) return 1;
    let rises = 0;
    for (let i = points.length - 1; i >= 1; i--) {
      const curr = points[i].value;
      const prev = points[i - 1].value;
      if (typeof curr === 'number' && typeof prev === 'number' && curr > prev) {
        rises++;
      } else {
        break;
      }
    }
    return Math.max(1, rises);
  }, [history?.tempHistory?.points]);

  // Latest spike for guidance contextualization
  const latestSpike = spikeAlerts.length > 0 ? spikeAlerts[0] : null;

  // Compute live thermal guidance
  const guidance = useMemo(() => {
    return getThermalGuidance({
      temperature,
      trend,
      analytics,
      safeMode,
      light1,
      latestSpike
    });
  }, [temperature, trend, analytics, safeMode, light1, latestSpike]);

  // Global AI Diagnostic
  const runAiDiagnosis = async () => {
    setIsDiagnosing(true);
    try {
      const result = await fetchThermalHazardDiagnosis({
        temperature,
        humidity,
        hubTemp,
        consecutiveRiseCount,
        delta5m: +(temperature - (analytics?.avgTemp5m ?? temperature)).toFixed(2),
        safeMode,
        light1
      });
      setAiDiagnosis(result);
      setIsAiDiagOpen(true);
    } catch (err) {
      console.warn('Global AI Diagnosis failed:', err);
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Auto-run Global AI Diagnosis if critical heat threshold breached
  useEffect(() => {
    if (temperature > 32.0 && !aiDiagnosis) {
      runAiDiagnosis();
    }
  }, [temperature]);

  // Handler for individual Card AI Risk Analysis
  const handleAnalyzeSpike = async (spike) => {
    const spikeId = spike.id || `${spike.sensorType}-${spike.timeStr || ''}-${spike.delta}`;
    const isCurrentlyOpen = Boolean(expandedSpikeAi[spikeId]);

    // If already open, toggle close
    if (isCurrentlyOpen) {
      setExpandedSpikeAi(prev => ({ ...prev, [spikeId]: false }));
      return;
    }

    // Toggle open
    setExpandedSpikeAi(prev => ({ ...prev, [spikeId]: true }));

    // If already analyzed and cached, return
    if (spikeAiMap[spikeId]?.data) return;

    // Fetch AI Analysis from backend Groq LLM
    setSpikeAiMap(prev => ({ ...prev, [spikeId]: { loading: true, data: null } }));
    try {
      const analysis = await fetchSpikeAiAnalysis(spike, telemetry, history?.tempHistory?.points || []);
      setSpikeAiMap(prev => ({
        ...prev,
        [spikeId]: { loading: false, data: analysis }
      }));
    } catch (err) {
      console.warn('Per-spike AI analysis failed:', err);
      setSpikeAiMap(prev => ({
        ...prev,
        [spikeId]: { loading: false, data: null, error: 'Could not fetch AI analysis' }
      }));
    }
  };

  // Filtered spike list by Sensor Type AND Time Range
  const filteredSpikes = useMemo(() => {
    const now = Date.now();
    let timeCutoff = 0;
    if (timeFilter === '1h') timeCutoff = now - 1 * 3600 * 1000;
    else if (timeFilter === '6h') timeCutoff = now - 6 * 3600 * 1000;
    else if (timeFilter === '12h') timeCutoff = now - 12 * 3600 * 1000;
    else if (timeFilter === '24h') timeCutoff = now - 24 * 3600 * 1000;

    return spikeAlerts.filter(s => {
      // 1. Time Filter
      if (timeCutoff > 0) {
        const itemTs = s.timestamp ? new Date(s.timestamp).getTime() : now;
        if (itemTs < timeCutoff) return false;
      }
      // 2. Sensor Type Filter
      if (filterType !== 'all' && s.sensorType !== filterType) {
        return false;
      }
      return true;
    });
  }, [spikeAlerts, filterType, timeFilter]);

  const getMetricIcon = (sensorType) => {
    switch (sensorType) {
      case 'humidity':
        return <Droplets size={14} color="#0284c7" />;
      case 'hubTemp':
        return <Cpu size={14} color="#8b5cf6" />;
      default:
        return <Thermometer size={14} color="#ef4444" />;
    }
  };

  const tempCount = spikeAlerts.filter(s => s.sensorType === 'temperature').length;
  const humCount = spikeAlerts.filter(s => s.sensorType === 'humidity').length;
  const hubCount = spikeAlerts.filter(s => s.sensorType === 'hubTemp').length;

  return (
    <div className={`spike-feed-container ${isFeedCollapsed ? 'collapsed' : 'expanded'}`}>
      {/* 1. Main Feed Header Bar */}
      <div
        className="spike-feed-header clickable"
        onClick={() => setIsFeedCollapsed(!isFeedCollapsed)}
        title={isFeedCollapsed ? "Click to expand Real-Time Sensor Spike Anomaly Feed" : "Click to collapse feed"}
      >
        <div className="spike-feed-title-wrap">
          <div className="spike-pulse-beacon">
            <Zap size={18} className="spike-icon-flash" />
            <span className="pulse-ring"></span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 className="spike-feed-title">REAL-TIME SENSOR SPIKE ANOMALY FEED</h3>
              {isFeedCollapsed && (
                <span className="spike-collapsed-summary-pill">
                  {spikeAlerts.length} Anomaly Events Recorded • Stream Active
                </span>
              )}
            </div>
            <span className="spike-feed-subtitle">
              Continuous Sliding Window Stream Intelligence (Δ 2.0°C Temp / Δ 6% Humidity)
            </span>
          </div>
        </div>

        <div className="spike-feed-header-actions" onClick={(e) => e.stopPropagation()}>
          {!isFeedCollapsed && (
            <button
              className={`spike-ai-diag-btn ${isDiagnosing ? 'loading' : ''}`}
              onClick={runAiDiagnosis}
              title="Run Groq AI Fire vs Transient Thermal Assessment"
            >
              <Sparkles size={13} /> {isDiagnosing ? 'Analyzing...' : 'AI Hazard Diagnosis'}
            </button>
          )}

          <span className="spike-live-badge">
            <span className="live-dot-pulse"></span> Live
          </span>

          {!isFeedCollapsed && spikeAlerts.length > 0 && onClearSpikes && (
            <button
              className="spike-clear-btn"
              onClick={onClearSpikes}
              title="Clear Anomaly Feed History"
            >
              <RefreshCw size={13} /> Reset
            </button>
          )}

          {/* Full Section Collapse / Expand Button */}
          <button
            className="spike-full-collapse-btn"
            onClick={() => setIsFeedCollapsed(!isFeedCollapsed)}
            title={isFeedCollapsed ? "Expand Sensor Spike Anomaly Feed" : "Collapse Section"}
            aria-label={isFeedCollapsed ? "Expand Section" : "Collapse Section"}
          >
            {isFeedCollapsed ? (
              <><ChevronDown size={15} /> <span>Expand Section</span></>
            ) : (
              <><ChevronUp size={15} /> <span>Collapse</span></>
            )}
          </button>
        </div>
      </div>

      {/* When feed is NOT collapsed, display all child modules */}
      {!isFeedCollapsed && (
        <>
          {/* 2. Completely Collapsible Thermal Guidance & Directional Insights Card */}
      <div
        className={`thermal-guidance-card ${isGuidanceExpanded ? 'expanded' : 'collapsed'}`}
        style={{
          backgroundColor: guidance.bgColor,
          borderColor: guidance.borderColor
        }}
      >
        <div
          className="thermal-guidance-header clickable"
          onClick={() => setIsGuidanceExpanded(!isGuidanceExpanded)}
          title="Click to expand / collapse thermal intelligence section"
        >
          <div className="thermal-guidance-badge-row">
            <span
              className="thermal-badge"
              style={{ backgroundColor: guidance.badgeColor }}
            >
              {guidance.badge}
            </span>
            <span className="thermal-trend-pill">
              {trend === 'rising' ? (
                <><TrendingUp size={13} color="#dc2626" /> Rising Thermal Slope</>
              ) : trend === 'falling' ? (
                <><TrendingDown size={13} color="#0284c7" /> Falling / Dissipating</>
              ) : (
                <><ShieldCheck size={13} color="#10b981" /> Stable Equilibrium</>
              )}
            </span>
            {temperature > 35 && (
              <span className="thermal-actuation-pill danger">
                <ShieldAlert size={13} /> Safe Mode Auto-Locked
              </span>
            )}
            {temperature > 30 && (
              <span className="thermal-actuation-pill warning">
                <Flame size={13} /> Light 1 Cooling ON
              </span>
            )}
          </div>

          <div className="guidance-toggle-action">
            <span className="guidance-toggle-label">
              {isGuidanceExpanded ? 'Collapse' : 'Expand Details'}
            </span>
            <button
              className="guidance-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsGuidanceExpanded(!isGuidanceExpanded);
              }}
              aria-label="Toggle Guidance Details"
            >
              {isGuidanceExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Dynamic Expandable Content */}
        {isGuidanceExpanded && (
          <div className="thermal-guidance-content">
            <div className="guidance-main-info">
              <h4 className="guidance-title">{guidance.title}</h4>
              <p className="guidance-summary">{guidance.summary}</p>
            </div>

            <div className="guidance-deep-dive">
              <div className="guidance-box explanation">
                <strong><Info size={13} /> System State:</strong>
                <span>{guidance.statusExplanation}</span>
              </div>
              <div className="guidance-box action">
                <strong><ShieldCheck size={13} /> Recommended Action:</strong>
                <span>{guidance.guidance}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Global AI Thermal Hazard Diagnostic Card (Optional Expandable) */}
      {aiDiagnosis && isAiDiagOpen && (
        <div className={`ai-diag-card ${aiDiagnosis.category?.toLowerCase() || 'normal'}`}>
          <div className="ai-diag-header">
            <div className="ai-diag-title">
              <Bot size={16} className="ai-bot-icon" />
              <span>Orbit AI Thermal Hazard Assessment</span>
              <span className={`ai-risk-tag ${aiDiagnosis.riskLevel?.toLowerCase() || 'low'}`}>
                {aiDiagnosis.riskLevel || 'LOW'} RISK ({aiDiagnosis.fireProbability ?? 5}% Fire Probability)
              </span>
            </div>
            <button
              className="ai-diag-close"
              onClick={() => setIsAiDiagOpen(false)}
              aria-label="Close Diagnostic"
            >
              ×
            </button>
          </div>

          <div className="ai-diag-body">
            <div className="ai-diag-interval-badge">
              <Activity size={13} />
              <strong>Sequential Acceleration:</strong> {consecutiveRiseCount} Consecutive Rising Interval(s) Detected
            </div>
            <p className="ai-diag-summary">{aiDiagnosis.summary}</p>
            {aiDiagnosis.consecutiveSpikeAnalysis && (
              <p className="ai-diag-analysis">
                <strong>Interval Analysis:</strong> {aiDiagnosis.consecutiveSpikeAnalysis}
              </p>
            )}
            <div className="ai-diag-rec">
              <strong>💡 Actionable Recommendation:</strong> {aiDiagnosis.recommendation}
            </div>
          </div>
        </div>
      )}

      {/* 4. Filter Toolbar (Sensor Type + Time Window) */}
      <div className="spike-controls-bar">
        {/* Sensor Filter Chips */}
        <div className="spike-filter-bar">
          <button
            className={`spike-filter-chip ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All ({spikeAlerts.length})
          </button>
          <button
            className={`spike-filter-chip ${filterType === 'temperature' ? 'active' : ''}`}
            onClick={() => setFilterType('temperature')}
          >
            <Thermometer size={12} /> Temp ({tempCount})
          </button>
          <button
            className={`spike-filter-chip ${filterType === 'humidity' ? 'active' : ''}`}
            onClick={() => setFilterType('humidity')}
          >
            <Droplets size={12} /> Humidity ({humCount})
          </button>
          <button
            className={`spike-filter-chip ${filterType === 'hubTemp' ? 'active' : ''}`}
            onClick={() => setFilterType('hubTemp')}
          >
            <Cpu size={12} /> Hub Pi ({hubCount})
          </button>
        </div>

        {/* Time Window Selector */}
        <div className="spike-time-filter-wrap">
          <Clock size={13} className="time-filter-icon" />
          <div className="spike-time-pills">
            {['1h', '6h', '12h', '24h', 'all'].map((t) => (
              <button
                key={t}
                className={`time-pill-btn ${timeFilter === t ? 'active' : ''}`}
                onClick={() => setTimeFilter(t)}
              >
                {t === 'all' ? 'All Time' : t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Anomaly Feed Stream List with Individual AI Analysis on Every Card */}
      <div className="spike-alerts-list">
        {filteredSpikes.length > 0 ? (
          filteredSpikes.map((spike, idx) => {
            const isSurge = spike.direction === 'Surge' || spike.delta > 0;
            const spikeId = spike.id || `${spike.sensorType}-${spike.timeStr || ''}-${spike.delta}`;
            const isAiExpanded = Boolean(expandedSpikeAi[spikeId]);
            const aiData = spikeAiMap[spikeId]?.data;
            const isAiLoading = spikeAiMap[spikeId]?.loading;

            return (
              <div
                key={spikeId || idx}
                className={`spike-alert-chip ${isSurge ? 'surge' : 'drop'} ${isAiExpanded ? 'expanded-ai' : ''}`}
              >
                {/* Chip Top Meta Row */}
                <div className="spike-chip-top">
                  <div className="spike-chip-lead">
                    <span className="spike-time-tag">{spike.timeStr || 'Recent'}</span>
                    <div className="spike-metric-badge">
                      {getMetricIcon(spike.sensorType)}
                      <span>{spike.label || 'Sensor'}</span>
                    </div>
                  </div>

                  <div className="spike-chip-actions">
                    <button
                      className={`card-ai-btn ${isAiExpanded ? 'active' : ''} ${isAiLoading ? 'loading' : ''}`}
                      onClick={() => handleAnalyzeSpike(spike)}
                      title="Analyze past trajectory, future forecast, and fire risk with Groq AI"
                    >
                      <Sparkles size={12} className="ai-btn-sparkle" />
                      <span>{isAiLoading ? 'Forecasting...' : isAiExpanded ? 'Hide AI Risk' : 'AI Risk Analysis'}</span>
                    </button>

                    <span className={`delta-badge ${isSurge ? 'positive' : 'negative'}`}>
                      {spike.delta > 0 ? `+${spike.delta}` : spike.delta}{spike.unit || ''}
                    </span>
                  </div>
                </div>

                {/* Chip Message Body */}
                <div className="spike-chip-message">
                  {isSurge ? (
                    <Flame size={14} className="surge-icon" />
                  ) : (
                    <Snowflake size={14} className="drop-icon" />
                  )}
                  <span className="spike-text-body">{spike.message}</span>
                </div>

                {/* Individual Card AI Risk & Forecast Analysis Panel */}
                {isAiExpanded && (
                  <div className="spike-individual-ai-panel">
                    {isAiLoading ? (
                      <div className="ai-loading-box">
                        <Sparkles size={16} className="ai-spin-icon" />
                        <span>Evaluating environmental velocity, past precursors, and fire hazard projection...</span>
                      </div>
                    ) : aiData ? (
                      <div className="ai-forecast-grid">
                        {/* Risk Header Tag */}
                        <div className="ai-forecast-header">
                          <div className="ai-forecast-risk-pill">
                            <ShieldAlert size={14} />
                            <span>Risk Classification: <strong>{aiData.riskLevel || 'EVALUATED'}</strong></span>
                          </div>
                          {typeof aiData.fireProbability === 'number' && (
                            <span className={`ai-fire-prob-badge ${aiData.fireProbability > 50 ? 'danger' : aiData.fireProbability > 20 ? 'warning' : 'safe'}`}>
                              🔥 {aiData.fireProbability}% Fire Risk Index
                            </span>
                          )}
                        </div>

                        {/* Past Precursor vs Future Forecast 2-Col Grid */}
                        <div className="ai-past-future-grid">
                          <div className="ai-insight-box past">
                            <div className="box-lead">
                              <History size={13} />
                              <strong>Past Trajectory Analysis</strong>
                            </div>
                            <p>{aiData.pastAnalysis}</p>
                          </div>

                          <div className="ai-insight-box future">
                            <div className="box-lead">
                              <Compass size={13} />
                              <strong>Future 5–15m Forecast</strong>
                            </div>
                            <p>{aiData.futureForecast}</p>
                          </div>
                        </div>

                        {/* Actionable Safety Advice */}
                        <div className="ai-safety-advice-box">
                          <strong>💡 Actionable Homeowner Guidance:</strong>
                          <span>{aiData.safetyAdvice}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="ai-error-box">
                        <span>Could not complete online analysis. Standard automatic thresholds remain active.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="spike-empty-state">
            <ShieldCheck size={26} className="empty-shield-icon" />
            <div className="empty-state-text">
              <span className="empty-title">
                {filterType === 'all' && timeFilter === 'all'
                  ? 'All Sensor Streams Operating in Steady State'
                  : `No anomalies recorded for selected filter (${filterType.toUpperCase()} • ${timeFilter.toUpperCase()})`}
              </span>
              <span className="empty-subtitle">
                Apache Flink sliding window stream processor is actively monitoring sensor frames for abrupt velocity changes (≥ 2.0°C / ≥ 6.0%).
              </span>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
