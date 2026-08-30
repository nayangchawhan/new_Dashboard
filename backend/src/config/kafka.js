import { Kafka, logLevel } from 'kafkajs';
import dotenv from 'dotenv';
dotenv.config();

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'orbit-backend';

let kafkaInstance = null;
let isKafkaAvailable = false;

try {
  kafkaInstance = new Kafka({
    clientId: CLIENT_ID,
    brokers: KAFKA_BROKERS,
    logLevel: logLevel.NOTHING,
    retry: {
      initialRetryTime: 100,
      retries: 2
    }
  });
} catch (err) {
  console.warn('[Kafka Config] Could not initialize Kafka client:', err.message);
}

export const TOPICS = {
  SENSORS: 'orbit.sensors',
  DEVICES: 'orbit.devices',
  GESTURES: 'orbit.gestures',
  ANALYTICS: 'orbit.analytics'
};

export { kafkaInstance, KAFKA_BROKERS };
