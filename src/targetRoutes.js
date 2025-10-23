// backend/src/targetRoutes.js
import { Router } from "express";
import { searchTarget } from "./targetClient.js";

const router = Router();

/**
 * Quick “ping” route to confirm the router is mounted.
 * GET /api/target/ping -> { ok: true }
 */
router.get("/ping", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

/**
 * GET /api/target/search?q=151
 * Requires env: TARGET_WEB_KEY (and optional TARGET_STORE_ID)
 */
router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ ok: false, error: "Missing q" });

    const key = process.env.TARGET_WEB_KEY;
    const storeId = process.env.TARGET_STORE_ID || "";
    if (!key) return res.status(500).json({ ok: false, error: "Missing TARGET_WEB_KEY env" });

    const result = await searchTarget({ q, key, storeId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "Search failed" });
  }
});

export default router;
