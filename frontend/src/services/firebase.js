import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  push,
  set,
  get,
  remove,
  update
} from 'firebase/database';

const DEFAULT_DEVICE_ID = "d5695";
const STORAGE_ACTIVE_DEVICE_KEY = "wave_active_device";
const STORAGE_REGISTERED_DEVICES_KEY = "wave_registered_devices";

// Firebase Push ID base64 character set for timestamp decoding
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

/**
 * Decodes 48-bit UNIX timestamp (milliseconds) from Firebase push ID key
 */
export function decodePushIdTimestamp(id) {
  if (!id || typeof id !== 'string' || id.length < 8) {
    return Date.now();
  }
  let time = 0;
  for (let i = 0; i < 8; i++) {
    const c = id.charAt(i);
    const val = PUSH_CHARS.indexOf(c);
    if (val === -1) return Date.now();
    time = time * 64 + val;
  }
  // Sanity check: valid timestamp between 2020 and 2035
  if (time > 1577836800000 && time < 2051222400000) {
    return time;
  }
  return Date.now();
}

/**
 * Resolves Firebase RTDB URL from device ID or custom URL
 */
export function resolveDatabaseUrl(deviceIdOrUrl) {
  if (!deviceIdOrUrl) return `https://rasptemp-${DEFAULT_DEVICE_ID}-default-rtdb.firebaseio.com`;
  const clean = deviceIdOrUrl.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean.replace(/\/$/, '');
  }
  // Remove special chars and sanitize
  const sanitizedId = clean.replace(/[^a-zA-Z0-9_-]/g, '');
  return `https://rasptemp-${sanitizedId}-default-rtdb.firebaseio.com`;
}

/**
 * Generates Firebase app configuration for a device
 */
export function createFirebaseConfig(device) {
  const deviceId = typeof device === 'string' ? device : (device?.deviceId || DEFAULT_DEVICE_ID);
  const databaseURL = device?.databaseURL || resolveDatabaseUrl(deviceId);
  const projectId = device?.projectId || (deviceId.startsWith('d') ? `rasptemp-${deviceId}` : `orbit-${deviceId}`);

  return {
    apiKey: device?.apiKey || "AIzaSyDlLW27MJKryEE4juaVGcmjIotj5ueFebo",
    authDomain: `${projectId}.firebaseapp.com`,
    databaseURL: databaseURL,
    projectId: projectId,
    storageBucket: `${projectId}.appspot.com`,
    messagingSenderId: "936439079920",
    appId: "1:936439079920:web:7a956f5f65ed3f3b497335",
  };
}

// Global active device & database instances
let currentDevice = getStoredActiveDevice() || {
  deviceId: DEFAULT_DEVICE_ID,
  name: "Master Node (d5695)",
  databaseURL: `https://rasptemp-${DEFAULT_DEVICE_ID}-default-rtdb.firebaseio.com`,
  isDefault: true,
  lastConnected: new Date().toISOString()
};

let currentApp = null;
let currentDb = null;

function initAppInstance(config) {
  try {
    const appName = `wave_device_${config.projectId || 'main'}`;
    const existingApps = getApps();
    const existing = existingApps.find(a => a.name === appName);
    if (existing) {
      currentApp = existing;
    } else {
      currentApp = initializeApp(config, appName);
    }
    currentDb = getDatabase(currentApp);
  } catch (err) {
    console.warn('[Firebase] Fallback to default app initialization:', err);
    currentApp = !getApps().length ? initializeApp(config) : getApp();
    currentDb = getDatabase(currentApp);
  }
  return currentDb;
}

// Initial initialization
currentDb = initAppInstance(createFirebaseConfig(currentDevice));

/**
 * Returns currently active Realtime Database instance
 */
export function getDb() {
  if (!currentDb) {
    currentDb = initAppInstance(createFirebaseConfig(currentDevice));
  }
  return currentDb;
}

export const db = currentDb;

/**
 * Switch active device and re-initialize Firebase RTDB
 */
export function switchActiveDevice(device) {
  const deviceObj = typeof device === 'string' 
    ? { deviceId: device, databaseURL: resolveDatabaseUrl(device), name: `Device ${device}` }
    : { ...device, databaseURL: device.databaseURL || resolveDatabaseUrl(device.deviceId) };

  deviceObj.lastConnected = new Date().toISOString();
  currentDevice = deviceObj;
  saveStoredActiveDevice(deviceObj);
  addDeviceToRegistry(deviceObj);

  const config = createFirebaseConfig(deviceObj);
  currentDb = initAppInstance(config);
  return { device: deviceObj, db: currentDb };
}

/**
 * Registry & LocalStorage helpers
 */
export function getStoredActiveDevice() {
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_DEVICE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredActiveDevice(device) {
  try {
    localStorage.setItem(STORAGE_ACTIVE_DEVICE_KEY, JSON.stringify(device));
  } catch (e) {
    console.warn('Could not persist active device:', e);
  }
}

export function clearStoredActiveDevice() {
  try {
    localStorage.removeItem(STORAGE_ACTIVE_DEVICE_KEY);
  } catch (e) {
    console.warn('Could not clear active device:', e);
  }
}

export function getRegisteredDevices() {
  try {
    const raw = localStorage.getItem(STORAGE_REGISTERED_DEVICES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    
    // Ensure default d5695 is always in list
    const hasDefault = list.some(d => d.deviceId === DEFAULT_DEVICE_ID);
    if (!hasDefault) {
      const defaultDev = {
        deviceId: DEFAULT_DEVICE_ID,
        name: "Primary Hub (d5695)",
        databaseURL: `https://rasptemp-${DEFAULT_DEVICE_ID}-default-rtdb.firebaseio.com`,
        isDefault: true,
        registeredAt: "2026-08-20T00:00:00.000Z"
      };
      list.unshift(defaultDev);
      localStorage.setItem(STORAGE_REGISTERED_DEVICES_KEY, JSON.stringify(list));
    }
    return list;
  } catch {
    return [
      {
        deviceId: DEFAULT_DEVICE_ID,
        name: "Primary Hub (d5695)",
        databaseURL: `https://rasptemp-${DEFAULT_DEVICE_ID}-default-rtdb.firebaseio.com`,
        isDefault: true,
      }
    ];
  }
}

export function addDeviceToRegistry(device) {
  try {
    const devices = getRegisteredDevices();
    const index = devices.findIndex(d => d.deviceId === device.deviceId);
    const newEntry = {
      ...device,
      databaseURL: device.databaseURL || resolveDatabaseUrl(device.deviceId),
      updatedAt: new Date().toISOString()
    };
    if (index >= 0) {
      devices[index] = { ...devices[index], ...newEntry };
    } else {
      devices.push(newEntry);
    }
    localStorage.setItem(STORAGE_REGISTERED_DEVICES_KEY, JSON.stringify(devices));
    return devices;
  } catch (e) {
    console.warn('Error saving device to registry:', e);
    return [];
  }
}

export function removeDeviceFromRegistry(deviceId) {
  try {
    if (deviceId === DEFAULT_DEVICE_ID) return getRegisteredDevices(); // Don't delete default
    const devices = getRegisteredDevices().filter(d => d.deviceId !== deviceId);
    localStorage.setItem(STORAGE_REGISTERED_DEVICES_KEY, JSON.stringify(devices));
    return devices;
  } catch (e) {
    console.warn('Error removing device:', e);
    return [];
  }
}

/**
 * Live test device reachability and ping
 */
export async function testDeviceConnection(deviceIdOrUrl) {
  const url = resolveDatabaseUrl(deviceIdOrUrl);
  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`${url}/.json?shallow=true`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - startTime);
    if (res.ok) {
      return { online: true, latency, url, error: null };
    } else {
      return { online: false, latency, url, error: `HTTP ${res.status}: ${res.statusText}` };
    }
  } catch (err) {
    const latency = Math.round(performance.now() - startTime);
    return { online: false, latency, url, error: err.message || 'Connection timed out' };
  }
}

/**
 * Extracts numeric value from numbers or string representations (e.g. "47.2'C ", "65%", "28.5")
 */
export function parseNumeric(val) {
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
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/**
 * Extracts latest scalar value from a push-keyed dictionary or returns raw primitive
 */
export function extractLatest(data) {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return data;
  const keys = Object.keys(data);
  if (keys.length === 0) return null;
  return data[keys[keys.length - 1]];
}

/**
 * Extracts history points from a dictionary with timestamps and formatted labels.
 * Returns both a recent preview slice (up to limit) and all historical points (allPoints) with decoded timestamps.
 */
export function extractHistory(data, limit = 30) {
  if (!data || typeof data !== 'object') {
    return { labels: [], values: [], points: [], allPoints: [] };
  }

  const allKeys = Object.keys(data);
  const allPoints = [];

  for (let i = 0; i < allKeys.length; i++) {
    const key = allKeys[i];
    const rawVal = data[key];
    const val = parseNumeric(rawVal);
    if (val !== null && !isNaN(val)) {
      const timestamp = decodePushIdTimestamp(key);
      const dateObj = new Date(timestamp);
      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const fullDateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + timeStr;
      
      allPoints.push({
        key,
        index: i + 1,
        timestamp,
        timeStr,
        fullDateStr,
        value: val
      });
    }
  }

  // Sort chronologically by timestamp
  allPoints.sort((a, b) => a.timestamp - b.timestamp);

  // Recent subset for quick dashboard preview cards
  const points = allPoints.slice(-limit);
  const labels = points.map((p, idx) => p.timeStr || `#${idx + 1}`);
  const values = points.map(p => p.value);

  return { labels, values, points, allPoints };
}

/**
 * Computes 24h (or custom time range) min, max, avg, standard deviation, and hourly distribution.
 */
export function compute24hStats(points = [], hours = 24) {
  if (!points || points.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      current: 0,
      count: 0,
      delta: 0,
      stdDev: 0,
      minPoint: null,
      maxPoint: null,
      filteredPoints: [],
      hourlyBuckets: []
    };
  }

  const now = Date.now();
  const cutoff = hours > 0 ? now - hours * 60 * 60 * 1000 : 0;
  
  // Filter points within the timeframe
  let filtered = hours > 0 ? points.filter(p => p.timestamp >= cutoff) : [...points];
  
  // If fewer than 2 points found in the last N hours (e.g. historical data stored earlier),
  // fallback to all available points so the 24h deep dive always presents rich data.
  if (filtered.length < 2) {
    filtered = points.slice(-Math.min(points.length, 500));
  }

  const values = filtered.map(p => p.value);
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      current: 0,
      count: 0,
      delta: 0,
      stdDev: 0,
      minPoint: null,
      maxPoint: null,
      filteredPoints: [],
      hourlyBuckets: []
    };
  }

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const minPoint = filtered.find(p => p.value === minVal) || filtered[0];
  const maxPoint = filtered.find(p => p.value === maxVal) || filtered[0];
  const current = filtered[filtered.length - 1]?.value ?? values[values.length - 1];

  const sum = values.reduce((acc, v) => acc + v, 0);
  const avg = +(sum / values.length).toFixed(2);
  const delta = +(maxVal - minVal).toFixed(2);

  // Standard deviation
  const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev = +Math.sqrt(variance).toFixed(2);

  // Hourly Aggregation Buckets
  const bucketMap = {};
  filtered.forEach(p => {
    const d = new Date(p.timestamp);
    const hourLabel = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                      d.getHours().toString().padStart(2, '0') + ':00';
    if (!bucketMap[hourLabel]) {
      bucketMap[hourLabel] = [];
    }
    bucketMap[hourLabel].push(p.value);
  });

  const hourlyBuckets = Object.keys(bucketMap).map(label => {
    const vals = bucketMap[label];
    const bAvg = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
    const bMin = +Math.min(...vals).toFixed(2);
    const bMax = +Math.max(...vals).toFixed(2);
    return {
      hourLabel: label,
      avg: bAvg,
      min: bMin,
      max: bMax,
      count: vals.length
    };
  });

  return {
    min: +minVal.toFixed(2),
    max: +maxVal.toFixed(2),
    avg,
    current: +current.toFixed(2),
    count: filtered.length,
    delta,
    stdDev,
    minPoint,
    maxPoint,
    filteredPoints: filtered,
    hourlyBuckets
  };
}

/**
 * Formats a duration in milliseconds to human-readable format (e.g. "2h 15m 30s" or "42m 10s")
 */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Computes exact Light turn ON/OFF analytics, continuous session durations,
 * total ON/OFF time in the window, and chronological toggle records.
 */
export function computeLightSessionStats(points = [], hours = 24) {
  const now = Date.now();
  const cutoff = hours > 0 ? now - hours * 60 * 60 * 1000 : 0;

  // Filter points in timeframe
  let filtered = hours > 0 ? points.filter(p => p.timestamp >= cutoff) : [...points];

  // If no points in timeframe but history exists, fallback to available historical points
  if (filtered.length === 0 && points.length > 0) {
    filtered = points.slice(-Math.min(points.length, 100));
  }

  // Sort chronologically
  filtered.sort((a, b) => a.timestamp - b.timestamp);

  const sessions = []; // array of { id, onTimestamp, offTimestamp, onTimeStr, offTimeStr, durationMs, durationFormatted, isOngoing }
  const events = [];   // array of { key, timestamp, timeStr, fullDateStr, state, stateLabel, durationSincePrevFormatted }

  let currentOnSession = null;
  let totalOnMs = 0;

  for (let i = 0; i < filtered.length; i++) {
    const pt = filtered[i];
    const isOn = pt.value === 1 || pt.value === true || pt.value === '1' || pt.value === 'on' || pt.value === 'ON';
    const prevPt = i > 0 ? filtered[i - 1] : null;
    const durationSincePrev = prevPt ? Math.max(pt.timestamp - prevPt.timestamp, 0) : 0;

    events.push({
      key: pt.key || `evt_${i}`,
      timestamp: pt.timestamp,
      timeStr: pt.timeStr,
      fullDateStr: pt.fullDateStr,
      state: isOn ? 1 : 0,
      stateLabel: isOn ? 'Turned ON' : 'Turned OFF',
      durationSincePrevMs: durationSincePrev,
      durationSincePrevFormatted: formatDuration(durationSincePrev)
    });

    if (isOn) {
      if (!currentOnSession) {
        currentOnSession = {
          id: sessions.length + 1,
          onTimestamp: pt.timestamp,
          onTimeStr: pt.timeStr,
          onDateStr: pt.fullDateStr,
          offTimestamp: null,
          offTimeStr: 'Active (Ongoing)',
          offDateStr: null,
          durationMs: 0,
          durationFormatted: 'Active now',
          isOngoing: true
        };
      }
    } else {
      if (currentOnSession) {
        const dur = Math.max(pt.timestamp - currentOnSession.onTimestamp, 0);
        currentOnSession.offTimestamp = pt.timestamp;
        currentOnSession.offTimeStr = pt.timeStr;
        currentOnSession.offDateStr = pt.fullDateStr;
        currentOnSession.durationMs = dur;
        currentOnSession.durationFormatted = formatDuration(dur);
        currentOnSession.isOngoing = false;
        totalOnMs += dur;
        sessions.push(currentOnSession);
        currentOnSession = null;
      }
    }
  }

  // If session is still active at the end of timeline
  if (currentOnSession) {
    const liveDur = Math.max(now - currentOnSession.onTimestamp, 0);
    currentOnSession.durationMs = liveDur;
    currentOnSession.durationFormatted = formatDuration(liveDur);
    currentOnSession.isOngoing = true;
    totalOnMs += liveDur;
    sessions.push(currentOnSession);
  }

  // Calculate window total duration
  const windowStart = filtered.length > 0 ? (hours > 0 ? cutoff : filtered[0].timestamp) : (now - 24 * 3600 * 1000);
  const totalWindowMs = Math.max(now - windowStart, totalOnMs || 1000);
  const totalOffMs = Math.max(totalWindowMs - totalOnMs, 0);

  const completedSessions = sessions.filter(s => !s.isOngoing);
  const allDurations = sessions.map(s => s.durationMs);

  const avgSessionMs = allDurations.length > 0
    ? Math.round(totalOnMs / allDurations.length)
    : 0;

  const maxSessionMs = allDurations.length > 0 ? Math.max(...allDurations) : 0;
  const minSessionMs = allDurations.length > 0 ? Math.min(...allDurations) : 0;
  const longestSession = sessions.find(s => s.durationMs === maxSessionMs) || null;

  const onPercentage = Math.min(100, Math.max(0, +( (totalOnMs / totalWindowMs) * 100 ).toFixed(1)));
  const offPercentage = +( 100 - onPercentage ).toFixed(1);

  const currentState = filtered.length > 0
    ? (filtered[filtered.length - 1].value === 1 || filtered[filtered.length - 1].value === true)
    : false;

  const lastToggleTime = filtered.length > 0 ? filtered[filtered.length - 1].timestamp : now;
  const currentStateDurationMs = Math.max(now - lastToggleTime, 0);

  return {
    totalOnMs,
    totalOnFormatted: formatDuration(totalOnMs),
    totalOffMs,
    totalOffFormatted: formatDuration(totalOffMs),
    onPercentage,
    offPercentage,
    sessionCount: sessions.length,
    completedSessionCount: completedSessions.length,
    avgSessionMs,
    avgSessionFormatted: formatDuration(avgSessionMs),
    maxSessionMs,
    maxSessionFormatted: formatDuration(maxSessionMs),
    minSessionMs,
    minSessionFormatted: formatDuration(minSessionMs),
    longestSession,
    currentState,
    currentStateDurationMs,
    currentStateDurationFormatted: formatDuration(currentStateDurationMs),
    lastToggleTime,
    lastToggleTimeStr: filtered.length > 0 ? filtered[filtered.length - 1].timeStr : 'Recently',
    sessions: sessions.slice().reverse(), // Latest sessions first
    events: events.slice().reverse(),     // Latest events first
    filteredPoints: filtered
  };
}

// Device Control Actions
export async function toggleLight(lightNumber, state, actor = null) {
  const activeDb = getDb();
  const nodeRef = push(ref(activeDb, `light${lightNumber}/`));
  const val = state ? 1 : 0;
  await set(nodeRef, val);

  // Log activity event
  const actorName = actor?.name || 'Owner';
  const actorRole = actor?.role || 'Owner';
  const actorType = actor?.type || 'owner';
  await logActivityEvent({
    actorName,
    actorRole,
    actorType,
    action: `Turned ${state ? 'ON' : 'OFF'} Light ${lightNumber}`,
    device: `light${lightNumber}`,
    state: state ? 'ON' : 'OFF',
    details: `Actuated via ORBIT Web Interface`
  });

  return val;
}

export async function toggleSafeMode(state, actor = null) {
  const activeDb = getDb();
  const nodeRef = push(ref(activeDb, 'masterSwitch/'));
  const val = state ? 1 : 0;
  await set(nodeRef, val);

  // Log activity event
  const actorName = actor?.name || 'Owner';
  const actorRole = actor?.role || 'Owner';
  const actorType = actor?.type || 'owner';
  await logActivityEvent({
    actorName,
    actorRole,
    actorType,
    action: `Master Safe Mode ${state ? 'ENABLED (Locked)' : 'DISABLED'}`,
    device: 'masterSwitch',
    state: state ? 'LOCKED' : 'OFF',
    details: `Master switch toggled`
  });

  return val;
}

export async function updateSchedule(onTime, offTime, actor = null) {
  const activeDb = getDb();
  const scheduleRef = ref(activeDb, 'schedule');
  await set(scheduleRef, {
    light_schedule_on: onTime,
    light_schedule_off: offTime
  });

  await logActivityEvent({
    actorName: actor?.name || 'Owner',
    actorRole: actor?.role || 'Owner',
    actorType: actor?.type || 'owner',
    action: `Updated Light 3 automated schedule (ON: ${onTime}, OFF: ${offTime})`,
    device: 'schedule',
    state: 'UPDATED',
    details: `Schedule updated in Firebase`
  });
}

// ==========================================================================
// USER PROFILE MANAGEMENT
// ==========================================================================
const DEFAULT_PROFILE = {
  userName: 'Nayan Chawhan',
  email: 'nayangc2005@gmail.com',
  secondaryEmail: 'admin@orbit.local',
  phone: '+91 9876543210',
  emergencyContactName: 'Emergency Support',
  emergencyContactPhone: '+91 9876543211',
  homeName: 'ORBIT Smart Residence',
  homeAddress: 'Sector 4, Automattrix Heights',
  city: 'Bengaluru',
  country: 'India',
  location: 'ORBIT Smart Home • Living Room Node',
  wifiSsid: 'ORBIT-IoT-5G',
  threshold: 30.0,
  lowTempThreshold: 16.0,
  humidityThreshold: 70.0,
  batteryThreshold: 25.0,
  emailAlertsEnabled: true,
  autoLockOnBreach: true,
  soundAlertsEnabled: true,
  role: 'Primary Homeowner / Administrator',
  avatar: '👨‍💼',
  installedDate: '2026-01-15'
};

export async function saveUserProfile(profileData) {
  const activeDb = getDb();
  const profileRef = ref(activeDb, 'profile');
  const payload = {
    userName: profileData.userName?.trim() || DEFAULT_PROFILE.userName,
    email: profileData.email?.trim() || DEFAULT_PROFILE.email,
    secondaryEmail: profileData.secondaryEmail?.trim() || DEFAULT_PROFILE.secondaryEmail,
    phone: profileData.phone?.trim() || DEFAULT_PROFILE.phone,
    emergencyContactName: profileData.emergencyContactName?.trim() || DEFAULT_PROFILE.emergencyContactName,
    emergencyContactPhone: profileData.emergencyContactPhone?.trim() || DEFAULT_PROFILE.emergencyContactPhone,
    homeName: profileData.homeName?.trim() || DEFAULT_PROFILE.homeName,
    homeAddress: profileData.homeAddress?.trim() || DEFAULT_PROFILE.homeAddress,
    city: profileData.city?.trim() || DEFAULT_PROFILE.city,
    country: profileData.country?.trim() || DEFAULT_PROFILE.country,
    location: profileData.location?.trim() || DEFAULT_PROFILE.location,
    wifiSsid: profileData.wifiSsid?.trim() || DEFAULT_PROFILE.wifiSsid,
    threshold: Number(profileData.threshold) || 30.0,
    lowTempThreshold: Number(profileData.lowTempThreshold) || 16.0,
    humidityThreshold: Number(profileData.humidityThreshold) || 70.0,
    batteryThreshold: Number(profileData.batteryThreshold) || 25.0,
    emailAlertsEnabled: Boolean(profileData.emailAlertsEnabled ?? true),
    autoLockOnBreach: Boolean(profileData.autoLockOnBreach ?? true),
    soundAlertsEnabled: Boolean(profileData.soundAlertsEnabled ?? true),
    role: profileData.role || DEFAULT_PROFILE.role,
    avatar: profileData.avatar || DEFAULT_PROFILE.avatar,
    installedDate: profileData.installedDate || DEFAULT_PROFILE.installedDate,
    updatedAt: new Date().toISOString()
  };

  await set(profileRef, payload);

  await logActivityEvent({
    actorName: payload.userName,
    actorRole: 'Owner',
    actorType: 'owner',
    action: `Saved Comprehensive User Profile & Safety Thresholds (${payload.threshold}°C)`,
    device: 'profile',
    state: 'SAVED',
    details: `Home: ${payload.homeName}, Email: ${payload.email}, Node: ${payload.location}`
  });

  return payload;
}

export async function getUserProfile() {
  try {
    const activeDb = getDb();
    const profileRef = ref(activeDb, 'profile');
    const snapshot = await get(profileRef);
    if (snapshot.exists()) {
      return { ...DEFAULT_PROFILE, ...snapshot.val() };
    }
  } catch (err) {
    console.warn('Could not read user profile from Firebase:', err);
  }
  return DEFAULT_PROFILE;
}

export function subscribeUserProfile(callback) {
  const activeDb = getDb();
  const profileRef = ref(activeDb, 'profile');
  return onValue(profileRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ ...DEFAULT_PROFILE, ...snapshot.val() });
    } else {
      callback(DEFAULT_PROFILE);
    }
  });
}

// ==========================================================================
// GUEST & ACCESS CONTROL MANAGEMENT
// ==========================================================================
export async function addGuest(guestData, actor = null) {
  const activeDb = getDb();
  const guestNodeRef = push(ref(activeDb, 'guests/'));
  const guestId = guestNodeRef.key;

  const isFamily = guestData.role === 'Family Member';
  const isViewer = guestData.role === 'Viewer';
  const prefix = isFamily ? 'FM' : isViewer ? 'VIEW' : 'GUEST';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const accessKey = guestData.customKey?.trim().toUpperCase() || `${prefix}-${randomSuffix}`;

  // Calculate Expiration Timestamp
  let expiresAt = null;
  const now = Date.now();
  if (guestData.accessExpiry === '24h') expiresAt = now + 24 * 3600 * 1000;
  else if (guestData.accessExpiry === '7d') expiresAt = now + 7 * 24 * 3600 * 1000;
  else if (guestData.accessExpiry === '30d') expiresAt = now + 30 * 24 * 3600 * 1000;

  const currentDev = getStoredActiveDevice();
  const deviceId = currentDev?.deviceId || 'd5695';

  // Granular Role-Based Permissions
  const permissions = {
    canAccessDashboard: true,
    canAccessAnalytics: isFamily ? Boolean(guestData.canAccessAnalytics ?? true) : false,
    canAccessHealth: isFamily ? Boolean(guestData.canAccessHealth ?? true) : false,
    canAccessProfile: isFamily ? Boolean(guestData.canAccessProfile ?? true) : false,
    canAccessGestures: isFamily ? Boolean(guestData.canAccessGestures ?? true) : Boolean(guestData.canAccessGestures),
    canAccessChatbot: isFamily ? Boolean(guestData.canAccessChatbot ?? true) : Boolean(guestData.canAccessChatbot),
    canAccessSafeMode: isFamily ? Boolean(guestData.canAccessSafeMode ?? true) : false,
    canEditSchedule: isFamily ? Boolean(guestData.canEditSchedule ?? true) : false,
    isReadOnly: isViewer
  };

  const payload = {
    id: guestId,
    accessKey,
    name: guestData.name?.trim() || 'Guest User',
    email: guestData.email?.trim() || '',
    role: guestData.role || 'Guest', // 'Family Member' | 'Guest' | 'Viewer'
    accessExpiry: guestData.accessExpiry || '24h', // '24h' | '7d' | '30d' | 'permanent'
    expiresAt,
    deviceId,
    permissions,
    allowedDevices: isViewer ? [] : (guestData.allowedDevices || ['light1', 'light2', 'light3']),
    canControlSensors: Boolean(guestData.canControlSensors),
    notes: guestData.notes?.trim() || '',
    status: 'active',
    avatar: isFamily ? '👩‍👧' : isViewer ? '👁️' : '🧑‍💻',
    createdAt: new Date().toISOString()
  };

  await set(guestNodeRef, payload);

  await logActivityEvent({
    actorName: actor?.name || 'Owner',
    actorRole: 'Owner',
    actorType: 'owner',
    action: `Generated Passcode (${accessKey}) & granted ${payload.role} access to ${payload.name}`,
    device: 'accessControl',
    state: 'GRANTED',
    details: `Passcode: ${accessKey}, Analytics: ${permissions.canAccessAnalytics}, Health: ${permissions.canAccessHealth}, Profile: ${permissions.canAccessProfile}, Devices: ${payload.allowedDevices.join(', ')}`
  });

  return payload;
}

export async function removeGuest(guestId, guestName = 'Guest', actor = null) {
  const activeDb = getDb();
  const guestRef = ref(activeDb, `guests/${guestId}`);
  await remove(guestRef);

  await logActivityEvent({
    actorName: actor?.name || 'Owner',
    actorRole: 'Owner',
    actorType: 'owner',
    action: `Revoked access passcode for ${guestName}`,
    device: 'accessControl',
    state: 'REVOKED',
    details: `Guest removed from system`
  });
}

export function subscribeGuests(callback) {
  const activeDb = getDb();
  const guestsRef = ref(activeDb, 'guests/');
  return onValue(guestsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const list = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      callback(list);
    } else {
      callback([]);
    }
  });
}

/**
 * Authenticates a guest or family member using their Unique Member Passcode / ID
 */
export async function loginWithMemberPasscode(passcode, fallbackDeviceId = 'd5695') {
  const clean = passcode?.trim().toUpperCase();
  if (!clean) {
    return { success: false, error: 'Please enter a valid Member Passcode / ID.' };
  }

  try {
    const activeDb = getDb();
    const guestsRef = ref(activeDb, 'guests/');
    const snapshot = await get(guestsRef);

    if (!snapshot.exists()) {
      return {
        success: false,
        error: 'No active guest or family member records found. Please ask the owner to generate an access code in their Profile page.'
      };
    }

    const data = snapshot.val();
    let matchedGuest = null;

    for (const key of Object.keys(data)) {
      const g = data[key];
      const gKey = (g.accessKey || key).toUpperCase();
      if (gKey === clean || key.toUpperCase() === clean) {
        matchedGuest = { id: key, ...g };
        break;
      }
    }

    if (!matchedGuest) {
      return {
        success: false,
        error: `Passcode "${passcode}" was not found. Please check with the homeowner for the correct code.`
      };
    }

    if (matchedGuest.status === 'revoked') {
      return {
        success: false,
        error: 'Access for this member key has been revoked by the homeowner.'
      };
    }

    // Check expiration
    if (matchedGuest.expiresAt && Date.now() > matchedGuest.expiresAt) {
      return {
        success: false,
        error: `This access code expired on ${new Date(matchedGuest.expiresAt).toLocaleString()}. Please request a renewed code.`
      };
    }

    const targetDeviceId = matchedGuest.deviceId || fallbackDeviceId || 'd5695';
    const targetDevice = {
      deviceId: targetDeviceId,
      name: `Node ${targetDeviceId} (${matchedGuest.name})`,
      databaseURL: resolveDatabaseUrl(targetDeviceId)
    };

    // Log the successful authentication
    await logActivityEvent({
      actorName: matchedGuest.name,
      actorRole: matchedGuest.role,
      actorType: matchedGuest.role === 'Family Member' ? 'family' : 'guest',
      action: `Logged into ORBIT Dashboard using Member ID (${matchedGuest.accessKey || matchedGuest.id})`,
      device: 'login',
      state: 'AUTHENTICATED',
      details: `Role: ${matchedGuest.role}, Target Node: ${targetDeviceId}`
    });

    return {
      success: true,
      guest: matchedGuest,
      device: targetDevice
    };
  } catch (err) {
    return {
      success: false,
      error: 'Error validating passcode with Firebase: ' + err.message
    };
  }
}

// ==========================================================================
// AUDIT TRAIL & ACTIVITY LOGGING
// ==========================================================================
export async function logActivityEvent(eventData) {
  try {
    const activeDb = getDb();
    const logNodeRef = push(ref(activeDb, 'activityLogs/'));
    const now = new Date();

    const payload = {
      id: logNodeRef.key,
      timestamp: Date.now(),
      timeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      dateStr: now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      actorName: eventData.actorName || 'System',
      actorRole: eventData.actorRole || 'System', // 'Owner' | 'Family Member' | 'Guest' | 'System' | 'Sensor'
      actorType: eventData.actorType || 'system', // 'owner' | 'family' | 'guest' | 'system' | 'sensor'
      action: eventData.action || 'Device status updated',
      device: eventData.device || 'general',
      state: eventData.state || 'INFO',
      details: eventData.details || ''
    };

    await set(logNodeRef, payload);
    return payload;
  } catch (err) {
    console.warn('Could not write activity log to Firebase:', err);
    return null;
  }
}

export function subscribeActivityLogs(callback) {
  const activeDb = getDb();
  const logsRef = ref(activeDb, 'activityLogs/');
  return onValue(logsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const logs = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      // Sort newest first
      logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      callback(logs.slice(0, 100)); // Keep latest 100 in view
    } else {
      callback([]);
    }
  });
}

export { ref, onValue, get, set, push, remove, update };

