import express from 'express';
import { getFirebaseNode } from '../services/firebaseService.js';
import { updateAnalytics, getLatestAnalytics } from '../services/flinkBridgeService.js';

const router = express.Router();

/**
 * GET /api/analytics/summary
 * Returns computed stream metrics
 */
router.get('/summary', async (req, res) => {
  try {
    const firebaseAnalytics = await getFirebaseNode('analytics') || getLatestAnalytics();
    return res.json(firebaseAnalytics);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve analytics', details: error.message });
  }
});

/**
 * POST /api/analytics/process
 * Ingests stream processing metrics from Flink job or worker
 */
router.post('/process', async (req, res) => {
  try {
    const result = await updateAnalytics(req.body);
    return res.json({ success: true, analytics: result });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update analytics', details: error.message });
  }
});

export default router;
