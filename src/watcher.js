// backend/src/watcher.js
//
// Poll Target repeatedly for each watched item/TCIN
// and send Expo push alerts when something becomes available.

import { fetchAvailability } from "./fetchAvailability.js";
import { sendExpoPush } from "./push.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to subscriptions.json in this same src folder
const SUBS_PATH = path.join(__dirname, "subscriptions.json");

// Keep memory of last known availability per item, so we only alert when it flips
// Structure: { [tcin]: { wasAvailable: boolean } }
const lastState = {};

// Helper: load subscriptions file
function loadSubscriptions() {
  try {
    const raw = fs.readFileSync(SUBS_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[watcher] Failed to read subscriptions.json", err);
    return { devices: {} };
  }
}

// Helper: given the subscriptions structure, build a flat list of
// { token, tcin } pairs we should poll.
function buildWatchList(subscriptions) {
  const out = [];

  // subscriptions.devices = {
  //   "<ExpoPushTokenX>": { "items": ["93954446", "94681784", ...] },
  //   "<ExpoPushTokenY>": { "items": [...] }
  // }

  for (const [expoToken, data] of Object.entries(subscriptions.devices || {})) {
    const items = data.items || [];
    for (const tcin of items) {
      out.push({ expoToken, tcin });
    }
  }

  return out;
}

// Poll one TCIN from Target using fetchAvailability()
async function checkOne({ expoToken, tcin }) {
  // Richland store hard-coded for now.
  // These values match what we used in fetchAvailability.js:
  //   storeId: "2314"
  //   lat: "46.230"
  //   lng: "-119.240"
  //   zip: "99336"
  //   plus your cookie string, already inside fetchAvailability() via buildHeaders()
  try {
    console.log(`[watcher] polling item ${tcin}...`);

    const result = await fetchAvailability({
      tcin,
      storeId: "2314",
      lat: "46.230",
      lng: "-119.240",
      zip: "99336",
      // cookie and visitorId etc are handled in fetchAvailability.js
    });

    console.log("[watcher] poll result:", JSON.stringify(result, null, 2));

    if (!result.ok) {
      // Target call failed or weird response
      return;
    }

    const isAvailableNow = !!result.isAvailable; // we set this downstream when qty>0 etc
    const prevState = lastState[tcin]?.wasAvailable ?? false;

    // If it just flipped from false -> true, ALERT 🚨
    if (isAvailableNow && !prevState) {
      const title = `Stock Alert @ ${result.storeName || "Target"}`;
      const body = `Item ${tcin} is now IN STOCK (${result.qty} on hand).`;
      const data = {
        tcin,
        qty: result.qty,
        storeName: result.storeName,
        inStoreStatus: result.inStoreStatus,
        updated: result.updated,
      };

      console.log("[watcher] ALERT SENT", { title, body, data });

      await sendExpoPush({
        expoPushToken: expoToken,
        title,
        body,
        data,
      });
    }

    // Update memory for next loop
    lastState[tcin] = { wasAvailable: isAvailableNow };
  } catch (err) {
    console.error("[watcher] poll error", err);
  }
}

// One full polling pass over EVERY watched (token,tcin) combo
async function pollOnce() {
  const subs = loadSubscriptions();
  const watchList = buildWatchList(subs);

  // Iterate each (expoToken, tcin)
  for (const pair of watchList) {
    // eslint-disable-next-line no-await-in-loop
    await checkOne(pair);
  }
}

// Public: start the repeating loop
export function startWatcher() {
  console.log("[watcher] starting watcher loop...");

  // run immediately:
  pollOnce();

  // then repeat every 60s
  setInterval(pollOnce, 60 * 1000);
}
