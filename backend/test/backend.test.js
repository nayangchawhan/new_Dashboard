import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLatestValue, getSystemSnapshot, parseNumericValue } from '../src/services/firebaseService.js';
import { askGrok } from '../src/services/grokService.js';
import { emitEvent, getKafkaStatus } from '../src/services/kafkaService.js';

test('Firebase extractLatestValue and parseNumericValue handle primitive, objects, and string units', () => {
  assert.equal(extractLatestValue(42), 42);
  assert.equal(extractLatestValue(null), null);
  assert.equal(extractLatestValue(undefined), null);

  const mockPushObject = {
    '-P-K_item1': 25.4,
    '-P-K_item2': 28.9
  };
  assert.equal(extractLatestValue(mockPushObject), 28.9);

  // String unit parsing tests (e.g. "47.2'C ", "65%", "48.3'C")
  assert.equal(parseNumericValue("47.2'C "), 47.2);
  assert.equal(parseNumericValue("48.3'C "), 48.3);
  assert.equal(parseNumericValue("65%"), 65);
  assert.equal(parseNumericValue(42.5), 42.5);
  assert.equal(parseNumericValue(null), null);
  assert.equal(parseNumericValue(""), null);
});

test('getSystemSnapshot returns valid normalized telemetry structure', async () => {
  const snapshot = await getSystemSnapshot();
  
  assert.ok(snapshot.timestamp, 'Snapshot must have a timestamp');
  assert.ok(snapshot.sensors, 'Snapshot must contain sensors');
  assert.ok(snapshot.devices, 'Snapshot must contain devices');
  assert.ok(snapshot.schedule, 'Snapshot must contain schedule');
  assert.ok(snapshot.analytics, 'Snapshot must contain analytics');

  assert.equal(typeof snapshot.devices.light1, 'boolean');
  assert.equal(typeof snapshot.devices.safeMode, 'boolean');
});

test('askGrok answers temperature, weather, and light queries with real awareness', async () => {
  const tempQuery = await askGrok('What is the current temperature and hub temperature?');
  assert.ok(tempQuery.message, 'Must return an answer message');
  assert.ok(tempQuery.contextSnapshot, 'Must attach context snapshot');
  assert.match(tempQuery.message, /(temperature|current data|°C)/i);

  const weatherQuery = await askGrok('Will it rain today? Is an umbrella required?');
  assert.ok(weatherQuery.message);
  assert.match(weatherQuery.message, /(rain|umbrella|weather|precipitation)/i);

  const lightQuery = await askGrok('Are the lights on?');
  assert.ok(lightQuery.message);
  assert.match(lightQuery.message, /(light|ON|OFF)/i);
});

test('Kafka service emits events to ring buffer in fallback mode', async () => {
  const res = await emitEvent('orbit.sensors', {
    type: 'temperature_reading',
    value: 29.5
  });

  assert.ok(res.success);
  const status = getKafkaStatus();
  assert.ok(status.recentEventsCount >= 1);
});
