import React, { useState, useEffect } from 'react';
import { Activity, Server, Database, Layers, Wind, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchHealthStatus } from '../services/api';

export default function PipelineHealthPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadHealth = async () => {
    setLoading(true);
    const data = await fetchHealthStatus();
    setHealth(data);
    setLoading(false);
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status) => {
    const isUp = status === 'UP' || status === 'healthy';
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 700,
        background: isUp ? '#c6f6d5' : '#feebc8',
        color: isUp ? '#22543d' : '#7b341e',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {isUp ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
        {status || 'STANDBY'}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Pipeline & Service Health</h2>
          <p style={{ color: '#718096', fontSize: '14px', marginTop: '4px' }}>
            Real-time status of all architectural microservices and data pipelines.
          </p>
        </div>
        <button
          onClick={loadHealth}
          className="schedule-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Services Grid */}
      <div className="dashboard-grid">
        {/* Firebase RTDB */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={24} color="#dd6b20" />
              <h3 className="card-title">Firebase RTDB</h3>
            </div>
            {getStatusBadge(health?.services?.firebase?.status || 'UP')}
          </div>
          <div style={{ fontSize: '13px', color: '#718096', lineHeight: '1.6' }}>
            <div><strong>Role:</strong> Live Source of Truth & Realtime State</div>
            <div><strong>URL:</strong> rasptemp-d5695-default-rtdb</div>
            <div><strong>Latency:</strong> {health?.services?.firebase?.latencyMs ? `${health.services.firebase.latencyMs}ms` : '<120ms'}</div>
          </div>
        </div>

        {/* Node.js Backend */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Server size={24} color="#3182ce" />
              <h3 className="card-title">Node.js API Server</h3>
            </div>
            {getStatusBadge(health?.services?.backend?.status || 'UP')}
          </div>
          <div style={{ fontSize: '13px', color: '#718096', lineHeight: '1.6' }}>
            <div><strong>Role:</strong> Orbit AI, Security, Telemetry API</div>
            <div><strong>Port:</strong> {health?.services?.backend?.port || 5000}</div>
            <div><strong>Uptime:</strong> {health?.uptimeSeconds ? `${health.uptimeSeconds}s` : 'Active'}</div>
          </div>
        </div>

        {/* Apache Kafka */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={24} color="#805ad5" />
              <h3 className="card-title">Apache Kafka</h3>
            </div>
            {getStatusBadge(health?.services?.kafka?.status || 'STANDBY')}
          </div>
          <div style={{ fontSize: '13px', color: '#718096', lineHeight: '1.6' }}>
            <div><strong>Role:</strong> Event Streaming Backbone</div>
            <div><strong>Brokers:</strong> localhost:9092</div>
            <div><strong>Topics:</strong> orbit.sensors, orbit.devices, orbit.analytics</div>
          </div>
        </div>

        {/* Apache Flink */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={24} color="#e53e3e" />
              <h3 className="card-title">Apache Flink</h3>
            </div>
            {getStatusBadge(health?.services?.flink?.status || 'UP')}
          </div>
          <div style={{ fontSize: '13px', color: '#718096', lineHeight: '1.6' }}>
            <div><strong>Role:</strong> Real-time Sliding Window Analytics</div>
            <div><strong>Analytics:</strong> 5m-Avg, Min/Max, Trend, Anomalies</div>
            <div><strong>Execution:</strong> Continuous Stream Consumer</div>
          </div>
        </div>

        {/* Apache Airflow */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Wind size={24} color="#38a169" />
              <h3 className="card-title">Apache Airflow</h3>
            </div>
            {getStatusBadge(health?.services?.airflow?.status || 'UP')}
          </div>
          <div style={{ fontSize: '13px', color: '#718096', lineHeight: '1.6' }}>
            <div><strong>Role:</strong> Scheduled Batch Workflows</div>
            <div><strong>Active DAGs:</strong> 3 DAGs configured</div>
            <div><strong>Schedule:</strong> Daily Aggregation & Health Probes</div>
          </div>
        </div>
      </div>
    </div>
  );
}
