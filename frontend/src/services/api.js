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
