// backend/src/targetRoutes.js  (ESM)
import { Router } from "express";
import { searchTarget } from "./targetClient.js";

const router = Router();

router.get("/ping", (_req, res) => {
  res.json({ ok: true, where: "target router" });
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "pokemon");
  const key = process.env.TARGET_WEB_KEY || "";
  const store = String(req.query.store || process.env.TARGET_STORE_ID || "");

  if (!key) {
    return res.status(500).json({
      ok: false,
      error: "Missing TARGET_WEB_KEY env var",
    });
  }

  try {
    const result = await searchTarget({ q, key, store });
    res.json({
      ok: true,
      q,
      store: store || undefined,
      total: result.items.length,
      items: result.items,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
