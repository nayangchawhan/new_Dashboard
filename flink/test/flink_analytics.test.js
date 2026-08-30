import test from 'node:test';
import assert from 'node:assert/strict';
import { StreamWindowAnalytics } from '../stream_processor.js';

test('StreamWindowAnalytics computes rolling average, min, and max correctly', () => {
  const engine = new StreamWindowAnalytics(60000); // 1 minute window
  const now = Date.now();

  engine.addReading(25.0, now);
  engine.addReading(26.0, now + 1000);
  engine.addReading(27.0, now + 2000);
  const metrics = engine.addReading(28.0, now + 3000);

  assert.equal(metrics.sampleCount, 4);
  assert.equal(metrics.avgTemp5m, 26.5);
  assert.equal(metrics.minTemp, 25.0);
  assert.equal(metrics.maxTemp, 28.0);
  assert.equal(metrics.trend, 'rising');
  assert.equal(metrics.anomalyDetected, false);
});

test('StreamWindowAnalytics detects thermal anomaly spike', () => {
  const engine = new StreamWindowAnalytics(60000);
  const now = Date.now();

  engine.addReading(24.0, now);
  engine.addReading(24.2, now + 1000);
  engine.addReading(24.1, now + 2000);
  const metrics = engine.addReading(35.0, now + 3000); // sudden jump

  assert.equal(metrics.anomalyDetected, true, 'Spike should trigger anomaly alert');
});

test('StreamWindowAnalytics detects falling trend', () => {
  const engine = new StreamWindowAnalytics(60000);
  const now = Date.now();

  engine.addReading(32.0, now);
  engine.addReading(31.0, now + 1000);
  engine.addReading(29.0, now + 2000);
  const metrics = engine.addReading(27.0, now + 3000);

  assert.equal(metrics.trend, 'falling');
});
