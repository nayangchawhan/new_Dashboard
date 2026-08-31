import express from 'express';
import { getFirebaseNode } from '../services/firebaseService.js';
import { updateAnalytics, getLatestAnalytics } from '../services/flinkBridgeService.js';
import { diagnoseThermalHazard, analyzeSpecificSpike } from '../services/grokService.js';

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

/**
 * POST /api/analytics/thermal-diagnostics
 * AI-powered Fire vs Normal Thermal Rise Diagnostic Assessment (Groq LLM)
 */
router.post('/thermal-diagnostics', async (req, res) => {
  try {
    const diagnosis = await diagnoseThermalHazard(req.body || {});
    return res.json(diagnosis);
  } catch (error) {
    return res.status(500).json({ error: 'Diagnostic evaluation failed', details: error.message });
  }
});

/**
 * POST /api/analytics/spike-analysis
 * AI-powered Individual Anomaly Alert Analysis (Past + Future + Fire Risk)
 */
router.post('/spike-analysis', async (req, res) => {
  try {
    const analysis = await analyzeSpecificSpike(req.body || {});
    return res.json(analysis);
  } catch (error) {
    return res.status(500).json({ error: 'Spike analysis failed', details: error.message });
  }
});

export default router;
