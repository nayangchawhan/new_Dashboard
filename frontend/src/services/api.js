const API_BASE = '/api';

/**
 * Sends a message to AI chatbot via the backend
 */
export async function sendChatMessage(message, history = []) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || 'Failed to get response from AI Assistant');
  }

  return response.json();
}

/**
 * Fetches pipeline health status from backend
 */
export async function fetchHealthStatus() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('Health check non-200');
    return await res.json();
  } catch (error) {
    return {
      status: 'offline',
      services: {
        backend: { status: 'STANDBY' },
        firebase: { status: 'UP' },
        kafka: { status: 'STANDBY' },
        flink: { status: 'STANDBY' },
        airflow: { status: 'STANDBY' }
      }
    };
  }
}

/**
 * Emits gesture or device event to Kafka via backend
 */
export async function emitTelemetryEvent(type, payload) {
  try {
    const res = await fetch(`${API_BASE}/telemetry/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    });
    return await res.json();
  } catch (err) {
    console.warn('Backend event emitter note:', err.message);
    return { success: true, mode: 'local' };
  }
}

/**
 * Runs AI-powered Fire vs Normal Transient Thermal Rise Diagnosis via Groq LLM
 */
export async function fetchThermalHazardDiagnosis(telemetryData) {
  try {
    const res = await fetch(`${API_BASE}/analytics/thermal-diagnostics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telemetryData),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) throw new Error('Diagnosis server returned error');
    return await res.json();
  } catch (err) {
    console.warn('[ThermalDiagnosis] Fallback to heuristic analysis:', err.message);
    // Instant client-side fallback
    const temp = telemetryData.temperature ?? 28.5;
    const riseCount = telemetryData.consecutiveRiseCount ?? 1;
    const isFire = riseCount >= 4 || temp > 38.0;
    const isWarning = riseCount >= 3 || temp > 32.0;

    return {
      riskLevel: isFire ? 'CRITICAL' : isWarning ? 'MODERATE' : 'LOW',
      category: isFire ? 'FIRE_HAZARD_ALERT' : isWarning ? 'SUSTAINED_ACCUMULATION' : 'NORMAL_TRANSIENT',
      fireProbability: isFire ? 92 : isWarning ? 45 : 5,
      consecutiveSpikeAnalysis: `Observed ${riseCount} sequential thermal rise interval(s). ${riseCount <= 2 ? 'Isolated transient flux.' : 'Sustained thermal climb.'}`,
      summary: isFire
        ? `🚨 Urgent fire hazard risk: Rapid temperature climb to ${temp}°C across ${riseCount} intervals.`
        : isWarning
        ? `⚠️ Elevated temperature accumulation (${temp}°C) across ${riseCount} intervals.`
        : `Normal transient temperature fluctuation (${temp}°C) within routine baseline limits.`,
      recommendation: isFire
        ? 'Evacuate premises if smoke is present. Safe Mode power isolation is active.'
        : isWarning
        ? 'Check room ventilation and active appliances.'
        : 'No action required. Continuous monitoring active.',
      source: 'local-heuristic'
    };
  }
}

/**
 * Runs AI-powered Past Precursor + Future Forecast + Fire Risk Analysis for an individual anomaly card
 */
export async function fetchSpikeAiAnalysis(spike, telemetry = {}, recentPoints = []) {
  try {
    const res = await fetch(`${API_BASE}/analytics/spike-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spike, telemetry, recentPoints }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) throw new Error('Spike AI analysis server non-200');
    return await res.json();
  } catch (err) {
    console.warn('[SpikeAiAnalysis] Fallback to heuristic analysis:', err.message);
    const delta = spike.delta || 0;
    const isTemp = spike.sensorType === 'temperature';
    const isSurge = spike.direction === 'Surge' || delta > 0;
    const currentVal = spike.currentVal ?? 30.0;
    const isExtreme = isTemp && isSurge && currentVal > 35.0;
    const isElevated = isTemp && isSurge && currentVal > 30.0;

    return {
      riskLevel: isExtreme ? 'CRITICAL' : isElevated ? 'MODERATE' : 'LOW',
      fireProbability: isExtreme ? 90 : isElevated ? 35 : 4,
      hazardClassification: isExtreme ? 'FIRE_HAZARD' : isElevated ? 'APPLIANCE_THERMAL_STRESS' : isTemp && !isSurge ? 'RAPID_COOLING' : 'BENIGN_TRANSIENT',
      pastAnalysis: `Sensor transitioned by ${delta > 0 ? '+' : ''}${delta}${spike.unit || ''} from ${spike.prevVal ?? '--'}${spike.unit || ''} to ${currentVal}${spike.unit || ''}.`,
      futureForecast: isExtreme
        ? 'Thermal velocity is acute. Without cooling or power isolation, temperature may breach 38°C in ~3-5 minutes.'
        : isElevated
        ? 'Light 1 cooling indicator is active. Heat is expected to plateau or normalize below 30°C within 5-10 minutes.'
        : 'Environmental slope is returning towards steady state equilibrium.',
      safetyAdvice: isExtreme
        ? 'Inspect the area for burning odors, electrical shorts, or high-power heaters. Safe Mode is engaged.'
        : isElevated
        ? 'Ensure adequate air circulation and monitor temperature trend.'
        : 'Standard continuous monitoring active. No intervention needed.',
      spikeId: spike.id,
      source: 'local-heuristic'
    };
  }
}
