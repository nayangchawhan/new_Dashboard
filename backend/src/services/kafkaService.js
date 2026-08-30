import { kafkaInstance, TOPICS } from '../config/kafka.js';
import { setFirebaseNode } from './firebaseService.js';

let producer = null;
let consumer = null;
let isConnected = false;
const eventLog = []; // In-memory ring buffer for event debugging

export async function initKafka() {
  if (!kafkaInstance) return false;

  try {
    producer = kafkaInstance.producer();
    await producer.connect();
    isConnected = true;
    console.log('[KafkaService] Producer connected successfully.');

    // Initialize analytics consumer
    consumer = kafkaInstance.consumer({ groupId: 'orbit-backend-analytics-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: TOPICS.ANALYTICS, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          console.log(`[KafkaService] Received analytics from ${topic}:`, payload);
          // Sync Flink stream analytics back to Firebase
          await setFirebaseNode('analytics', payload);
        } catch (err) {
          console.error('[KafkaService] Error processing Kafka message:', err.message);
        }
      }
    });

    return true;
  } catch (error) {
    console.warn('[KafkaService] Kafka connection failed (running in fallback mode):', error.message);
    isConnected = false;
    return false;
  }
}

/**
 * Publishes an event to a Kafka topic or logs to memory buffer if broker is unavailable.
 */
export async function emitEvent(topic, eventData) {
  const eventPayload = {
    ...eventData,
    timestamp: eventData.timestamp || new Date().toISOString()
  };

  // Add to ring buffer (max 100 events)
  eventLog.unshift({ topic, payload: eventPayload });
  if (eventLog.length > 100) eventLog.pop();

  if (isConnected && producer) {
    try {
      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(eventPayload) }]
      });
      return { success: true, mode: 'kafka' };
    } catch (err) {
      console.error(`[KafkaService] Failed to send to topic ${topic}:`, err.message);
      return { success: false, mode: 'fallback', error: err.message };
    }
  }

  // Fallback mode
  return { success: true, mode: 'in-memory-fallback' };
}

export function getKafkaStatus() {
  return {
    connected: isConnected,
    topics: Object.values(TOPICS),
    recentEventsCount: eventLog.length,
    recentEvents: eventLog.slice(0, 10)
  };
}
