import express from 'express';
import { askGrok } from '../services/grokService.js';

const router = express.Router();

/**
 * POST /api/chat
 * Body: { message: string, history?: Array<{role: string, content: string}> }
 */
router.post('/', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Field "message" is required and must be a string.' });
    }

    const response = await askGrok(message, history || []);
    return res.json(response);
  } catch (error) {
    console.error('[Route: /api/chat] Error handling chat request:', error);
    return res.status(500).json({
      error: 'Internal server error while processing AI chat query.',
      details: error.message
    });
  }
});

export default router;
