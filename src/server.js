import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { Expo } from 'expo-server-sdk';

const PORT = process.env.PORT || 3000;
const DATA_URL = process.env.DATA_URL;            // google sheet csv export link
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 60);

const app = express();
app.use(cors());
app.use(express.json());

// --- in-memory cache of sheet rows
let lastFetchTime = 0;
let rowsCache = [];

// shape: { store, name, status, url }
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',').map(h => h.trim().toLowerCase());
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur);

    const obj = {};
    headers.forEach((h, i) => obj[h] = (cols[i] ?? '').trim());

    out.push({
      store:  obj.store || obj.shop || obj.retailer || 'Unknown',
      name:   obj.item  || obj.product || 'Unknown item',
      status: obj.stock || obj.status || 'Unknown',
      url:    obj.url || obj.link || ''
    });
  }
  return out;
}

async function fetchRows(force = false) {
  const now = Date.now();
  if (!force && now - lastFetchTime < CACHE_TTL_SECONDS * 1000 && rowsCache.length) {
    return rowsCache;
  }
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`CSV fetch failed ${res.status}`);
  const text = await res.text();
  rowsCache = parseCsv(text);
  lastFetchTime = now;
  return rowsCache;
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/stock', async (req, res) => {
  try {
    const rows = await fetchRows(false);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Fetch failed' });
  }
});

// ---------- PUSH ALERTS ----------
const expo = new Expo();
// subscriptions: key "store|name" -> Set of expoPushTokens
const subscriptions = new Map();
// last known status to detect transitions
const lastStatus = new Map();

const keyFor = (row) => `${row.store}|${row.name}`;
const toBool = (v) => v === true || v === 'true';

app.post('/register-device', (req, res) => {
  const { token } = req.body || {};
  if (!Expo.isExpoPushToken(token)) {
    return res.status(400).json({ ok: false, error: 'Invalid Expo token' });
  }
  // nothing else to do yet; we register per-subscription
  return res.json({ ok: true });
});

app.post('/subscribe', (req, res) => {
  const { token, key, enabled } = req.body || {};
  if (!Expo.isExpoPushToken(token)) {
    return res.status(400).json({ ok: false, error: 'Invalid token' });
  }
  if (!key) return res.status(400).json({ ok: false, error: 'Missing key' });

  const set = subscriptions.get(key) || new Set();
  if (toBool(enabled)) set.add(token); else set.delete(token);
  if (set.size) subscriptions.set(key, set); else subscriptions.delete(key);
  return res.json({ ok: true, subscribers: set.size });
});

async function pollAndNotify() {
  try {
    const rows = await fetchRows(false);
    // detect transitions to "In stock"
    for (const row of rows) {
      const key = keyFor(row);
      const status = String(row.status || '').toLowerCase();
      const prev = lastStatus.get(key);
      lastStatus.set(key, status);

      const becameInStock = prev && prev !== 'in stock' && status === 'in stock';
      if (!becameInStock) continue;

      const targets = subscriptions.get(key);
      if (!targets || !targets.size) continue;

      const messages = [...targets].map(token => ({
        to: token,
        sound: 'default',
        title: `${row.name}`,
        body: `${row.store}: In stock now`,
        data: { key, store: row.store, name: row.name, url: row.url || '' },
      }));

      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (err) {
          console.error('Expo push error', err);
        }
      }
    }
  } catch (e) {
    console.warn('Poll error', e.message);
  }
}

// poll every 60s
setInterval(pollAndNotify, 60_000);

app.listen(PORT, () => {
  console.log(`Backend running on 0.0.0.0:${PORT}`);
});
