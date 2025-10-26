// backend/src/push.js
//
// Handles:
//   - storing which devices want alerts for which Target items
//   - sending Expo push notifications
//
// IMPORTANT: this version EXPORTS sendExpoPush()
// so watcher.js can import it on Render without crashing.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { request } from "undici";

// --------------------------------------------------
// little helper so we can write/read a local json file
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// we'll keep simple subscription data here on disk
const SUB_PATH = path.join(__dirname, "subscriptions.json");

// ensure file exists
function ensureSubFile() {
  if (!fs.existsSync(SUB_PATH)) {
    fs.writeFileSync(
      SUB_PATH,
      JSON.stringify(
        {
          // shape:
          // devices: {
          //   "<expoPushToken>": {
          //      items: ["93954446", "12345678", ...]
          //   }
          // }
          devices: {}
        },
        null,
        2
      ),
      "utf-8"
    );
  }
}

function loadSubs() {
  ensureSubFile();
  const raw = fs.readFileSync(SUB_PATH, "utf-8");
  return JSON.parse(raw);
}

function saveSubs(json) {
  fs.writeFileSync(SUB_PATH, JSON.stringify(json, null, 2), "utf-8");
}

// --------------------------------------------------
// registerDevice(expoPushToken, tcin)
//   - store that this device wants alerts for this TCIN
// --------------------------------------------------
export function registerDevice(expoPushToken, tcin) {
  const data = loadSubs();
  if (!data.devices[expoPushToken]) {
    data.devices[expoPushToken] = { items: [] };
  }
  if (!data.devices[expoPushToken].items.includes(tcin)) {
    data.devices[expoPushToken].items.push(tcin);
  }
  saveSubs(data);
  return { ok: true };
}

// --------------------------------------------------
// getWatchList()
//   -> returns [{ expoPushToken, tcin }, ...]
//   this is what watcher.js will iterate over
// --------------------------------------------------
export function getWatchList() {
  const data = loadSubs();
  const out = [];
  for (const [expoPushToken, rec] of Object.entries(data.devices)) {
    for (const tcin of rec.items) {
      out.push({ expoPushToken, tcin });
    }
  }
  return out;
}

// --------------------------------------------------
// sendExpoPush(token, title, body)
//   - actually call Expo's push API
// --------------------------------------------------
export async function sendExpoPush(expoPushToken, title, body) {
  // Expo push REST endpoint
  const EXPO_URL = "https://exp.host/--/api/v2/push/send";

  const payload = [
    {
      to: expoPushToken,
      sound: "default",
      title,
      body
    }
  ];

  // use undici.request to POST
  const res = await request(EXPO_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "accept-encoding": "gzip, deflate",
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.body.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  // not throwing, just logging. watcher.js can keep going either way
  console.log("[sendExpoPush] status", res.statusCode, "resp", json);
  return { status: res.statusCode, resp: json };
}
