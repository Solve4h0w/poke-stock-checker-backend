// backend/src/fetchAvailability.js
//
// Fetch live per-store inventory for a single Target item.
//
// IMPORTANT SECURITY NOTE
// - You are embedding cookie + visitor info in headers upstream (in targetRoutes).
// - Long term, move secrets to env vars, not in Git.
// - Short term, this module just accepts headers via options and does not hardcode them here.
//
// This file is responsible for:
//   1. Building the RedSky URL for that store+item
//   2. Calling RedSky with undici
//   3. Decompressing gzip if needed
//   4. Parsing out just the stuff you care about for alerts

import { request } from "undici";
import zlib from "zlib";

/**
 * Build the RedSky URL (product_fulfillment_and_variation_hierarchy_v1)
 * for exactly one tcin at one store.
 *
 * We keep these params consistent with what you captured in DevTools for Richland.
 *
 * @param {object} opts
 * @param {string} opts.tcin       e.g. "93954446"
 * @param {string} opts.storeId    e.g. "2314"
 * @param {string} opts.lat        e.g. "46.230"
 * @param {string} opts.lng        e.g. "-119.240"
 * @param {string} opts.zip        e.g. "99336"
 * @param {string} opts.visitorId  e.g. "01989633EB690201997B4F22E8604F90"
 */
function buildUrl({
  tcin,
  storeId,
  lat,
  lng,
  zip,
  visitorId,
}) {
  //
  // Params taken from your captured network call. We keep most
  // static except the store + tcin + visitorId + geo bits.
  //
  // NOTE: scheduled_delivery_store_id and state=WA were in your capture.
  // We leave them in because Target expects a consistent shape.
  //
  const KEY = "9f36aeafbe60771e321a7cc95a78140772ab3e96";

  const qs = new URLSearchParams({
    key: KEY,
    required_store_id: storeId,
    latitude: lat,
    longitude: lng,
    scheduled_delivery_store_id: "830",
    state: "WA",
    zip,
    store_id: storeId,
    paid_membership: "false",
    base_membership: "true",
    card_membership: "false",
    is_bot: "false",
    tcin,
    visitor_id: visitorId,
    channel: "WEB",
    page: `/p%2FA-${tcin}`,
  });

  return `https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_and_variation_hierarchy_v1?${qs.toString()}`;
}

/**
 * Build headers that mimic your browser.
 *
 * We let the caller (targetRoutes) provide the giant Cookie string, so
 * we don't hardcode secrets here.
 *
 * @param {string} tcin
 * @param {string} cookie
 */
function buildHeaders(tcin, cookie) {
  return {
    // normal request headers we can send:
    "accept": "application/json",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",

    // your captured cookie (HUGE). passed in from router.
    "cookie": cookie,

    "dnt": "1",
    "origin": "https://www.target.com",
    "priority": "u=1, i",

    // Referer shaped like real PDP
    "referer": `https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-prismatic-evolutions-booster-bundle/-/A-${tcin}`,

    // UA from your browser capture
    "user-agent":
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',

    // misc fetch-y headers from capture
    "sec-ch-ua": '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
  };
}

/**
 * Safely gunzip a Buffer (sync is fine for these tiny payloads).
 * If it's not valid gzip, we'll just throw.
 */
function tryGunzip(buffer) {
  try {
    return zlib.gunzipSync(buffer);
  } catch (err) {
    return null;
  }
}

/**
 * Fetch availability for ONE item at ONE store.
 *
 * @param {object} opts
 * @param {string} opts.tcin
 * @param {string} opts.storeId
 * @param {string} opts.lat
 * @param {string} opts.lng
 * @param {string} opts.zip
 * @param {string} opts.visitorId
 * @param {string} opts.cookie   (full Cookie header captured from DevTools)
 */
export async function fetchAvailability({
  tcin,
  storeId,
  lat,
  lng,
  zip,
  visitorId,
  cookie,
}) {
  const url = buildUrl({
    tcin,
    storeId,
    lat,
    lng,
    zip,
    visitorId,
  });

  const headers = buildHeaders(tcin, cookie);

  // Call RedSky
  const res = await request(url, {
    method: "GET",
    headers,
  });

  const { statusCode } = res;

  // We read the raw body as Buffer
  const rawBuf = await res.body.arrayBuffer();
  const nodeBuf = Buffer.from(rawBuf);

  // Did Target say it's gzip?
  const contentEncoding =
    res.headers["content-encoding"] ||
    res.headers["Content-Encoding"] ||
    "";

  let text;
  if (
    typeof contentEncoding === "string" &&
    contentEncoding.toLowerCase().includes("gzip")
  ) {
    // Try gunzip
    const unzipped = tryGunzip(nodeBuf);
    if (!unzipped) {
      // gzip but we couldn't decode it
      return {
        ok: false,
        status: statusCode,
        error: "Could not gunzip Target response",
        snippet: nodeBuf.toString("base64").slice(0, 500),
        debug: {
          contentEncoding,
          decodedOK: false,
        },
      };
    }
    text = unzipped.toString("utf8");
  } else {
    // Not marked gzip, treat buffer as utf8 text.
    text = nodeBuf.toString("utf8");
  }

  // If NOT 200, just bubble up some debug so we can see what's going on.
  if (statusCode !== 200) {
    return {
      ok: false,
      status: statusCode,
      error: "Non-200 from Target",
      snippet: text.slice(0, 500),
      debug: {
        contentEncoding,
        decodedOK: true,
      },
    };
  }

  // Parse JSON
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    // still return debug info
    return {
      ok: false,
      status: statusCode,
      error: "Bad JSON from Target",
      snippet: text.slice(0, 500),
      debug: {
        contentEncoding,
        decodedOK: true,
      },
    };
  }

  // ---- Pull important fields out of RedSky's deep shape ----
  //
  // We'll walk to:
  // json.data.product.fulfillment.store_options[0]
  //
  // That usually has:
  //   store_options[0].store.location_name
  //   store_options[0].store.mailing_address
  //   store_options[0].in_store_only.availability_status
  //   store_options[0].order_pickup.availability_status
  //   store_options[0].available_to_promise_quantity
  //
  // If anything is missing we'll fallback.

  const fulfillment =
    json?.data?.product?.fulfillment || {};

  const storeOption0 =
    Array.isArray(fulfillment.store_options) &&
    fulfillment.store_options.length > 0
      ? fulfillment.store_options[0]
      : null;

  const resolvedStoreName =
    storeOption0?.store?.location_name || "Unknown store";

  const addressObj = storeOption0?.store?.mailing_address || {};
  const inStoreOnlyStatus =
    storeOption0?.in_store_only?.availability_status || "UNKNOWN";
  const pickupStatus =
    storeOption0?.order_pickup?.availability_status || "UNKNOWN";
  const shipToStoreStatus =
    storeOption0?.ship_to_store?.availability_status || "UNKNOWN";

  // quantity Target thinks it can promise at that location
  const atpQty =
    typeof storeOption0?.available_to_promise_quantity === "number"
      ? storeOption0.available_to_promise_quantity
      : 0;

  // a single "is there any stock?" view we can alert on
  const isAvailable =
    (inStoreOnlyStatus !== "OUT_OF_STOCK" &&
      inStoreOnlyStatus !== "UNAVAILABLE") ||
    atpQty > 0;

  // Build final shape
  const out = {
    ok: true,
    status: statusCode,

    // basic identity
    tcin,
    storeId,
    storeName: resolvedStoreName,
    zip,

    // high level availability decision
    isAvailable,          // true if not marked out of stock OR qty > 0
    qty: atpQty,          // numeric available_to_promise_quantity

    // channel-specific statuses
    inStoreStatus: inStoreOnlyStatus,      // e.g. "OUT_OF_STOCK"
    pickupStatus,                          // e.g. "UNAVAILABLE"
    shipToStoreStatus,                     // e.g. "UNAVAILABLE"

    // for debugging / display
    updated: new Date().toISOString(),
    address: {
      line1: addressObj.address_line1 || null,
      city: addressObj.city || null,
      state: addressObj.state || null,
      postal_code: addressObj.postal_code || null,
    },

    // keep the full Target JSON and decode/debug context,
    // so you can inspect from the browser.
    raw: json,
    debug: {
      contentEncoding,
      decodedOK: true,
    },
  };

  return out;
}
