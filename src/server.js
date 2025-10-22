// backend/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const push = require("./push");

const app = express();

// ---- Middleware (order matters) ----
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Optional health endpoint for the app's status line
app.get("/health", (req, res) => {
  res.json({ status: true, ts: Date.now() });
});

// -----------------------------
// YOUR EXISTING PRODUCT ROUTES
// -----------------------------
// Make sure you expose products at /api/products (or change pollUrl below).
// Example only (remove if you already have a real one):
// app.get("/api/products", (req, res) => {
//   res.json([
//     { name: "151 etb", store: "Walmart", status: "In stock", url: "https://walmart.com" },
//     { name: "Obsidian Flames Booster Box", store: "Target", status: "Out of stock", url: "https://target.com" },
//     { name: "Scarlet and Violet Booster Pack", store: "BestBuy", status: "In stock", url: "https://bestbuy.com" },
//   ]);
// });

// -----------------------------
// PUSH: subscribe / unsubscribe / test
// -----------------------------
app.post("/subscribe", (req, res) => {
  try {
    console.log("[/subscribe] headers:", req.headers);
    console.log("[/subscribe] body:", req.body);
    const { token, item } = req.body || {};
    if (!token || !item) {
      return res
        .status(400)
        .json({ ok: false, error: "token and item required", received: req.body });
    }
    return res.json(push.subscribe(token, item));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/unsubscribe", (req, res) => {
  try {
    console.log("[/unsubscribe] body:", req.body);
    const { token, item } = req.body || {};
    if (!token || !item) {
      return res
        .status(400)
        .json({ ok: false, error: "token and item required", received: req.body });
    }
    return res.json(push.unsubscribe(token, item));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/notify-test", async (req, res) => {
  try {
    console.log("[/notify-test] body:", req.body);
    const { token, title, body } = req.body || {};
    if (!token) {
      return res.status(400).json({ ok: false, error: "token required" });
    }
    const out = await push.notifyTest(token, title, body);
    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// -----------------------------
// START SERVER + START WATCHER
// -----------------------------
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log("Server listening on", PORT);

  const base =
    process.env.PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${PORT}`;

  // Change this path if your products route differs
  const pollUrl = `${base}/api/products`;

  push.startWatcher({ apiUrl: pollUrl, periodMs: 60_000 });
});

module.exports = server;
