import { setFirebaseNode } from './firebaseService.js';
import { emitEvent } from './kafkaService.js';
import { TOPICS } from '../config/kafka.js';

let latestAnalytics = {
  avgTemp5m: 28.5,
  minTemp: 26.8,
  maxTemp: 30.2,
  trend: 'stable',
  anomalyDetected: false,
  motionCount1h: 0,
  deviceToggles1h: 0,
  lastUpdated: new Date().toISOString()
};

/**
 * Updates analytics cache and syncs to Firebase /analytics
 */
export async function updateAnalytics(analyticsData) {
  latestAnalytics = {
    ...latestAnalytics,
    ...analyticsData,
    lastUpdated: new Date().toISOString()
  };

  // Sync to Firebase
  try {
    await setFirebaseNode('analytics', latestAnalytics);
  } catch (err) {
    console.warn('[FlinkBridge] Could not sync analytics to Firebase:', err.message);
  }

  // Also emit to Kafka analytics topic
  await emitEvent(TOPICS.ANALYTICS, latestAnalytics);

  return latestAnalytics;
}

export function getLatestAnalytics() {
  return latestAnalytics;
}
