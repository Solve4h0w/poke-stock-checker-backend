// backend/src/push.js
//
// Handles:
// - tracking subscribers per item
// - sending Expo push notifications
// - polling logic helpers (but NOT the watcher loop itself anymore;
//   Render will call watcher.js separately)

import { request } from "undici";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

//
// --- setup local file for subscriptions memory
//
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUBS_FILE = path.join(__dirname, "subscriptions.json");

function loadSubs() {
  try {
    return JSON.parse(fs.readFileSync(SUBS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveSubs(obj) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(obj, null, 2));
}

// remembers last in-stock state per item (name -> bool)
let prevMap = new Map();

function toBoolInStock(status) {
  if (typeof status === "boolean") return status;
  const s = String(status ?? "").toLowerCase();
  return s.includes("in stock") || s === "true" || s === "yes" || s === "available";
}

//
// --- send push to Expo
//
export async function sendExpoPush({ to, title, body, data }) {
  const res = await request("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, title, body, data }),
  });

  const json = await res.body.json();
  if (!res.ok) {
    console.error("[push] Expo push error:", res.status, json);
  } else {
    console.log("[push] Expo push ok:", json?.data || json);
  }
}

//
// --- subscribe / unsubscribe
//
export function subscribe(token, item) {
  if (!token || !item) throw new Error("token and item required");
  const subs = loadSubs();
  subs[item] = Array.from(new Set([...(subs[item] || []), token]));
  saveSubs(subs);
  return { ok: true, item, subscribers: subs[item].length };
}

export function unsubscribe(token, item) {
  if (!token || !item) throw new Error("token and item required");
  const subs = loadSubs();
  subs[item] = (subs[item] || []).filter((t) => t !== token);
  if (!subs[item].length) delete subs[item];
  saveSubs(subs);
  return { ok: true, item, subscribers: subs[item]?.length || 0 };
}

//
// --- notifyTest helper
//
export async function notifyTest(token, title = "Test Stock Alert", body = "This is a test.") {
  await sendExpoPush({
    to: token,
    title,
    body,
    data: { type: "test" },
  });
  return { ok: true };
}

//
// --- pollOnce + startWatcher used to live here.
//     BUT watcher.js now imports pollOnce/startWatcher.
//     We still export them so watcher.js can call them.
//

// We'll import fetchAvailability lazily inside pollOnce to avoid circular import.
async function pollOnceInternal({ apiUrl }) {
  // this function body will be replaced by watcher.js using fetchAvailability(),
  // so here we just leave a placeholder to make sure push.js exports names
  throw new Error(
    "pollOnceInternal called directly. watcher.js should implement polling using fetchAvailability()."
  );
}

// we export stubs ONLY so watcher.js can import the names without crashing
export async function pollOnce() {
  return pollOnceInternal({ apiUrl: "" });
}

export function startWatcher() {
  console.log("[watcher] startWatcher() stubbed on Render free tier.");
  // on free tier, Render may sleep so we don't auto-setInterval here.
  return null;
}

// Also export prevMap so watcher.js can update state between polls
export { prevMap, toBoolInStock, loadSubs };
