// backend/src/data/fetchAvailability.js

import { request } from "undici";

/**
 * Build the full RedSky URL for `product_fulfillment_and_variation_hierarchy_v1`
 * for a specific store + tcin.
 *
 * All the changing bits (tcin, storeId, lat, lng, zip, visitorId) come from args.
 * Everything else stays the same as we captured from DevTools.
 */
function buildUrl({
  tcin,
  storeId,
  lat,
  lng,
  zip,
  visitorId,
}) {
  // This is the RedSky endpoint Target uses on PDP for availability.
  // We recreate the querystring structure we saw in your capture.
  //
  // NOTE: The "key" param (9f36aeafbe60771e321a7cc957a... etc) is required.
  // We keep it constant; it's fine to reuse.
  //
  // The store / lat / lng / zip / visitorId are dynamic now.
  //
  const KEY = "9f36aeafbe60771e321a7cc957a78140772ab396";

  const qs = new URLSearchParams({
    key: KEY,
    required_store_id: storeId,
    latitude: lat,
    longitude: lng,
    scheduled_delivery_store_id: "830", // keep same as captured
    state: "WA",                        // captured from your session
    zip: zip,
    store_id: storeId,
    paid_membership: "false",
    base_membership: "true",
    card_membership: "false",
    is_bot: "false",
    tcin,
    visitor_id: visitorId,
    channel: "WEB",
    // page param matches PDP browser route. We just mimic that shape.
    page: `/p/2FA-${tcin}`,
  });

  return `https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_and_variation_hierarchy_v1?${qs.toString()}`;
}

/**
 * Build the request headers we saw in DevTools.
 * We pass:
 *  - the giant Cookie blob
 *  - the Referer that matches the PDP URL
 *  - your user agent + sec-ch-ua hints
 *
 * We paramaterize `tcin` so Referer updates per item,
 * and `cookie` so we keep your live browser cookie in one place.
 */
function buildHeaders({ tcin, cookie }) {
  return {
    // normal request headers we *can* send via fetch/undici
    accept: "application/json",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",

    // IMPORTANT: Your full browser cookie blob
    cookie,

    dnt: "1",
    origin: "https://www.target.com",
    priority: "u=1, i",

    // Match Referer to the PDP URL for this item
    referer: `https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-prismatic-evolutions-booster-bundle/-/A-${tcin}`,

    // Browser-ish client hints you captured
    "sec-ch-ua": `"Google Chrome";v="141", "NotA;Brand";v="8", "Chromium";v="141"`,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",

    // Your real UA from DevTools
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  };
}

/**
 * Call Target RedSky stock/fulfillment endpoint for ONE item @ ONE store.
 * We parse the most important bits into something stable.
 *
 * @param {object} opts
 * @param {string} opts.tcin
 * @param {string} opts.storeId
 * @param {string} opts.lat
 * @param {string} opts.lng
 * @param {string} opts.zip
 * @param {string} opts.visitorId
 * @param {string} opts.cookie   (entire Cookie header you captured)
 *
 * @return {object} shaped like:
 * {
 *   ok: true/false,
 *   status: number,
 *   tcin: string,
 *   storeId: string,
 *   qty: number,
 *   isAvailable: boolean,
 *   inStoreStatus: string,
 *   storeName: string,
 *   updated: string,
 *   raw: {...},   // the full RedSky JSON
 *   debug: {...}  // misc debug (e.g. contentEncoding, decodedOK)
 * }
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
  // build URL
  const url = buildUrl({
    tcin,
    storeId,
    lat,
    lng,
    zip,
    visitorId,
  });

  // build headers
  const headers = buildHeaders({ tcin, cookie });

  // make the HTTP request using undici
  const res = await request(url, {
    method: "GET",
    headers,
  });

  const status = res.statusCode;

  // Read body as text first so we can debug non-200 / invalid JSON scenarios.
  const text = await res.body.text();

  if (status !== 200) {
    // when Target says "Not Found", they send JSON like:
    // { "errors": [{ "message":"No product found with tcin 12345" }], "data": {}}
    return {
      ok: false,
      status,
      error: "Non-200 from Target",
      snippet: text.slice(0, 500),
      debug: {
        contentEncoding: res.headers["content-encoding"] || "",
        decodedOK: true,
      },
    };
  }

  // parse JSON
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      status,
      error: "Bad JSON from Target",
      snippet: text.slice(0, 500),
      debug: {
        contentEncoding: res.headers["content-encoding"] || "",
        decodedOK: false,
      },
    };
  }

  // Now we try to extract the useful fields.
  // RedSky nesting tends to look like:
  //
  // {
  //   data: {
  //     product: {
  //       __typename: 'Product',
  //       notify_me_enabled: false,
  //       pay_per_order_charges: {...},
  //       fulfillment: {
  //         product_id: '93954446',
  //         is_out_of_stock_in_all_store_locations: false,
  //         ...
  //       },
  //       store_options: [
  //         {
  //           location_id: '2314',
  //           store: { location_name: 'Richland', mailing_address:{...} },
  //           pickup: {...},
  //           ship_to_store: {...},
  //           in_store_only: {...},
  //           availability_status: 'OUT_OF_STOCK',
  //           location_available_to_promise_quantity: 0
  //         }
  //       ],
  //       shipping_options: {...},
  //       ...
  //     }
  //   }
  // }
  //
  // We’ll defensively walk this to pull out:
  // qty, storeName, inStoreStatus, updated timestamp.

  const product = json?.data?.product || {};
  const storeOptions = Array.isArray(product.store_options)
    ? product.store_options
    : [];

  // find matching storeId in store_options
  let matchStore = storeOptions.find(
    (opt) => String(opt.location_id) === String(storeId)
  );
  if (!matchStore && storeOptions.length > 0) {
    // fallback to first
    matchStore = storeOptions[0];
  }

  const storeName = matchStore?.store?.location_name || "Unknown store";

  // quantity promise at that location
  const qty =
    matchStore?.location_available_to_promise_quantity ??
    matchStore?.available_to_promise_quantity ??
    0;

  // in-store pickup style status
  const inStoreStatus =
    matchStore?.availability_status ||
    matchStore?.pickup?.availability_status ||
    matchStore?.in_store_only?.availability_status ||
    "UNKNOWN";

  // RedSky sticks timestamps in top-level store options or shipping/pickup nodes
  // so we’ll grab whichever we see first:
  const updated =
    matchStore?.updated ||
    matchStore?.pickup?.updated ||
    matchStore?.ship_to_store?.updated ||
    new Date().toISOString();

  // Determine isAvailable with a simple rule:
  // available if qty > 0 OR status does not scream OUT_OF_STOCK / UNAVAILABLE
  const isAvailable =
    qty > 0 ||
    !/OUT_OF_STOCK|UNAVAILABLE|NOT_SOLD_IN_STORE/i.test(inStoreStatus || "");

  // Shape the final object the watcher + route both consume:
  return {
    ok: true,
    status,
    tcin,
    storeId,
    qty,
    isAvailable,
    inStoreStatus,
    storeName,
    updated,

    raw: json, // keep the whole thing for inspection in browser

    debug: {
      contentEncoding: res.headers["content-encoding"] || "",
      decodedOK: true,
    },
  };
}
