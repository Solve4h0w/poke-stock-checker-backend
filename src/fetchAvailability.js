// backend/src/fetchAvailability.js
//
// Low-level call to Target's
//   product_fulfillment_and_variation_hierarchy_v1
// This is our "check store stock for 1 item" call.
//
// IMPORTANT SECURITY NOTE:
// - We're passing your live cookie header into buildHeaders()
//   so our request looks like your browser.
// - Eventually you should move that cookie into an env var instead of
//   committing it to GitHub, because it's sensitive.

import { request } from "undici";
import zlib from "zlib";

// ---------- helpers ----------

/**
 * Build the full RedSky URL for a specific store + tcin.
 *
 * @param {object} opts
 * @param {string} opts.tcin     e.g. "93954446"
 * @param {string} opts.storeId  e.g. "2314"
 * @param {string} opts.lat      e.g. "46.230"
 * @param {string} opts.lng      e.g. "-119.240"
 * @param {string} opts.zip      e.g. "99336"
 * @param {string} opts.visitorId
 *        e.g. "01989633EB690201997B4F22E8604F90"
 */
function buildUrl({
  tcin,
  storeId,
  lat,
  lng,
  zip,
  visitorId,
}) {
  // NOTE:
  // - `key=` is Target's public-ish RedSky key your browser used.
  // - scheduled_delivery_store_id, state, etc. are from your captured request.
  // - page=%2Fp%2FA-${tcin} makes it look like we came from that PDP.

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

  // Example:
  // https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_and_variation_hierarchy_v1?...params...
  return `https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_and_variation_hierarchy_v1?${qs.toString()}`;
}

/**
 * Build the headers so the request looks like Chrome hitting Target's site.
 * We pass your cookie through here so it matches your session.
 *
 * @param {object} opts
 * @param {string} opts.tcin
 * @param {string} opts.cookie  (your full Cookie header string)
 */
function buildHeaders({ tcin, cookie }) {
  return {
    // normal request headers we can send from Node:
    accept: "application/json",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",

    // 👇 this is your real cookie blob you captured from DevTools
    //    We inject it so Target thinks we're your live browser session.
    cookie,

    dnt: "1",
    origin: "https://www.target.com",
    priority: "u=1, i",

    // Referer that matches the PDP (product detail page)
    referer: `https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-prismatic-evolutions-booster-bundle/-/A-${tcin}`,

    // user agent from your browser
    "user-agent":
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',

    // sec-ch hints from Chrome (not always required, but helps look real)
    "sec-ch-ua": '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
  };
}

/**
 * decodeBody(buf, encoding)
 *
 * Target often sends compressed responses with content-encoding: br or gzip.
 * This tries to decompress them and return a UTF-8 string.
 * If we don't know the encoding, we just treat the bytes as UTF-8.
 */
function decodeBody(buf, encoding) {
  const enc = (encoding || "").toLowerCase();

  if (enc.includes("br")) {
    // Brotli
    const out = zlib.brotliDecompressSync(buf);
    return out.toString("utf8");
  }

  if (enc.includes("gzip")) {
    // Gzip
    const out = zlib.gunzipSync(buf);
    return out.toString("utf8");
  }

  if (enc.includes("deflate")) {
    // Deflate
    const out = zlib.inflateSync(buf);
    return out.toString("utf8");
  }

  // fallback: assume it's already plain text
  return buf.toString("utf8");
}

// ---------- main exported function ----------

/**
 * Call Target RedSky stock/fulfillment endpoint for ONE item @ ONE store.
 *
 * We added extra debug so we can see exactly what Target is sending us.
 *
 * @param {object} opts
 * @param {string} opts.tcin        "93954446"
 * @param {string} opts.storeId     "2314"
 * @param {string} opts.lat         "46.230"
 * @param {string} opts.lng         "-119.240"
 * @param {string} opts.zip         "99336"
 * @param {string} opts.visitorId   e.g. the long visitor_id
 * @param {string} opts.cookie      FULL cookie header from DevTools
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
  //
  // 1. Build request URL
  //
  const url = buildUrl({
    tcin,
    storeId,
    lat,
    lng,
    zip,
    visitorId,
  });

  //
  // 2. Build headers
  //
  const headers = buildHeaders({ tcin, cookie });

  //
  // 3. Make request with undici
  //
  const res = await request(url, {
    method: "GET",
    headers,
  });

  const status = res.statusCode;

  //
  // 4. Read raw response bytes
  //
  const arrayBuf = await res.body.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  //
  // 5. Figure out how Target says it's encoded (br/gzip/etc.)
  //
  const contentEncoding =
    res.headers["content-encoding"] ||
    res.headers["Content-Encoding"] ||
    "";

  //
  // 6. Try to decode/decompress to text
  //
  let text = "";
  let decodedOk = true;
  try {
    text = decodeBody(buf, contentEncoding);
  } catch (e) {
    decodedOk = false;
    text = ""; // leave empty, but we'll still debug-return
  }

  //
  // 7. If NOT 200, just bubble back debug info
  //
  if (status !== 200) {
    return {
      ok: false,
      status,
      note: "non-200 from Target",
      contentEncoding,
      decodedOk,
      // first ~300 bytes of the raw body, base64, so we can inspect
      rawBase64: buf.slice(0, 300).toString("base64"),
      // first 500 chars of whatever text we *could* decode
      snippet: text.slice(0, 500),
      // extra debug
      urlUsed: url,
      sentHeaders: headers,
    };
  }

  //
  // 8. Status was 200. Try to JSON.parse() the decoded text.
  //
  try {
    const json = JSON.parse(text);

    // If parse worked, AMAZING. We return something clean + raw for inspection.
    return {
      ok: true,
      status,
      tcin,
      storeId,

      // full decoded JSON from Target:
      raw: json,

      // small debug block:
      debug: {
        contentEncoding,
        decodedOk,
      },
    };
  } catch (err) {
    //
    // 9. JSON.parse failed => text wasn't valid JSON even after decode.
    //    That means Target might be sending us binary / protobuf / gated data.
    //
    return {
      ok: false,
      status,
      error: "Body was not valid JSON after decode",
      contentEncoding,
      decodedOk,

      // first ~500 chars of the *decoded* text we tried to parse:
      snippetText: text.slice(0, 500),

      // first ~400 raw bytes in base64 (this is the REAL response bytes)
      rawBase64: buf.slice(0, 400).toString("base64"),

      // send request context so we can compare later
      urlUsed: url,
      sentHeaders: headers,
    };
  }
}
