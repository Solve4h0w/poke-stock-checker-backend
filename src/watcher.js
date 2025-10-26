// backend/src/watcher.js
//
// Periodically poll one (tcin, store) and fire a push notification
// the moment it flips in stock.
//

import { fetchAvailability } from "./fetchAvailability.js";
import { sendExpoPush } from "./push.js"; // you already have this in push.js

// CONFIG: fill these in for your Target + device
const WATCH_ITEM_TCID = "93954446";     // Pokémon bundle
const WATCH_STORE_ID = "2314";          // Richland store
const WATCH_LAT = "46.230";             // from your capture
const WATCH_LNG = "-119.240";           // from your capture
const WATCH_ZIP = "99336";              // from your capture
const WATCH_VISITOR_ID = process.env.TARGET_VISITOR_ID;
const WATCH_COOKIE = process.env.TARGET_COOKIE;

// your Expo push token (phone/subscriber) — you'll store this in subscriptions.json
// or you can hardcode for now if you're testing.
const WATCH_SUBSCRIBERS = [
  // example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
];

let lastWasAvailable = false;

async function pollOnce() {
  try {
    const result = await fetchAvailability({
      tcin: WATCH_ITEM_TCID,
      storeId: WATCH_STORE_ID,
      lat: WATCH_LAT,
      lng: WATCH_LNG,
      zip: WATCH_ZIP,
      visitorId: WATCH_VISITOR_ID,
      cookie: WATCH_COOKIE,
    });

    console.log("[watcher] poll result:", {
      isAvailable: result.isAvailable,
      qty: result.qty,
      storeName: result.storeName,
      inStoreStatus: result.inStoreStatus,
      updated: result.updated,
    });

    // Detect flip from "not available" → "available"
    if (!lastWasAvailable && result.isAvailable) {
      const title = "In Stock Alert 🚨";
      const body = `${result.storeName}: ${result.qty} available now`;
      const data = {
        type: "restock",
        tcin: WATCH_ITEM_TCID,
        storeId: WATCH_STORE_ID,
        qty: result.qty,
      };

      // send to each subscribed device
      for (const token of WATCH_SUBSCRIBERS) {
        await sendExpoPush({ to: token, title, body, data });
      }

      console.log("[watcher] ALERT SENT", { title, body, data });
    }

    // remember for next loop
    lastWasAvailable = result.isAvailable;
  } catch (err) {
    console.error("[watcher] poll error", err);
  }
}

// Start a repeating timer.
// You can tune this period. 60 * 1000 = 60s.
// Be nice to Target: don't hammer them every second.
export function startWatcher() {
  console.log("[watcher] starting watcher loop...");
  pollOnce(); // run immediately
  setInterval(pollOnce, 60 * 1000); // then repeat
}
