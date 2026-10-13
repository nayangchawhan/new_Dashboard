import express from 'express';
import { askGrok, setRuntimeApiKey } from '../services/grokService.js';

const router = express.Router();

/**
 * POST /api/chat
 * Body: { message: string, history?: Array<{role: string, content: string}>, apiKey?: string }
 */
router.post('/', async (req, res) => {
  try {
    const { message, history, apiKey } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Field "message" is required and must be a string.' });
    }

    const response = await askGrok(message, history || [], apiKey);
    return res.json(response);
  } catch (error) {
    console.error('[Route: /api/chat] Error handling chat request:', error);
    return res.status(500).json({
      error: 'Internal server error while processing AI chat query.',
      details: error.message
    });
  }
});

/**
 * POST /api/chat/key
 * Dynamically updates the active runtime API key
 */
router.post('/key', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'Field "apiKey" is required.' });
  }

  setRuntimeApiKey(apiKey.trim());
  return res.json({ success: true, message: 'Runtime AI API key updated successfully.' });
});

export default router;
