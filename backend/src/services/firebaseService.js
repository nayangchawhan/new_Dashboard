import axios from 'axios';
import { RTDB_BASE_URL } from '../config/firebase.js';

/**
 * Extracts numeric value from numbers or string representations (e.g. "47.2'C ", "65%", "28.5")
 */
export function parseNumericValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return null;
    const match = trimmed.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (match && match[0] !== '') {
      const parsed = parseFloat(match[0]);
      return isNaN(parsed) ? null : parsed;
    }
  }
  const num = Number(val);
  return isNaN(num) ? null : num;
}

/**
 * Extracts the latest item from a Firebase push-key object or returns the primitive.
 */
export function extractLatestValue(data) {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return data;
  
  const keys = Object.keys(data);
  if (keys.length === 0) return null;
  
  const lastKey = keys[keys.length - 1];
  const value = data[lastKey];
  
  // If the inner value is an object with values, recursively get primitive or return object
  return value;
}

/**
 * Fetches the entire database tree or specific node.
 */
export async function getFirebaseNode(path = '') {
  try {
    const cleanPath = path.replace(/^\/|\/$/g, '');
    const url = `${RTDB_BASE_URL}/${cleanPath ? cleanPath + '.json' : '.json'}`;
    const res = await axios.get(url, { timeout: 4000 });
    return res.data;
  } catch (error) {
    console.error(`[FirebaseService] Error fetching node "${path}":`, error.message);
    return null;
  }
}

/**
 * Writes or updates data in Firebase Realtime Database.
 */
export async function setFirebaseNode(path, data) {
  try {
    const cleanPath = path.replace(/^\/|\/$/g, '');
    const url = `${RTDB_BASE_URL}/${cleanPath}.json`;
    const res = await axios.put(url, JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
      timeout: 4000
    });
    return res.data;
  } catch (error) {
    console.error(`[FirebaseService] Error setting node "${path}":`, error.message);
    throw error;
  }
}

/**
 * Pushes a new entry to a list node in Firebase.
 */
export async function pushFirebaseNode(path, data) {
  try {
    const cleanPath = path.replace(/^\/|\/$/g, '');
    const url = `${RTDB_BASE_URL}/${cleanPath}.json`;
    const res = await axios.post(url, JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
      timeout: 4000
    });
    return res.data;
  } catch (error) {
    console.error(`[FirebaseService] Error pushing node "${path}":`, error.message);
    throw error;
  }
}

const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

export function decodePushIdTimestamp(id) {
  if (!id || typeof id !== 'string' || id.length < 8) return Date.now();
  let time = 0;
  for (let i = 0; i < 8; i++) {
    const c = id.charAt(i);
    const val = PUSH_CHARS.indexOf(c);
    if (val === -1) return Date.now();
    time = time * 64 + val;
  }
  if (time > 1577836800000 && time < 2051222400000) return time;
  return Date.now();
}

/**
 * Computes 5-minute rolling metrics from raw Firebase node dictionary
 */
export function computeRolling5mMetrics(dataNode, fallbackVal = 28.5) {
  if (!dataNode || typeof dataNode !== 'object') {
    return {
      avgTemp5m: fallbackVal,
      minTemp: fallbackVal,
      maxTemp: fallbackVal,
      trend: 'stable',
      anomalyDetected: false,
      sampleCount: 0
    };
  }

  const keys = Object.keys(dataNode);
  const items = keys.map(k => ({
    val: parseNumericValue(dataNode[k]),
    ts: decodePushIdTimestamp(k)
  })).filter(i => i.val !== null);

  if (items.length === 0) {
    return {
      avgTemp5m: fallbackVal,
      minTemp: fallbackVal,
      maxTemp: fallbackVal,
      trend: 'stable',
      anomalyDetected: false,
      sampleCount: 0
    };
  }

  items.sort((a, b) => a.ts - b.ts);
  const latestItem = items[items.length - 1];
  const cutoff = latestItem.ts - 5 * 60 * 1000;
  let windowItems = items.filter(i => i.ts >= cutoff);
  if (windowItems.length < 2) {
    windowItems = items.slice(-Math.min(items.length, 10));
  }

  const values = windowItems.map(i => i.val);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = +(sum / values.length).toFixed(2);
  const min = +Math.min(...values).toFixed(1);
  const max = +Math.max(...values).toFixed(1);

  let trend = 'stable';
  if (values.length >= 4) {
    const half = Math.floor(values.length / 2);
    const firstHalfAvg = values.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const secondHalfAvg = values.slice(half).reduce((a, b) => a + b, 0) / (values.length - half);
    const diff = secondHalfAvg - firstHalfAvg;
    if (diff > 0.25) trend = 'rising';
    else if (diff < -0.25) trend = 'falling';
  }

  const latestVal = latestItem.val;
  const anomalyDetected = Math.abs(latestVal - avg) > 3.0;

  return {
    avgTemp5m: avg,
    minTemp: min,
    maxTemp: max,
    trend,
    anomalyDetected,
    sampleCount: values.length,
    lastProcessed: new Date().toISOString()
  };
}

/**
 * Retrieves a normalized real-time snapshot of the entire smart home state.
 */
export async function getSystemSnapshot() {
  const root = await getFirebaseNode() || {};

  // Extract latest sensor values
  const rawTemp = extractLatestValue(root.temp);
  const rawHumidity = extractLatestValue(root.humidity);
  const rawBattery = extractLatestValue(root.btry || root.distbtry);
  const rawPitemp = extractLatestValue(root.pitemp);
  const rawMotion = extractLatestValue(root.dist);

  const temp = parseNumericValue(rawTemp);
  const humidity = parseNumericValue(rawHumidity);
  const battery = parseNumericValue(rawBattery);
  const pitemp = parseNumericValue(rawPitemp);
  const motion = rawMotion === true || rawMotion === 1 || rawMotion === 'true' || rawMotion === '1' || (typeof rawMotion === 'number' && rawMotion > 0);

  // Extract latest device states
  const rawLight1 = extractLatestValue(root.light1);
  const rawLight2 = extractLatestValue(root.light2);
  const rawLight3 = extractLatestValue(root.light3);
  const rawMaster = extractLatestValue(root.masterSwitch);

  const light1 = rawLight1 === 1 || rawLight1 === true || rawLight1 === '1' || rawLight1 === 'on' || rawLight1 === 'ON';
  const light2 = rawLight2 === 1 || rawLight2 === true || rawLight2 === '1' || rawLight2 === 'on' || rawLight2 === 'ON';
  const light3 = rawLight3 === 1 || rawLight3 === true || rawLight3 === '1' || rawLight3 === 'on' || rawLight3 === 'ON';
  const safeMode = rawMaster === 1 || rawMaster === true || rawMaster === '1' || rawMaster === 'on' || rawMaster === 'ON';

  // Schedule
  const schedule = root.schedule || {
    light_schedule_on: '22:00',
    light_schedule_off: '06:00'
  };

  // Analytics computed from real 5-minute sliding window
  const computedRoom5m = computeRolling5mMetrics(root.temp, temp !== null ? temp : 28.5);
  const computedHub5m = computeRolling5mMetrics(root.pitemp, pitemp !== null ? pitemp : 46.5);

  const analytics = {
    ...computedRoom5m,
    hubAvgTemp5m: computedHub5m.avgTemp5m,
    hubMinTemp: computedHub5m.minTemp,
    hubMaxTemp: computedHub5m.maxTemp,
    lastProcessed: new Date().toISOString()
  };

  return {
    timestamp: new Date().toISOString(),
    sensors: {
      temperature: temp,
      humidity: humidity,
      battery: battery,
      hubTemperature: pitemp,
      motionDetected: Boolean(motion)
    },
    devices: {
      light1,
      light2,
      light3,
      safeMode
    },
    schedule: {
      onTime: schedule.light_schedule_on || null,
      offTime: schedule.light_schedule_off || null
    },
    analytics,
    raw: {
      tempHistoryCount: root.temp ? Object.keys(root.temp).length : 0,
      humidityHistoryCount: root.humidity ? Object.keys(root.humidity).length : 0,
      distHistoryCount: root.dist ? Object.keys(root.dist).length : 0
    }
  };
}
