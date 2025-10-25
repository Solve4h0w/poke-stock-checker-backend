// backend/src/targetRoutes.js
import { Router } from 'express';
import { searchTarget } from './targetClient.js';

const router = Router();

// pull all the Target config from env (and fallbacks to avoid crashes if missing)
const STORE_ID    = process.env.TARGET_STORE_ID    || '2314';
const WEB_KEY     = process.env.TARGET_WEB_KEY     || '';
const VISITOR_ID  = process.env.TARGET_VISITOR_ID  || '';

router.get('/search', async (req, res) => {
  try {
    if (!WEB_KEY) {
      return res
        .status(500)
        .json({ ok: false, error: 'TARGET_WEB_KEY missing' });
    }

    if (!VISITOR_ID) {
      return res
        .status(500)
        .json({ ok: false, error: 'TARGET_VISITOR_ID missing' });
    }

    const q = (req.query.q || '').toString().trim();
    if (!q) {
      return res.status(400).json({ ok: false, error: 'Missing q' });
    }

    // Pretend the request originated from target.com
    const originHost = 'www.target.com';

    // Ask Target
    const result = await searchTarget({
      q,
      storeId: STORE_ID,
      webKey: WEB_KEY,
      visitorId: VISITOR_ID,
      originHost,
    });

    if (!result.ok) {
      // surface debug status/snippet if we couldn't get 200 from Target
      return res.status(502).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[target/search] error:', err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || 'Unknown error' });
  }
});

export default router;
