// backend/src/targetClient.js
import { request } from 'undici';

// This matches Target's internal "RedSky" product search API
const BASE = 'https://redsky.target.com/redsky_aggregations/v1/web';
const SEARCH_PATH = '/plp_search_v2';

/**
 * Pull in values from environment so Render can inject live ones.
 *
 * STORE_ID: the store Target uses for availability (you set this to 2314 in Render)
 * WEB_KEY: the "key" param on the real Target request
 * VISITOR_ID: the "visitor_id" param on the real Target request
 */
const STORE_ID     = process.env.TARGET_STORE_ID || '2314';
const WEB_KEY      = process.env.TARGET_WEB_KEY  || '';
const VISITOR_ID   = process.env.TARGET_VISITOR_ID || '';

if (!WEB_KEY) {
  console.warn('[targetClient] WARNING: missing TARGET_WEB_KEY');
}
if (!VISITOR_ID) {
  console.warn('[targetClient] WARNING: missing TARGET_VISITOR_ID');
}

/**
 * Build the RedSky querystring exactly like the browser request.
 * We are intentionally NOT randomizing visitor_id anymore.
 */
function buildQuery({ q, storeId, webKey, visitorId }) {
  const params = new URLSearchParams({
    count: '24',
    default_purchasability_filter: 'true',
    include_sponsored: 'false',
    include_review_summarization: 'true',
    keyword: q,
    new_search: 'true',
    offset: '0',
    page: '1',
    platform: 'desktop',
    pricing_store_id: storeId,
    scheduled_delivery_store_id: storeId,
    store_id: storeId,
    // 👇 CRITICAL: send the visitor_id we captured from DevTools/Target
    visitor_id: visitorId,
    channel: 'WEB',

    // the key param Target expects
    key: webKey,
  });

  return `${SEARCH_PATH}?${params.toString()}`;
}

/**
 * Browser-like headers. These need to look like a real Chrome page load.
 * We'll keep them very close to what Target sent you.
 */
function buildHeaders(originHost) {
  const origin = `https://${originHost}`;
  const referer = `${origin}/s?searchTerm=pokemon`;

  return {
    // "normal" browser headers
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-site',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',

    // absolutely critical: these 2 make Target think we are on target.com
    origin,
    referer,

    // UA bits
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
}

/**
 * Perform a search against RedSky.
 * Returns { ok, products } or { ok:false, ...debug }
 *
 * q           - search string ("151", "pokemon", etc.)
 * storeId     - store/location ID (e.g. 2314)
 * webKey      - ?key=... param you stole from DevTools
 * visitorId   - visitor_id param you stole from DevTools
 * originHost  - pretend we're coming from this host, usually "www.target.com"
 */
export async function searchTarget({
  q,
  storeId = STORE_ID,
  webKey = WEB_KEY,
  visitorId = VISITOR_ID,
  originHost = 'www.target.com',
}) {
  // build URL and headers
  const pathWithQs = buildQuery({ q, storeId, webKey, visitorId });
  const url = `${BASE}${pathWithQs}`;
  const headers = buildHeaders(originHost);

  // Do the request
  const res = await request(url, {
    method: 'GET',
    headers,
  });

  // If it's not 200, surface debug so we can see what Target said
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

  // Parse and normalize
  const json = await res.body.json();

  // RedSky nests results in data.children[x].item
  const children = json?.data?.children ?? [];
  const out = children
    .map(c => c?.item)
    .filter(Boolean)
    .map(it => ({
      tcin: it?.tcin,
      title: it?.product_description?.title,
      price: it?.price?.current_retail ?? it?.price?.formatted_current_price,
      available_to_promise_quantity:
        it?.fulfillment?.shipping_options?.[0]?.available_to_promise_quantity ??
        it?.fulfillment?.pickup_options?.[0]?.available_to_promise_quantity ??
        null,
    }));

  return {
    ok: true,
    query: q,
    count: out.length,
    products: out,
  };
}
