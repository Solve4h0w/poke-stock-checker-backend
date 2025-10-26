// backend/src/watcher.js
//
// Background poller that checks Target stock and sends Expo pushes
// when something flips in-stock.
//
// This runs in a loop. It does NOT expose HTTP routes.
// Render will just run this file with `node src/watcher.js`.
//
// Requirements:
//   - fetchAvailability (our Target fetcher)
//   - getWatchList() to know who/what to watch
//   - sendExpoPush() to alert

import { setTimeout as sleep } from "timers/promises";
import { getWatchList, sendExpoPush } from "./push.js";
import { fetchAvailability } from "./fetchAvailability.js";

// Hardcoded Richland WA store context you already captured:
const STORE_INFO = {
  storeId: "2314",
  lat: "46.230",
  lng: "-119.240",
  zip: "99336",
  visitorId: "01989633EB690201997B4F22E8604F90",
  cookie: `sapphire=1; visitorId=01989633EB690201997B4F22E8604F90; TealeafAkaSid=xe4YCxKzH4iAnRGBR5c11tptJxc1mgUp; UserLocation=99336|46.230|-119.240|WA|US; _pxvid=60561093-763d-11f0-be94-60c91b08304b; crl8.fpcuid=55cdaada-8a4a-4be7-ad94-c465f2659ce6; 3YCzT93n=A5ZQU9CYAQAA367DZDAAcJcATrPMB_7JbvGr_gMWDj6d3KwBj01AQ7BmGAHGAWAp1T-ucr_owH8AAEB3AAAAAA|1|1|5490d5e72a3cf0eca0167717be620bd48a0e90a5; brwsr=723ad992-8227-11f0-bdbe-cd4ada1d5979; _gcl_gs=2.1.k1$i1759956141$u139466166; ci_ref=tgt_adv_xasd0002; _gcl_au=1.1.1435774098.1754866770.92319432.1759960116.1759960116; fiatsCookie=DSI_2314|DSN_Richland|DSZ_99352; BVBRANDID=ac7b9beb-b2a4-45e6-b76d-5b84365a2e4a; _gcl_aw=GCL.1760654196.CjwKCAjwr8LHBhBKEiwAy47uUnqVGKTAZWMR9n-MlS7_D1x0xuvNs1NwburLWZ7iNIJCvqbK0FrXaxoCQ0kQAvD_BwE; _gcl_dc=GCL.1760654196.CjwKCAjwr8LHBhBKEiwAy47uUnqVGKTAZWMR9n-MlS7_D1x0xuvNs1NwburLWZ7iNIJCvqbK0FrXaxoCQ0kQAvD_BwE; ci_pixmgr=imprad; ci_cpng=PTID3; ci_clkid=702cca72Nadfd11f08179890c3496a898; ci_lnm=1945656; pxcts=0c0b1623-afc6-11f0-afa2-04ca52c7145b; mid=8183471813; usprivacy=1NN-; stateprivacycontrols=N; hasApp=true; loyaltyid=tly.4a1dca57996e45e49b03f29f7740f493; profileCreatedDate=2018-08-27T22:02:50.055Z; sapphire_audiences={%22base_membership%22:true%2C%22card_membership%22:false%2C%22paid_membership%22:false}; sddStore=DSI_830|DSN_undefined|DSZ_99336; accessToken=...REDACT_IF_PUBLIC...; refreshToken=...; idToken=...; granify.uuid=...; _tgt_session=...; fs_uid=...; _px3=...`
};

// memory of last known status so we don't spam
// shape: { "<tcin>": { isAvailable: boolean, qty: number } }
const lastState = {};

// helper to check one SKU for one watcher entry
async function checkOne({ expoPushToken, tcin }) {
  try {
    const result = await fetchAvailability({
      tcin,
      storeId: STORE_INFO.storeId,
      lat: STORE_INFO.lat,
      lng: STORE_INFO.lng,
      zip: STORE_INFO.zip,
      visitorId: STORE_INFO.visitorId,
      cookie: STORE_INFO.cookie
    });

    if (!result.ok) {
      console.log(`[watcher] ${tcin} fetch not ok`, result.status, result.error);
      return;
    }

    // Pull out what we care about
    const isAvailable = Boolean(result.isAvailable ?? false);
    const qty = result.qty ?? 0;

    const prev = lastState[tcin];
    lastState[tcin] = { isAvailable, qty };

    // If it was previously unavailable OR unknown,
    // and now it's available with qty > 0 => ALERT!
    if (!prev || (!prev.isAvailable && isAvailable && qty > 0)) {
      const title = `TARGET STOCK ALERT`;
      const body = `Item ${tcin} is IN STOCK at store ${result.storeName || result.storeId} (qty ${qty})`;

      console.log("[watcher] sending push:", expoPushToken, title, body);
      await sendExpoPush(expoPushToken, title, body);
    } else {
      console.log(
        `[watcher] ${tcin} no change: available=${isAvailable} qty=${qty}`
      );
    }
  } catch (err) {
    console.error("[watcher] error checking", tcin, err);
  }
}

// main loop
async function mainLoop() {
  console.log("[watcher] starting poll loop");

  while (true) {
    try {
      const watchList = getWatchList(); // [{expoPushToken, tcin}, ...]
      console.log("[watcher] watchList", watchList);

      // check each pair serially (safer for now)
      for (const entry of watchList) {
        await checkOne(entry);
        // small delay between calls so we don't hammer Target
        await sleep(500);
      }
    } catch (err) {
      console.error("[watcher] loop error", err);
    }

    // wait 60 seconds between full sweeps
    await sleep(60_000);
  }
}

// kick it off
mainLoop().catch((err) => {
  console.error("[watcher] fatal error", err);
});
