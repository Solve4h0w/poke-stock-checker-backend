// backend/src/watcher.js

import { fetchAvailability } from "./data/fetchAvailability.js";
import { sendExpoPush } from "./push.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// -----------------------------------------------------------------------------
// Resolve subscriptions.json (so this works on Render as well as locally)
// -----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SUBSCRIPTIONS_PATH = path.join(__dirname, "subscriptions.json");

// Load subscriptions.json once at startup
// Shape:
// {
//   "devices": {
//     "ExponentPushToken[ABC123...]": {
//       "items": ["93954446", "91619960", ...]
//     }
//   }
// }
let subscriptions = {};
try {
    const raw = fs.readFileSync(SUBSCRIPTIONS_PATH, "utf8");
    subscriptions = JSON.parse(raw);
} catch (err) {
    console.error("[watcher] ERROR reading subscriptions.json:", err);
    subscriptions = { devices: {} };
}

// -----------------------------------------------------------------------------
// These values MUST match what works in /api/target/store/:tcin
// We are hardcoding them right here so watcher uses the same session fingerprint.
// -----------------------------------------------------------------------------

const STORE_CFG = {
    storeId:   "2314",
    lat:       "46.230",
    lng:       "-119.240",
    zip:       "99336",
    visitorId: "01989633EB690201997B4F22E8604F90",

    // VERY IMPORTANT: full cookie blob exactly as you captured from DevTools.
    // This is the SAME cookie string you pasted earlier.
    // Do not add line breaks, keep it one long string.
    cookie:
        "sapphire=1; visitorId=01989633EB690201997B4F22E8604F90; TealeafAkaSid=xe4YCxKzH4iAnRGBR5c11tptJxc1mgUp; UserLocation=99336|46.230|-119.240|WA|US; _pxvid=60561093-763d-11f0-be94-60c91b08304b; crl8.fpcuid=55cdaada-8a4a-4be7-ad94-c465f2659ce6; 3YCzT93n=A5ZQU9CYAQAA367DZDAAcJcATrPMB_7JbvGr_gMWDj6d3KwBj01AQ7BmGAHGAWAp1T-ucr_owH8AAEB3AAAAAA|1|1|5490d5e72a3cf0eca0167717be620bd48a0e90a5; brwsr=723ad992-8227-11f0-bdbe-cd4ada1d5979; _gcl_gs=2.1.k1$i1759956141$u139466166; ci_ref=tgt_adv_xasd0002; _gcl_au=1.1.1435774098.1754866770.92319432.1759960116.1759960116; fiatsCookie=DSI_2314|DSN_Richland|DSZ_99352; BVBRANDID=ac7b9beb-b2a4-45e6-b76d-5b84365a2e4a; _gcl_aw=GCL.1760654196.CjwKCAjwr8LHBhBKEiwAy47uUnqVGKTAZWMR9n-MlS7_D1x0xuvNs1NwburLWZ7iNIJCvqbK0FrXaxoCQ0kQAvD_BwE; _gcl_dc=GCL.1760654196.CjwKCAjwr8LHBhBKEiwAy47uUnqVGKTAZWMR9n-MlS7_D1x0xuvNs1NwburLWZ7iNIJCvqbK0FrXaxoCQ0kQAvD_BwE; ci_pixmgr=imprad; ci_cpng=PTID3; ci_clkid=702cca72Nadfd11f08179890c3496a898; ci_lnm=1945656; pxcts=0c0b1623-afc6-11f0-afa2-04ca52c7145b; mid=8183471813; usprivacy=1NN-; stateprivacycontrols=N; hasApp=true; loyaltyid=tly.4a1dca57996e45e49b03f29f7740f493; profileCreatedDate=2018-08-27T22:02:50.055Z; sapphire_audiences={%22base_membership%22:true%2C%22card_membership%22:false%2C%22paid_membership%22:false}; sddStore=DSI_830|DSN_undefined|DSZ_99336; accessToken=eyJraWQiOiJlYXMyIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiI4MTgzNDcxODEzIiwiaXNzIjoiTUk2IiwiZXhwIjoxNzYxNTE3MTE2LCJpYXQiOjE3NjE0MzA3MTYsImp0aSI6IlRHVC5kMmI3OTAwMzhlNjg0MjZhYmY2NmEyYjUzZWI2MTU0MS1sIiwic2t5IjoiZWFzMiIsInN1dCI6IlIiLCJkaWQiOiI3ODhjZjVjNzk5NmRiNDJlZDJjNTQ4NjJmZjEzOTE0Y2Q2MGJlN2YxYzUwNWJjMzhjZjIzMmVhNzE0Yzc0NzJmIiwiZWlkIjoic2pmcmVlZG9tMjAxNkBnbWFpbC5jb20iLCJzY28iOiJlY29tLmxvdyxvcGVuaWQiLCJjbGkiOiJlY29tLXdlYi0xLjAuMCIsInR2MSI6IjM2NDcwNzg1IiwiYXNsIjoiTCJ9.sOJB3ROtvrTlLYzrQXuu2ppMYJ0whkXGGBK3iRd-4gqdvrgWDuGiMM36NuqSXCmkNpIo_ccBcXkJOqBIKjGfa1yh6FokHcjCvWPmRWP9t38GsvJg5a3B6oQQnRmkFFJB151JlJj40xzj006m7S_h1xxy1o_XlQLH89VPMHGHmqCJG1Y4zfk7GrSNhf_ZgW8Dbvxn4Bn39rsNSW8uzIxHS_VzDhIbXQ1_V6W8J4djCeM6xPWfzLvG9qe2135XIylcnsElw7atzt1d6slzLugHh2HLcE16AsTNRvM9_9LGJnplPy0lnDRNLdvi-OLgUBRerlnKbvhR64AANnW9B57Gsg; refreshToken=TGT.d2b790038e68426abf66a2b53eb61541-l; idToken=eyJhbGciOiJub25lIn0.eyJzdWIiOiI4MTgzNDcxODEzIiwiaXNzIjoiTUk2IiwiZXhwIjoxNzYxNTE3MTE2LCJpYXQiOjE3NjE0MzA3MTYsImFzcyI6IkwiLCJzdXQiOiJSIiwiY2xpIjoiZWNvbS13ZWItMS4wLjAiLCJwcm8iOnsiZm4iOiJTdGVwaGVuIiwiZm51IjoiU3RlcGhlbiIsImVtIjoic2pmKioqQCoqKiIsInBoIjp0cnVlLCJsZWQiOm51bGwsImx0eSI6dHJ1ZSwic3QiOiJXQSIsInNuIjoiMjMxNCJ9fQ.; adScriptData=WA; __gads=ID=5bea12f19943cf37:T=1759956045:RT=1761432042:S=ALNI_MbXRh1BjwRUUF3NKdJ9JsVGl5W-SA; __eoi=ID=47ce9b9afa47b825:T=1759956045:RT=1761432042:S=AA-Afja6J_Gtksq3cxBctB_ASUC4; granify.uuid=6e424aec-f82b-4d26-a86e-5ef0bdc5a938; granify.new_user.cq1cu=false; ffsession={%22sessionHash%22:%22e8adef0a85ce21761192558580%22%2C%22prevPageName%22:%22toys:%20product%20detail%22%2C%22prevPageType%22:%22product%20details%22%2C%22prevPageUrl%22:%22https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-prismatic-evolutions-booster-bundle/-/A-93954446#lnk=sametab%22%2C%22sessionHit%22:47%2C%22prevSearchTerm%22:%22%20pokemon%20cards%22}; granify.session.cq1cu=1761440798227; _tgt_session=bfa67e82c48248b98e844bc625f30426.df7b8c7bdcfaa9f66573cb9b99baf572b0470f0c97c937c26eabb67d77308226aef8c2ce4983ea9d2d314e45978e779d71b59201f39e35a430738471ae21d6f9461289926f986206c0fbceab80ae623a67c4481ae0876f9d5860dad1a271dc715da0de02107a6df9dc44bbad815a3d8759aff7a8bba4dedc51796fb3a06a18705a2d66be325e63d3db1ab661d92bb643c7495a6c3229bbda80b42941c2b82aa34490575175d3227e13b8940b84c9ce48d5f820da62b5e558653c8e40847b6a2502b699be0f2aa8c3703402101df6b1472a5a600f1b4a8753194b651b45f111eac1.0x26dda2eb6f41b026093ee02eb3e1f5b60d50eb05dc95af093000e022ce4fb7c2; fs_lua=1.1761441686994; fs_uid=#o-221JN4-na1#0e1fcd7e-4002-4e0e-aa84-65090ec07761:d020ccd5-ad81-47cb-a31a-62fd4f743a0f:1761440794525::2#aa740b27#/1791492192; _px3=65e923aceb6cecd791b3adf4611f541325668123960a0ee1342f4cdbda2d2fc7:VDmSILskYcDU1kpQbkB3xrCFVV0/txeCabmBCc39XJU2WQggYm+bDD6MyCOJfYQD0Pv8itWsUz5QndG+hMpMhA==:1000:Sr3iTxisBQfy2JadoZU7JajYR2NGE96BVwEV5iYjPQoD/icx6+ZRJT4OOV0FlLVexTVjXtQIZAYcUx7N5MBrdDaihSDLFUPqcprl788EDmZC5UnkoGrWL++fduE92+80QqskHPYXhtxGP5eme6nzO2XmTB7F/6OD1j6+HQwvcvGoR+tHgcZOdy3Sb7wJWJBNeTOTxpoP97xItYZ9+dvwllJGxkuhZuEOKpH0zER198s="
};

// -----------------------------------------------------------------------------
// We'll remember last known "isAvailable" state per tcin so we only spam push
// when it flips from false -> true.
// -----------------------------------------------------------------------------
const lastSeenAvailability = {}; // { [tcin]: boolean }

// helper: send push notifications to all devices watching this tcin
async function notifyDevicesAboutStock(tcin, payload) {
    // payload looks like { qty, storeName, inStoreStatus, updated, tcin }
    const devices = subscriptions.devices || {};

    for (const expoPushToken of Object.keys(devices)) {
        const entry = devices[expoPushToken];
        if (!entry || !Array.isArray(entry.items)) continue;

        if (entry.items.includes(tcin)) {
            const title = `IN STOCK: ${tcin}`;
            const body = `Qty ${payload.qty} at ${payload.storeName} (${payload.inStoreStatus})`;

            console.log("[watcher] ALERT SEND", {
                expoPushToken,
                title,
                body,
            });

            try {
                await sendExpoPush({
                    to: expoPushToken,
                    title,
                    body,
                    data: {
                        tcin,
                        qty: payload.qty,
                        storeName: payload.storeName,
                        inStoreStatus: payload.inStoreStatus,
                        updated: payload.updated,
                    },
                });
            } catch (err) {
                console.error("[watcher] push send error", err);
            }
        }
    }
}

// -----------------------------------------------------------------------------
// Poll one TCIN and decide if we should alert
// -----------------------------------------------------------------------------
async function pollOneTCIN(tcin) {
    console.log("[watcher] polling item", tcin, "...");

    let result;
    try {
        // CRITICAL: we now pass the *same exact* shape as targetRoutes does.
        result = await fetchAvailability({
            tcin,
            storeId:   STORE_CFG.storeId,
            lat:       STORE_CFG.lat,
            lng:       STORE_CFG.lng,
            zip:       STORE_CFG.zip,
            visitorId: STORE_CFG.visitorId,
            cookie:    STORE_CFG.cookie,
        });
    } catch (err) {
        console.error("[watcher] fetchAvailability threw:", err);
        return;
    }

    console.log("[watcher] poll result:", result);

    // result should look like:
    // {
    //   ok: true,
    //   status: 200,
    //   tcin,
    //   storeId,
    //   raw: { data: {...} },
    //   debug: { ...optional... }
    // }
    //
    // You may have fields like "qty", "isAvailable", etc. in your implementation,
    // OR you may still need to derive them from `result.raw`.
    //
    // Below is defensive logic that tries to extract "available" from either
    // `result.isAvailable` or (fallback) `result.raw`.

    if (!result || !result.ok) {
        console.error("[watcher] non-ok result for", tcin, result);
        return;
    }

    // Try to grab stock-y info.
    // These field names must match what fetchAvailability() returns in YOUR version.
    // In your latest screenshots, fetchAvailability() was returning something shaped like:
    // {
    //   ok:true,
    //   status:200,
    //   tcin:"93954446",
    //   storeId:"2314",
    //   raw:{ data:{ product:{ ... }, store_options:[{...}] , ... } },
    //   debug:{ contentEncoding:"gzip", decodedOK:true }
    // }
    //
    // We saw fields like:
    //   qty: 0,
    //   storeName: "Richland",
    //   inStoreStatus: "OUT_OF_STOCK",
    //   updated: "2025-10-26T18:21:23.401Z",
    //
    // We'll assume fetchAvailability() now adds these convenience fields.
    // If not, you can map them out of result.raw the same way you did earlier.

    const qty           = result.qty ?? 0;
    const storeName     = result.storeName ?? "Unknown store";
    const inStoreStatus = result.inStoreStatus ?? "UNKNOWN";
    const updated       = result.updated ?? new Date().toISOString();

    // Heuristic: consider "available" true if qty > 0 or status not OUT_OF_STOCK
    const isAvailableNow =
        qty > 0 ||
        (inStoreStatus && !/OUT_OF_STOCK|UNAVAILABLE|NOT_SOLD_IN_STORE/i.test(inStoreStatus));

    const wasAvailableBefore = lastSeenAvailability[tcin] === true;
    lastSeenAvailability[tcin] = isAvailableNow;

    // Fire push only on false -> true transition
    if (isAvailableNow && !wasAvailableBefore) {
        await notifyDevicesAboutStock(tcin, {
            qty,
            storeName,
            inStoreStatus,
            updated,
            tcin,
        });
    }
}

// -----------------------------------------------------------------------------
// pollOnce(): loop all watched TCINs
// -----------------------------------------------------------------------------
async function pollOnce() {
    // Flatten all unique tcins across all devices
    const uniqueTcins = new Set();

    const devices = subscriptions.devices || {};
    for (const expoPushToken of Object.keys(devices)) {
        const entry = devices[expoPushToken];
        if (!entry || !Array.isArray(entry.items)) continue;
        for (const tcin of entry.items) {
            uniqueTcins.add(tcin);
        }
    }

    // If you ever want to hardcode/testing, you can do:
    // uniqueTcins.clear();
    // uniqueTcins.add("93954446");

    for (const tcin of uniqueTcins) {
        try {
            await pollOneTCIN(tcin);
        } catch (err) {
            console.error("[watcher] poll error for", tcin, err);
        }
    }
}

// -----------------------------------------------------------------------------
// startWatcher(): run once, then every 60s
// -----------------------------------------------------------------------------
export function startWatcher() {
    console.log("[watcher] starting watcher loop...");
    // run immediately:
    pollOnce();
    // repeat every 60 seconds:
    setInterval(pollOnce, 60 * 1000);
}
