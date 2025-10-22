// backend/pushRoutes.js
// Mounts /subscribe, /unsubscribe, /notify-test and starts the stock watcher.

const cors = require("cors");
const push = require("./push");

module.exports = function attachPush(app) {
  // Allow JSON + CORS for these endpoints (harmless if you already use them)
  app.use(cors());
  app.use(require("express").json());

  // ---- Subscribe to alerts for an item ----
  app.post("/subscribe", (req, res) => {
    try {
      const { token, item } = req.body || {};
      return res.json(push.subscribe(token, item));
    } catch (e) {
      console.error(e);
      return res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ---- Unsubscribe ----
  app.post("/unsubscribe", (req, res) => {
    try {
      const { token, item } = req.body || {};
      return res.json(push.unsubscribe(token, item));
    } catch (e) {
      console.error(e);
      return res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ---- Manual test push ----
  app.post("/notify-test", async (req, res) => {
    try {
      const { token, title, body } = req.body || {};
      const result = await push.notifyTest(token, title, body);
      return res.json(result);
    } catch (e) {
      console.error(e);
      return res.status(400).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ---- Start the watcher (polls your products endpoint every minute) ----
  // Adjust this path if your products live somewhere else.
  const port = process.env.PORT || 3001;
  const base =
    process.env.PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${port}`;

  const pollUrl = `${base}/api/products`; // <— change if needed (e.g. `/products`)
  push.startWatcher({ apiUrl: pollUrl, periodMs: 60_000 });
};
