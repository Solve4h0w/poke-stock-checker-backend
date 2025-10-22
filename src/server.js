// src/server.js (CommonJS)
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const push = require("./push");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Health for the app's status line
app.get("/health", (req, res) => {
  res.json({ status: true, ts: Date.now() });
});

/*
 // If you need a temporary stub for testing, uncomment this:
 app.get("/api/products", (req, res) => {
   res.json([
     { name: "151 etb", store: "Walmart", status: "In stock", url: "https://walmart.com" },
     { name: "Obsidian Flames Booster Box", store: "Target", status: "Out of stock", url: "https://target.com" },
     { name: "Scarlet and Violet Booster Pack", store: "BestBuy", status: "In stock", url: "https://bestbuy.com" }
   ]);
 });
*/

// Subscribe / Unsubscribe / Test routes
app.post("/subscribe", (req, res) => {
  try {
    const { token, item } = (req.body || {});
    if (!token || !item) {
      return res.status(400).json({ ok: false, error: "token and item required", received: req.body });
    }
    return res.json(push.subscribe(token, item));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/unsubscribe", (req, res) => {
  try {
    const { token, item } = (req.body || {});
    if (!token || !item) {
      return res.status(400).json({ ok: false, error: "token and item required", received: req.body });
    }
    return res.json(push.unsubscribe(token, item));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/notify-test", async (req, res) => {
  try {
    const { token, title, body } = (req.body || {});
    if (!token) return res.status(400).json({ ok: false, error: "token required" });
    const out = await push.notifyTest(token, title, body);
    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---------- Start server ----------
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log("Server listening on", PORT);

  const base =
    process.env.PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${PORT}`;

  // Try the same set your app uses
  const candidates = [
    "/api/products",
    "/products",
    "/api/v1/products",
    "/items",
    "/api/items",
    "/stock",
    "/api/stock",
    "/list",
    "/api/list",
    "/"
  ];

  // Find first endpoint that returns JSON with a list of products
  (async () => {
    for (const p of candidates) {
      const url = `${base}${p}`;
      try {
        const res = await fetch(url);
        const text = await res.text();

        // skip HTML pages
        if (/<!doctype html>|<html/i.test(text)) {
          continue;
        }

        let json;
        try { json = JSON.parse(text); } catch { continue; }

        const list = Array.isArray(json)
          ? json
          : json?.products || json?.items || json?.data || json?.results || null;

        if (Array.isArray(list)) {
          console.log(`[push] using products endpoint: ${url}`);
          push.startWatcher({ apiUrl: url, periodMs: 60_000 });
          return;
        }
      } catch (e) {
        // try next
      }
    }

    console.warn("[push] No working products endpoint found. Watcher disabled.");
  })().catch(e => console.error("watcher bootstrap error:", e));
});

module.exports = server;
