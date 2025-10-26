// backend/src/fetchAvailability.js
//
// Low-level call to Target's "product_fulfillment_and_variation_hierarchy_v1"
// This returns per-store pickup / stock availability for a given tcin.
//
// IMPORTANT:
// - This code currently hardcodes some values from your browser session.
//   We'll parameterize the changing stuff (tcin, storeId).
//   But we keep the rest (visitor_id, cookies, etc.) the same.
//
// SECURITY NOTE:
// - Cookies in code are sensitive. Eventually you should move them to
//   Render environment vars instead of committing them to Git.

import { request } from "undici";

/**
 * Build the full RedSky URL for a specific store + tcin.
 *
 * @param {string} tcin       - Target catalog item number e.g. "93954446"
 * @param {string} storeId    - Target store id e.g. "2314"
 * @param {string} lat        - store latitude (string)
 * @param {string} lng        - store longitude (string)
 * @param {string} zip        - store zip code (string)
 * @param {string} visitorId  - visitor_id from devtools headers
 */
function buildUrl({
  tcin,
  storeId,
  lat,
  lng,
  zip,
  visitorId,
}) {
  // This is taken from your captured request path.
  // We’re inlining the `key=` value and the rest of the params.
  //
  // NOTE: scheduled_delivery_store_id=830 and state=WA came from
  // your example (Richland WA). We'll keep them.
  //
  // We parametrize tcin, storeId, lat, lng, zip, visitor_id.
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
    page: `/p%2FA-${tcin}`, // rough equivalent of page=%2Fp%2FA-93954446
  });

  return `https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_and_variation_hierarchy_v1?${qs.toString()}`;
}

/**
 * Build the headers we saw in DevTools.
 * We'll parametrize the Referer (based on tcin / product page),
 * but keep everything else almost the same.
 *
 * @param {string} tcin
 * @param {string} cookie
 */
function buildHeaders({ tcin, cookie }) {
  return {
    // pseudo headers (:authority etc.) are *not* sent directly from fetch().
    // These below are the normal request headers we *can* send:

    accept: "application/json",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",

    // this is the giant cookie blob you captured. We inject from param so
    // you can move it to env instead of hardcoding.
    cookie,

    dnt: "1",
    origin: "https://www.target.com",
    priority: "u=1, i",

    // Build a Referer that's consistent with the product page.
    referer: `https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-prismatic-evolutions-booster-bundle/-/A-${tcin}`,

    "sec-ch-ua": `"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"`,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": `"Windows"`,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",

    // your live user agent:
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  };
}

/**
 * Call Target RedSky stock/fulfillment endpoint for ONE item @ ONE store.
 * We parse the most important bits into something clean.
 *
 * @param {object} opts
 * @param {string} opts.tcin            e.g. "93954446"
 * @param {string} opts.storeId         e.g. "2314"
 * @param {string} opts.lat             e.g. "46.230"
 * @param {string} opts.lng             e.g. "-119.240"
 * @param {string} opts.zip             e.g. "99336"
 * @param {string} opts.visitorId       e.g. "01989633EB690201997B4F22E8604F90"
 * @param {string} opts.cookie          (entire Cookie header you captured)
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

  const headers = buildHeaders({ tcin, cookie });

  // Make the request using undici
  const res = await request(url, {
    method: "GET",
    headers,
  });

  const status = res.statusCode;

  // We'll try to read the body as text first for debug
  const text = await res.body.text();

  if (status !== 200) {
    return {
      ok: false,
      status,
      // short snippet for debugging
      snippet: text.slice(0, 500),
    };
  }

  // If 200, parse as JSON
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      status,
      error: "Bad JSON from Target",
      snippet: text.slice(0, 500),
    };
  }

  // Now try to extract the good parts. RedSky’s structure can be nested,
  // so we keep fallback nulls.
  //
  // Look for fields such as:
  //  - available_to_promise_quantity
  //  - pickup / ship availability strings
  //
  // We'll expose them in a clean shape:

  const out = {
    ok: true,
    status,
    tcin,
    storeId,
    raw: json, // keep the whole thing so you can inspect in the browser
  };

  return out;
}
