/**
 * Real-Time Stream Analytics Engine
 * Implements sliding & tumbling 5-minute window calculations and sudden spike detection.
 */

import { decodePushIdTimestamp, parseNumeric } from './firebase';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Computes statistical 5-minute sliding window metrics from Firebase history dictionary or points array.
 * @param {Object|Array} rawData Firebase node object (e.g. root.temp) or points array
 * @param {number} fallbackVal Fallback scalar if no history
 */
export function compute5mWindowMetrics(rawData, fallbackVal = 28.5) {
  if (!rawData) {
    return {
      avgTemp5m: fallbackVal,
      minTemp: fallbackVal,
      maxTemp: fallbackVal,
      trend: 'stable',
      anomalyDetected: false,
      sampleCount: 0,
      windowSpanSeconds: 0,
      stdDev: 0,
      latest: fallbackVal
    };
  }

  let items = [];

  if (Array.isArray(rawData)) {
    items = rawData.map(item => ({
      val: parseNumeric(item.value ?? item.temp ?? item),
      ts: item.timestamp || Date.now()
    })).filter(i => typeof i.val === 'number' && !isNaN(i.val));
  } else if (typeof rawData === 'object') {
    const keys = Object.keys(rawData);
    items = keys.map(key => {
      const val = parseNumeric(rawData[key]);
      const ts = decodePushIdTimestamp(key);
      return { val, ts };
    }).filter(i => typeof i.val === 'number' && !isNaN(i.val));
  }

  if (items.length === 0) {
    return {
      avgTemp5m: fallbackVal,
      minTemp: fallbackVal,
      maxTemp: fallbackVal,
      trend: 'stable',
      anomalyDetected: false,
      sampleCount: 0,
      windowSpanSeconds: 0,
      stdDev: 0,
      latest: fallbackVal
    };
  }

  // Sort chronologically by timestamp
  items.sort((a, b) => a.ts - b.ts);

  const latestItem = items[items.length - 1];
  const maxTs = latestItem.ts;
  const windowCutoff = maxTs - FIVE_MINUTES_MS;

  // Extract items within the 5-minute window
  let windowItems = items.filter(item => item.ts >= windowCutoff);

  // If readings are sparse (e.g., recorded further apart than 5m), use the latest 10 samples
  if (windowItems.length < 2) {
    windowItems = items.slice(-Math.min(items.length, 10));
  }

  const values = windowItems.map(i => i.val);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = +(sum / values.length).toFixed(2);
  const min = +Math.min(...values).toFixed(1);
  const max = +Math.max(...values).toFixed(1);

  // Standard Deviation
  const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev = +Math.sqrt(variance).toFixed(2);

  // Trend detection: Compare first half of window to second half
  let trend = 'stable';
  if (values.length >= 4) {
    const half = Math.floor(values.length / 2);
    const firstHalfAvg = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const secondHalfAvg = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
    const diff = secondHalfAvg - firstHalfAvg;

    if (diff > 0.25) trend = 'rising';
    else if (diff < -0.25) trend = 'falling';
  } else if (values.length >= 2) {
    const diff = values[values.length - 1] - values[0];
    if (diff > 0.3) trend = 'rising';
    else if (diff < -0.3) trend = 'falling';
  }

  // Anomaly Spike Detection: Latest deviates by > 3.0°C from rolling 5m average
  const latestVal = latestItem.val;
  const anomalyDetected = Math.abs(latestVal - avg) > 3.0;

  const windowSpanSeconds = Math.round((latestItem.ts - windowItems[0].ts) / 1000);

  return {
    avgTemp5m: avg,
    minTemp: min,
    maxTemp: max,
    trend,
    anomalyDetected,
    sampleCount: values.length,
    windowSpanSeconds,
    stdDev,
    latest: latestVal
  };
}

/**
 * Sudden Spike Detector for real-time sensor streams.
 * Triggers alert when consecutive delta is >= threshold or deviates heavily from rolling baseline.
 * 
 * @param {string} sensorType 'temperature' | 'humidity' | 'hubTemp'
 * @param {number} currentVal Current scalar value
 * @param {Array<number>} recentHistory Array of previous numeric readings
 * @returns {Object|null} Spike info object or null if normal
 */
export function detectSuddenSpike(sensorType, currentVal, recentHistory = []) {
  if (typeof currentVal !== 'number' || isNaN(currentVal)) return null;
  if (!recentHistory || recentHistory.length === 0) return null;

  const validHistory = recentHistory.filter(v => typeof v === 'number' && !isNaN(v));
  if (validHistory.length === 0) return null;

  const prevVal = validHistory[validHistory.length - 1];
  const delta = +(currentVal - prevVal).toFixed(2);
  const absDelta = Math.abs(delta);

  let threshold = 2.0; // Default for temperature: 2.0°C
  let unit = '°C';
  let label = 'Room Temperature';

  if (sensorType === 'humidity') {
    threshold = 6.0; // 6% jump
    unit = '%';
    label = 'Room Humidity';
  } else if (sensorType === 'hubTemp') {
    threshold = 3.5; // 3.5°C jump for Pi CPU
    unit = '°C';
    label = 'Hub Pi Temperature';
  }

  if (absDelta >= threshold) {
    const direction = delta > 0 ? 'Surge' : 'Drop';
    const sign = delta > 0 ? '+' : '';
    return {
      sensorType,
      label,
      isSpike: true,
      direction,
      delta,
      prevVal,
      currentVal,
      unit,
      timestamp: new Date().toISOString(),
      timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message: `⚡ Sudden ${label} ${direction}: ${sign}${delta}${unit} in a single interval (${prevVal}${unit} → ${currentVal}${unit})!`
    };
  }

  return null;
}

/**
 * Color Threshold Resolvers for Charts & Status Indicators
 */
export function getTemperatureColor(temp) {
  if (typeof temp !== 'number' || isNaN(temp)) return '#718096';
  // If > 30°C: Red, <= 30°C: Green
  return temp > 30 ? '#ef4444' : '#10b981';
}

export function getHumidityColor(hum) {
  if (typeof hum !== 'number' || isNaN(hum)) return '#718096';
  // Optimal 30% - 70%: Blue/Teal; Outside: Orange/Red
  if (hum > 70) return '#ef4444';
  if (hum < 30) return '#f59e0b';
  return '#0ea5e9';
}

export function getBatteryColor(btry) {
  if (typeof btry !== 'number' || isNaN(btry)) return '#718096';
  if (btry < 30) return '#ef4444';
  if (btry < 60) return '#f59e0b';
  return '#10b981';
}

export function getHubTempColor(hubTemp) {
  if (typeof hubTemp !== 'number' || isNaN(hubTemp)) return '#8b5cf6';
  if (hubTemp > 55) return '#ef4444';
  return '#8b5cf6';
}
