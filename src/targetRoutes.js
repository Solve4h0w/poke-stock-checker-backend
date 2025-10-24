// backend/src/targetRoutes.js
import { Router } from 'express';
import { searchTarget } from './targetClient.js';

const router = Router();

// GET /api/target/search?q=151
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) {
    return res.status(400).json({ ok: false, error: 'Missing q' });
  }

  try {
    const result = await searchTarget(q);
    res.json(result);
  } catch (err) {
    res.status(502).json({ ok: false, error: String(err.message || err) });
  }
});

export default router;
