import express from 'express';
import { getSystemSnapshot, pushFirebaseNode, setFirebaseNode } from '../services/firebaseService.js';
import { emitEvent } from '../services/kafkaService.js';
import { TOPICS } from '../config/kafka.js';

const router = express.Router();

/**
 * GET /api/telemetry/current
 * Returns current snapshot of all sensors, devices, and schedules
 */
router.get('/current', async (req, res) => {
  try {
    const snapshot = await getSystemSnapshot();
    return res.json(snapshot);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch telemetry snapshot', details: error.message });
  }
});

/**
 * POST /api/telemetry/event
 * Ingests an event from IoT / Camera Gestures / UI, updates Kafka and Firebase
 */
router.post('/event', async (req, res) => {
  try {
    const { type, payload } = req.body;
    if (!type || !payload) {
      return res.status(400).json({ error: 'Fields "type" and "payload" are required.' });
    }

    let topic = TOPICS.SENSORS;
    if (type.startsWith('device_')) topic = TOPICS.DEVICES;
    if (type.startsWith('gesture_')) topic = TOPICS.GESTURES;

    const eventResult = await emitEvent(topic, { type, ...payload });

    // Handle device toggle or gesture action
    if (type === 'gesture_detected' && payload.action) {
      const lightVal = payload.action === 'LIGHT_ON' ? 1 : 0;
      await pushFirebaseNode('light1', lightVal);
      await pushFirebaseNode('light3', lightVal);
    }

    return res.json({ success: true, eventResult });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to record event', details: error.message });
  }
});

/**
 * POST /api/telemetry/device
 * Direct endpoint to toggle devices (Light 1, Light 2, Light 3, SafeMode)
 */
router.post('/device', async (req, res) => {
  try {
    const { device, value } = req.body;
    if (!device || value === undefined) {
      return res.status(400).json({ error: 'Device name and value (0 or 1) required' });
    }

    const numVal = Number(value) === 1 ? 1 : 0;
    await pushFirebaseNode(device, numVal);
    await emitEvent(TOPICS.DEVICES, { device, value: numVal, timestamp: new Date().toISOString() });

    return res.json({ success: true, device, value: numVal });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to toggle device', details: error.message });
  }
});

export default router;
