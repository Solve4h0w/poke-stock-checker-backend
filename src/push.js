// backend/src/push.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const SUBS_FILE = path.join(process.cwd(), "subscriptions.json");

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

let subs = loadSubs();

function toBoolInStock(status) {
  if (typeof status === "boolean") return status;
  const s = String(status).toLowerCase();
  return s.includes("in stock") || s === "true" || s === "yes" || s === "available";
}

async function sendExpoPush(to, title, body, data) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, title, body, data }),
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
  subs[item] = (subs[item] || []).filter((t) => t !== token);
  saveSubs(subs);
  return { ok: true, item, subscribers: subs[item].length };
}

// 🧠 WATCHER: polls your /api/products endpoint every minute
async function startWatcher({ apiUrl, periodMs = 60000 }) {
  console.log(`[push] Watching products at: ${apiUrl}`);
  let prevMap = new Map();

  setInterval(async () => {
    try {
      const res = await fetch(apiUrl);
      const json = await res.json();

      if (!Array.isArray(json)) {
        console.error("[push] Expected JSON array from API but got:", json);
        return;
      }

      for (const item of json) {
        const name = item.name || item.title;
        const inStock = toBoolInStock(item.inStock || item.status);

        if (!prevMap.has(name) && inStock) {
          const tokens = subs[name] || [];
          for (const t of tokens) {
            await sendExpoPush(t, `${name} in stock!`, "Available now!", { item: name });
          }
        }
        prevMap.set(name, inStock);
      }
    } catch (err) {
      console.error("[push] Poll error:", err.message);
    }
  }, periodMs);
}

// Start watcher explicitly for your deployed endpoint
const apiUrl = "https://poke-stock-checker-backend.onrender.com/api/products";
startWatcher({ apiUrl, periodMs: 60000 });

export { subscribe, unsubscribe };
