// src/push.js (CommonJS)
const fs = require("fs");
const path = require("path");

// Persist subscriptions locally (JSON beside this file)
const SUBS_FILE = path.join(__dirname, "subscriptions.json");

function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, "utf8")); }
  catch { return {}; }
}
function saveSubs(obj) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(obj, null, 2));
}

let subs = loadSubs();   // { "<itemName>": ["ExponentPushToken[...]"] }
let prevMap = new Map(); // remembers previous in-stock state (name -> bool)

function toBoolInStock(status) {
  if (typeof status === "boolean") return status;
  const s = String(status ?? "").toLowerCase();
  return s.includes("in stock") || s === "true" || s === "yes" || s === "available";
}

async function sendExpoPush({ to, title, body, data }) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, title, body, data })
  });
  const json = await res.json();
  if (!res.ok) console.error("Expo push error:", res.status, json);
  else console.log("Expo push ok:", json?.data || json);
}

function subscribe(token, item) {
  if (!token || !item) throw new Error("token and item required");
  subs[item] = Array.from(new Set([...(subs[item] || []), token]));
  saveSubs(subs);
  return { ok: true, item, subscribers: subs[item].length };
}

function unsubscribe(token, item) {
  if (!token || !item) throw new Error("token and item required");
  subs[item] = (subs[item] || []).filter(t => t !== token);
  if (subs[item].length === 0) delete subs[item];
  saveSubs(subs);
  return { ok: true, item, subscribers: subs[item]?.length || 0 };
}

async function notifyTest(token, title = "Test Stock Alert", body = "This is a test.") {
  await sendExpoPush({ to: token, title, body, data: { type: "test" } });
  return { ok: true };
}

async function pollOnce(apiUrl) {
  const res = await fetch(apiUrl);
  const j = await res.json();
  const list = Array.isArray(j) ? j : (j.products || j.items || j.data || j.results || []);
  const nowMap = new Map();
  for (const p of list) {
    const name = p.name || p.title || p.product || "Unnamed";
    const status = p.status ?? p.availability ?? (p.inStock ? "In stock" : "Out of stock");
    nowMap.set(name, toBoolInStock(status));
  }

  for (const [name, nowIn] of nowMap.entries()) {
    const wasIn = prevMap.get(name);
    if (wasIn === false && nowIn === true && subs[name]?.length) {
      console.log(`[push] ${name} flipped IN STOCK — notifying ${subs[name].length}`);
      for (const to of subs[name]) {
        await sendExpoPush({
          to,
          title: "In stock!",
          body: `${name} is available now`,
          data: { type: "restock", item: name }
        });
      }
    }
  }
  prevMap = nowMap;
}

function startWatcher({ apiUrl, periodMs = 60_000 }) {
  console.log("[push] polling", apiUrl, "every", periodMs / 1000, "s");
  // first run now, then on interval
  pollOnce(apiUrl).catch(e => console.error("poll error:", e));
  return setInterval(() => pollOnce(apiUrl).catch(e => console.error("poll error:", e)), periodMs);
}

module.exports = { subscribe, unsubscribe, notifyTest, startWatcher };
