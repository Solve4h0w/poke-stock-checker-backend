// backend/src/targetRoutes.js
//
// Express router exposing Target endpoints.
// We now provide /api/target/item/:tcin  -> single-product availability.

import { Router } from "express";
import { fetchItemStatus } from "./targetClient.js";

const router = Router();

/**
 * Simple ping for debugging (OPTIONAL)
 * GET /api/target/ping
 */
router.get("/ping", (req, res) => {
  res.json({ ok: true, msg: "targetRoutes alive" });
});

/**
 * GET /api/target/item/:tcin
 *
 * Example:
 *   /api/target/item/93954446
 *
 * Response shape:
 *   {
 *     ok: true,
 *     tcin: "93954446",
 *     title: "...",
 *     price: "...",
 *     pickup: { available: true/false, qty: number|null },
 *     ship: { available: true/false, qty: number|null },
 *     raw: {...}   // full Target JSON
 *   }
 *
 * or { ok: false, status: <code>, error: "...", snippet: "..." }
 */
router.get("/item/:tcin", async (req, res) => {
  const { tcin } = req.params || {};
  if (!tcin) {
    return res.status(400).json({ ok: false, error: "Missing tcin" });
  }

  try {
    const result = await fetchItemStatus(tcin);

    if (!result.ok) {
      // bubble up status if we have it
      return res
        .status(result.status || 502)
        .json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error("[target/item] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown error",
    });
  }
});

export default router;
