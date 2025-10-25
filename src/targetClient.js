// backend/src/targetClient.js
// Talks to Target's RedSky API, pretending to be your real browser session.
// Used by /api/target/search in targetRoutes.js

import { request } from "undici";

// =============================
// 1. Captured "fingerprint"
// =============================
//
// These values all came from your real devtools session. They make
// Target think this request is coming from a legit Target tab in Chrome
// at your local store.

const FIXED_WEB_KEY = "9f36aeafbe60771e321a7cc95a78140772ab3e96"; // from ?key=...
const FIXED_VISITOR_ID = "01989633EB690201997B4F22E8604F90";       // from &visitor_id=...
const DEFAULT_STORE_ID = "2314";                                    // from &store_id=...
const ORIGIN_HOST = "www.target.com";

// Your actual UA and referer from DevTools (you provided these 👇)
const FIXED_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const FIXED_REFERER =
  "https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-prismatic-evolutions-booster-bundle/-/A-93954446";

// RedSky base for PLP (search) queries
const REDSKY_BASE = "https://redsky.target.com/redsky_aggregations/v1/web";

//
// ====================================================================
// 2. Build querystring the same way Target does for search suggestions
//    (plp_search_v2). This is what powers "search results" pages.
// ====================================================================
//
// q         => your keyword, e.g. "pokemon"
// storeId   => local store ID (e.g. 2314)
// webKey    => ?key=... from the request
// visitorId => &visitor_id=... from the request
//
function buildSearchPath({ q, storeId, webKey, visitorId }) {
  const params = new URLSearchParams({
    // how many listings to return per page
    count: "24",

    // filter options used by Target web search
    default_purchasability_filter: "true",
    include_sponsored: "false",

    // the actual user-entered search term
    keyword: q,

    // standard paging shape
    page: "1",

    // "desktop" is how their site identifies full Chrome
    platform: "desktop",

    // your store / same store for delivery
    pricing_store_id: storeId,
    scheduled_delivery_store_id: storeId,

    // absolutely critical for Target to trust this request
    visitor_id: visitorId,

    // it always sets channel=WEB for browser flows
    channel: "WEB",

    // internal RedSky web key (unlocks access)
    key: webKey,
  });

  // final path is /plp_search_v2?...params...
  return `/plp_search_v2?${params.toString()}`;
}

// ======================================
// 3. Browser-like headers for RedSky API
// ======================================
//
// These headers replicate Chrome talking to Target.com.
// Origin + Referer especially matter.
//
function buildHeaders() {
  return {
    accept: "application/json",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    pragma: "no-cache",

    // True browser UA you sent me
    "user-agent": FIXED_USER_AGENT,

    // Pretend this request came from a normal tab on target.com
    origin: `https://${ORIGIN_HOST}`,
    referer: FIXED_REFERER,

    // These sec- headers help mimic Chrome network behavior
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "sec-ch-ua-platform": '"Windows"',
  };
}

// ==================================================
// 4. Call RedSky, normalize response -> nice JSON API
// ==================================================
//
// Returns either:
//   { ok: true, query, count, products: [ ... ] }
// or
//   { ok: false, status, error, snippet }
//
// Each product contains { tcin, title, price, available_to_promise_quantity }
// which you can poll + alert on.
//
export async function searchTarget({
  q,
  storeId = DEFAULT_STORE_ID,
  webKey = FIXED_WEB_KEY,
  visitorId = FIXED_VISITOR_ID,
}) {
  // ---- Build query path Target expects
  const pathWithQuery = buildSearchPath({
    q,
    storeId,
    webKey,
    visitorId,
  });

  // ---- Full URL to hit
  const url = `${REDSKY_BASE}${pathWithQuery}`;

  // ---- Browser-style headers
  const headers = buildHeaders();

  // ---- Make the request using undici (Node 16+ HTTP client)
  const res = await request(url, {
    method: "GET",
    headers,
  });

  // If RedSky said "nope", surface debug info so we can iterate
  if (res.statusCode !== 200) {
    const text = await res.body.text();
    const snippet = text.slice(0, 500);
    return {
      ok: false,
      status: res.statusCode,
      error: `RedSky returned ${res.statusCode}`,
      snippet,
    };
  }

  // Parse body if 200 OK
  const json = await res.body.json();

  // RedSky nests results under data.children[x].item
  const children = json?.data?.children ?? [];
  const rawItems = children
    .map((child) => child.item)
    .filter(Boolean);

  // Extract the bits you care about
  const products = rawItems.map((it) => ({
    // Target's internal product ID
    tcin: it?.tcin,

    // Product display title
    title: it?.product_description?.title,

    // Price (current_retail is numeric, formatted_current_price is string)
    price:
      it?.price?.current_retail ??
      it?.price?.formatted_current_price ??
      null,

    // Approx inventory: available_to_promise_quantity appears in shipping/pickup
    available_to_promise_quantity:
      it?.fulfillment?.shipping_options?.[0]?.available_to_promise_quantity ??
      it?.fulfillment?.pickup_options?.[0]?.available_to_promise_quantity ??
      null,
  }));

  return {
    ok: true,
    query: q,
    count: products.length,
    products,
  };
}
