// backend/src/targetClient.js
//
// Fetches real-time Target product data via the PDP endpoint.
// Uses your captured headers and cookies to look like a real browser.
//
// ✅ Make sure "undici" is installed:
//    npm install undici
//
// ✅ Keep COOKIE, WEB_KEY, VISITOR_ID, USER_AGENT up to date if Target changes them.

import { request } from "undici";

// ─────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────

// Store ID for your local store (Richland)
const STORE_ID = process.env.TARGET_STORE_ID || "2314";

// Visitor ID (from DevTools)
const VISITOR_ID = process.env.TARGET_VISITOR_ID || "01989633EB690201997B4F22E8604F90";

// API key (from DevTools “key=” param)
const WEB_KEY = process.env.TARGET_WEB_KEY || "9f36aeafbe60771e321a7cc95a78140772ab3e96";

// Your desktop Chrome User-Agent
const USER_AGENT = process.env.TARGET_UA ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

// Base referer (Target product page)
const REFERER_BASE =
  "https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-prismatic-evolutions-booster-bundle/-/A-";

// Full cookie string (one line, no breaks)
const COOKIE =
  process.env.TARGET_COOKIE ||
  "sapphire=1; visitorId=01989633EB690201997B4F22E8604F90; TealeafAkaSid=xe4YCxKzH4iAnRGBRSc11tptJxc1mgUp; UserLocation=99336|46.230|-119.240|WA|US; _pxvid=60561093-763d-11f0-be94-60c91b080304; crl8.fpuid=55cdaada-8a4a-4be7-ad94-c465f2659ce6; 3C77P39N=ASZUQ9YCAQAA367DDAA6cAIrPMB_7JbVGr_gMWDjG36JKw8j1OAr7BmGAHGAWAP1T-ucr0wSHAEAB83AAA07I6aFl2a6f19X77he2b60b4Ba0e90a5; brwsr=723ad9892-8227-11f0-bdbe-cd4daa1d5997; _gcl_gs=2.1.1k517599561341uS139466166; ci.reft=gt_advoc_consent_b83379fe7ac450f7; _gcl_au=1.1.1435774098.1754866770.923913432.17559960116.17599601166; fiatsCookie=DSI_2314|DSN_Richland|DSZ_99352; BVBRANDID=aC7b9beb-b2a4-45e6-b7d-5bd4385a62e4; _gcl_aw=GCL.1760654196.CjwKAjgwr4bHhEkeiwAy4u7dUnqVGKTAZMWR9n-MIS7_d1x0uvxNs1NwburLWZTNlUVcqbK0fVXaxxCQQkOAvD_BwE; _gcl_dc=GCL.1760654196.CjwKAjgwr4bHhEkeiwAy4u7dUnqVGKTAZMWR9n-MIS7_d1x0uvxNs1NwburLWZTNlUVcqbK0fVXaxxCQQkOAvD_BwE; ci_ppximp=imprad; ci_cpng=cPTID3; ci_clkid=702cca72Nadhd1fl108f179890c3496a889; ci_inm=1945656; pxcts=0c0b1623-afc6-11f0-af42-0ca452c7145b; mid=8183471813; usprivacy=1NN-; stateprivacycontrols=N; hasappr=true; loyaltyid=tlty.4a1dca57996e45e49b30f82f97740493; profileCreatedDate=2018-08-27T22:02:50.055Z; sapphire_audiences=%7B%22base_membership%22%3A%22card_membership%22%3Afalse%2C%22paid_membership%22%3Afalse%7D; sddStore=DSI_830|DSN_undefined|DSZ_99336; accesstoken=eyJraWQiOiJWYiXCmIywiWJXnploiUlmNYTiFQ.eyJzdWIlOiI4M1gzNDcxODEzInwiaXJ2IiXVWzhjowkNzYxNTE3MET2LCJpYXQiOjE3NjE0NzM2MtsIYspm0aSI6RlHVRcSwMhclJz0TA0mWxZhNlgzOjMiYzhYmZNmEyYjUzZWIzMTU0NS1iW1czti5jwZoizWFZMsIlnNdlNC1diGcll1LckJWaOjOiI3bOhZjYzNjkNzSNnMiDNZTZlOTY2zMQj2NYzXuUwWNjMzhZjliZmVmNlhXe0ZcdNzJmlwiZwlkMjloiczjpcmcwIVZGt9MjAxiNbNBnWBcFpbC5jb20iL2jXNi0i2IlOjY29lIjuxdwycGwUjaCIjbjQyGklOiI9ZjMlc0JmWmosLlmiR2M5IjE0MjM2DcwNzg1IlwiYzk5IjoiTC9.sOBR0vUTelY0xuZopPMy0W0IxhvcKGBGX3iRd-4ggdrygWDuGMiwdS8mN0HcxSNkMpl0_ccBKXlJOqBlKjfaYghfofckHgKVPMRwP9T833GsvJq5a3B6oQQnRnMkFJBI5J1lUJ40xzoj06m7s.h1oyx10.QLXH0BV9PMVHGmqCJGIY4Zkf7GrSNhf_ZgW8Dbxvn4Bn39rNS8WUzzzIsVh_DZblDkXO1_x6W84JcMpiP1VZqVcGqe2I3I5XNslyEw/t2ztt1d6szIubgHhNL6E16AsTRWVN9_9LgnJpl0n0YDRNcldvi-OLgUBRerklnKvbRk6A4NNvw9B57Gsg; refreshToken=IGT.dbz790308e368462a6bfa6623b258e61541-1; idToken=eyJhbGciOiJSUzI1NiIsImtpZCI6Y2I4OWlI4MGztNOxEZnlzWki2NqzDXEZllwiaXJ2IiXVWzhjxXWoykNzYxNTE3MET2LCJpYXQiOjE3NjE0NzM2MtsImFyc2licGxlIiwic0lsWDIcLZJdXOCI9YzNjIwIivP2l0ZW5VY3I0WbST3I2WtlMtIytJqon=eyJhciG0Ijn0U2sIlflnoYc8y77Di7eDIDjFIoG3reJhVIOlswe0ScldH7JlxZswic3OjQIl0XQSsInNluIuojilMvNXcJNIcjOFQ..wAjcLlCWcm8iOinsiZm40IiJTdGvwGluvimZ5Il0ijJxr3RlcGhIbIlsmVFtuji2c0pmKioqQCcoqKilsNBl0JpOnKLOWQ.MniS0TFiQ5IxDQulIyczZIOvRlqoumkHtUwETUzD96gOr4=oCD1T_...";

// ─────────────────────────────────────────────
//  BUILDERS
// ─────────────────────────────────────────────
function buildPdpUrl(tcin) {
  const base = "https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1";
  const params = new URLSearchParams({
    key: WEB_KEY,
    tcin,
    is_bot: "false",
    store_id: STORE_ID,
    pricing_store_id: STORE_ID,
    has_pricing_store_id: "true",
    has_financing_options: "true",
    include_obsolete: "true",
    visitor_id: VISITOR_ID,
    skip_personalized: "true",
    skip_variation_hierarchy: "true",
    channel: "WEB",
    page: `/p%2FA-${tcin}`,
  });
  return `${base}?${params.toString()}`;
}

function buildHeaders(tcin) {
  return {
    accept: "application/json",
    "accept-language": "en-US,en;q=0.9",
    "user-agent": USER_AGENT,
    referer: `${REFERER_BASE}${tcin}`,
    cookie: COOKIE,
  };
}

// ─────────────────────────────────────────────
//  MAIN FUNCTION
// ─────────────────────────────────────────────
export async function fetchItemStatus(tcin) {
  const url = buildPdpUrl(tcin);
  const headers = buildHeaders(tcin);

  const res = await request(url, { method: "GET", headers });

  if (res.statusCode !== 200) {
    let snippet = "";
    try {
      const text = await res.body.text();
      snippet = text.slice(0, 500);
    } catch {}
    return {
      ok: false,
      status: res.statusCode,
      error: `RedSky returned ${res.statusCode}`,
      snippet,
    };
  }

  const data = await res.body.json();
  const child = data?.data?.children?.[0]?.item ?? {};

  const title =
    child?.product_description?.title ||
    child?.product_description?.downstream_description ||
    "(no title?)";

  const priceInfo =
    child?.price?.formatted_current_price ||
    child?.price?.current_retail ||
    child?.price?.formatted_current_retail ||
    null;

  const fulfillment = child?.fulfillment ?? {};

  const pickupOpt = Array.isArray(fulfillment?.pickup_options)
    ? fulfillment.pickup_options[0]
    : undefined;
  const pickupAvailable =
    (pickupOpt?.available_to_promise_quantity ?? 0) > 0 ||
    pickupOpt?.order_pickup_available === true;
  const pickupQty =
    pickupOpt?.available_to_promise_quantity ??
    pickupOpt?.pickup_available_to_promise_quantity ??
    null;

  const shipOpt = Array.isArray(fulfillment?.shipping_options)
    ? fulfillment.shipping_options[0]
    : undefined;
  const shipAvailable =
    (shipOpt?.available_to_promise_quantity ?? 0) > 0 ||
    shipOpt?.ship_to_guest === true;
  const shipQty =
    shipOpt?.available_to_promise_quantity ??
    shipOpt?.shipping_available_to_promise_quantity ??
    null;

  return {
    ok: true,
    tcin,
    title,
    price: priceInfo,
    pickup: { available: !!pickupAvailable, qty: pickupQty },
    ship: { available: !!shipAvailable, qty: shipQty },
    raw: data,
  };
}
