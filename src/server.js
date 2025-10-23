// backend/src/server.js  (CommonJS)
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const push = require("./push");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- TEMP PRODUCTS STUB (OK to deploy; replace later with real data) ----------
app.get("/api/products", (req, res) => {
  res.json([
    { name: "151 etb", store: "Walmart", status: "In stock", url: "https://walmart.com" },
    { name: "Obsidian Flames Booster Box", store: "Target", status: "Out of stock", url: "https://target.com" },
    { name: "Scarlet and Violet Booster Pack", store: "BestBuy", status: "In stock", url: "https://bestbuy.com" }
  ]);
});
// -------------------------------------------------------------------------------------

// Health
app.get("/health", (_req, res) => {
  res.json({ status: true, ts: Date.now() });
});

// Subscribe / Unsubscribe / Test push
app.post("/subscribe", (req, res) => {
  try {
    const { token, item } = req.body || {};
    if (!token || !item) return res.status(400).json({ ok: false, error: "token and item required" });
    return res.json(push.subscribe(token, item));
  } catch (e) {
    console.error(e); return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/unsubscribe", (req, res) => {
  try {
    const { token, item } = req.body || {};
    if (!token || !item) return res.status(400).json({ ok: false, error: "token and item required" });
    return res.json(push.unsubscribe(token, item));
  } catch (e) {
    console.error(e); return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/notify-test", async (req, res) => {
  try {
    const { token, title, body } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: "token required" });
    const out = await push.notifyTest(token, title, body);
    return res.json(out);
  } catch (e) {
    console.error(e); return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ---------- Start server & watcher ----------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("Server listening on", PORT);

  const base =
    process.env.PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${PORT}`;

  // Point the watcher to PRODUCTS_PATH (default to the stub)
  const pathFromEnv = (process.env.PRODUCTS_PATH || "/api/products").trim();
  const apiUrl = `${base}${pathFromEnv.startsWith("/") ? pathFromEnv : `/${pathFromEnv}`}`;

  console.log(`[push] using products endpoint: ${apiUrl}`);
  push.startWatcher({ apiUrl, periodMs: 60_000 });
});

module.exports = app;

