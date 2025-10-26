// backend/src/fetchAvailability.js
//
// Call Target RedSky "product_fulfillment_and_variation_hierarchy_v1"
// for ONE tcin at ONE store, pretend to be your browser,
// gunzip the response, parse it, and then return:
//   - a clean summary for the frontend
//   - PLUS the raw debug (optional)
//
// SECURITY NOTE:
//  - COOKIE_BLOB has your personal session cookies. You should
//    eventually move that into Render env vars instead of committing
//    it to git. For now we'll inline it so things keep working.
//
//  - storeId / lat / lng / zip are for your Richland WA store.
//    You can later generalize these to accept ?storeId=... etc.
//

import { request } from "undici";

// ------------  YOUR CONSTANTS (from DevTools)  ------------

// Full Cookie header captured from your browser:
const COOKIE_BLOB = `sapphire=1; visitorId=01989633EB690201997B4F22E8604F90; TealeafAkaSid=xe4YCxKzH4iAnRGBR5c11tptJxc1mgUp; UserLocation=99336|46.230|-119.240|WA|US; _pxvid=60561093-763d-11f0-be94-60c91b08304b; crl8.fpcuid=55cdaada-8a4a-4be7-ad94-c465f2659ce6; 3YCzT93n=A5ZQU9CYAQAA367DZDAAcJcATrPMB_7JbvGr_gMWDj6d3KwBj01AQ7BmGAHGAWAp1T-ucr_owH8AAEB3AAAAAA|1|1|5490d5e72a3cf0eca0167717be620bd48a0e90a5; brwsr=723ad992-8227-11f0-bdbe-cd4ada1d5979; _gcl_gs=2.1.k1$i1759956141$u139466166; ci_ref=tgt_adv_xasd0002; _gcl_au=1.1.1435774098.1754866770.92319432.1759960116.1759960116; fiatsCookie=DSI_2314|DSN_Richland|DSZ_99352; BVBRANDID=ac7b9beb-b2a4-45e6-b76d-5b84365a2e4a; _gcl_aw=GCL.1760654196.CjwKCAjwr8LHBhBKEiwAy47uUnqVGKTAZWMR9n-MlS7_D1x0xuvNs1NwburLWZ7iNIJCvqbK0FrXaxoCQ0kQAvD_BwE; _gcl_dc=GCL.1760654196.CjwKCAjwr8LHBhBKEiwAy47uUnqVGKTAZWMR9n-MlS7_D1x0xuvNs1NwburLWZ7iNIJCvqbK0FrXaxoCQ0kQAvD_BwE; ci_pixmgr=imprad; ci_cpng=PTID3; ci_clkid=702cca72Nadfd11f08179890c3496a898; ci_lnm=1945656; pxcts=0c0b1623-afc6-11f0-afa2-04ca52c7145b; mid=8183471813; usprivacy=1NN-; stateprivacycontrols=N; hasApp=true; loyaltyid=tly.4a1dca57996e45e49b03f29f7740f493; profileCreatedDate=2018-08-27T22:02:50.055Z; sapphire_audiences={%22base_membership%22:true%2C%22card_membership%22:false%2C%22paid_membership%22:false}; sddStore=DSI_830|DSN_undefined|DSZ_99336; accessToken=eyJraWQiOiJlYXMyIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiI4MTgzNDcxODEzIiwiaXNzIjoiTUk2IiwiZXhwIjoxNzYxNTE3MTE2LCJpYXQiOjE3NjE0MzA3MTYsImp0aSI6IlRHVC5kMmI3OTAwMzhlNjg0MjZhYmY2NmEyYjUzZWI2MTU0MS1sIiwic2t5IjoiZWFzMiIsInN1dCI6IlIiLCJkaWQiOiI3ODhjZjVjNzk5NmRiNDJlZDJjNTQ4NjJmZjEzOTE0Y2Q2MGJlN2YxYzUwNWJjMzhjZjIzMmVhNzE0Yzc0NzJmIiwiZWlkIjoic2pmcmVlZG9tMjAxNkBnbWFpbC5jb20iLCJzY28iOiJlY29tLmxvdyxvcGVuaWQiLCJjbGkiOiJlY29tLXdlYi0xLjAuMCIsInR2MSI6IjM2NDcwNzg1IiwiYXNsIjoiTCJ9.sOJB3ROtvrTlLYzrQXuu2ppMYJ0whkXGGBK3iRd-4gqdvrgWDuGiMM36NuqSXCmkNpIo_ccBcXkJOqBIKjGfa1yh6FokHcjCvWPmRWP9t38GsvJg5a3B6oQQnRmkFFJB151JlJj40xzj006m7S_h1xxy1o_XlQLH89VPMHGHmqCJG1Y4zfk7GrSNhf_ZgW8Dbvxn4Bn39rsNSW8uzIxHS_VzDhIbXQ1_V6W8J4djCeM6xPWfzLvG9qe2135XIylcnsElw7atzt1d6slzLugHh2HLcE16AsTNRvM9_9LGJnplPy0lnDRNLdvi-OLgUBRerlnKbvhR64AANnW9B57Gsg; refreshToken=TGT.d2b790038e68426abf66a2b53eb61541-l; idToken=eyJhbGciOiJub25lIn0.eyJzdWIiOiI4MTgzNDcxODEzIiwiaXNzIjoiTUk2IiwiZXhwIjoxNzYxNTE3MTE2LCJpYXQiOjE3NjE0MzA3MTYsImFzcyI6IkwiLCJzdXQiOiJSIiwiY2xpIjoiZWNvbS13ZWItMS4wLjAiLCJwcm8iOnsiZm4iOiJTdGVwaGVuIiwiZm51IjoiU3RlcGhlbiIsImVtIjoic2pmKioqQCoqKiIsInBoIjp0cnVlLCJsZWQiOm51bGwsImx0eSI6dHJ1ZSwic3QiOiJXQSIsInNuIjoiMjMxNCJ9fQ.; adScriptData=WA; __gads=ID=5bea12f19943cf37:T=1759956045:RT=1761432042:S=ALNI_MbXRh1BjwRUUF3NKdJ9JsVGl5W-SA; __eoi=ID=47ce9b9afa47b825:T=1759956045:RT=1761432042:S=AA-Afja6J_Gtksq3cxBctB_ASUC4; granify.uuid=6e424aec-f82b-4d26-a86e-5ef0bdc5a938; granify.new_user.cq1cu=false; ffsession={%22sessionHash%22:%22e8adef0a85ce21761192558580%22%2C%22prevPageName%22:%22toys:%20product%20detail%22%2C%22prevPageType%22:%22product%20details%22%2C%22prevPageUrl%22:%22https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-prismatic-evolutions-booster-bundle/-/A-93954446#lnk=sametab%22%2C%22sessionHit%22:47%2C%22prevSearchTerm%22:%22%20pokemon%20cards%22}; granify.session.cq1cu=1761440798227; _tgt_session=bfa67e82c48248b98e844bc625f30426.df7b8c7bdcfaa9f66573cb9b99baf572b0470f0c97c937c26eabb67d77308226aef8c2ce4983ea9d2d314e45978e779d71b59201f39e35a430738471ae21d6f9461289926f986206c0fbceab80ae623a67c4481ae0876f9d5860dad1a271dc715da0de02107a6df9dc44bbad815a3d8759aff7a8bba4dedc51796fb3a06a18705a2d66be325e63d3db1ab661d92bb643c7495a6c3229bbda80b42941c2b82aa34490575175d3227e13b8940b84c9ce48d5f820da62b5e558653c8e40847b6a2502b699be0f2aa8c3703402101df6b1472a5a600f1b4a8753194b651b45f111eac1.0x26dda2eb6f41b026093ee02eb3e1f5b60d50eb05dc95af093000e022ce4fb7c2; fs_lua=1.1761441686994; fs_uid=#o-221JN4-na1#0e1fcd7e-4002-4e0e-aa84-65090ec07761:d020ccd5-ad81-47cb-a31a-62fd4f743a0f:1761440794525::2#aa740b27#/1791492192; _px3=65e923aceb6cecd791b3adf4611f541325668123960a0ee1342f4cdbda2d2fc7:VDmSILskYcDU1kpQbkB3xrCFVV0/txeCabmBCc39XJU2WQggYm+bDD6MyCOJfYQD0Pv8itWsUz5QndG+hMpMhA==:1000:Sr3iTxisBQfy2JadoZU7JajYR2NGE96BVwEV5iYjPQoD/icx6+ZRJT4OOV0FlLVexTVjXtQIZAYcUx7N5MBrdDaihSDLFUPqcprl788EDmZC5UnkoGrWL++fduE92+80QqskHPYXhtxGP5eme6nzO2XmTB7F/6OD1j6+HQwvcvGoR+tHgcZOdy3Sb7wJWJBNeTOTxpoP97xItYZ9+dvwllJGxkuhZuEOKpH0zER198s=`;

// Hard-coded "visitor_id" that Target expects (from your headers)
const VISITOR_ID = "01989633EB690201997B4F22E8604F90";

// Your local Target store details (Richland WA)
const STORE_ID = "2314";
const LAT      = "46.230";
const LNG      = "-119.240";
const ZIP      = "99336";

// This stays constant in the query string
const KEY = "9f36aeafbe60771e321a7cc95a78140772ab3e96";
const SCHEDULED_DELIVERY_STORE = "830";
const STATE = "WA";


// ------------ buildUrl: construct the RedSky URL ------------
function buildUrl({ tcin }) {
  const qs = new URLSearchParams({
    key: KEY,

    required_store_id: STORE_ID,
    latitude: LAT,
    longitude: LNG,
    scheduled_delivery_store_id: SCHEDULED_DELIVERY_STORE,
    state: STATE,
    zip: ZIP,

    store_id: STORE_ID,
    paid_membership: "false",
    base_membership: "true",
    card_membership: "false",
    is_bot: "false",

    tcin,
    visitor_id: VISITOR_ID,
    channel: "WEB",

    // This param mirrors what Target sends for "page=/p%2F..."
    // We can spoof one that matches this product.
    page: `/p%2FA-${tcin}`,
  });

  return `https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_and_variation_hierarchy_v1?${qs.toString()}`;
}


// ------------ buildHeaders: spoof browser headers ------------
function buildHeaders(tcin) {
  return {
    accept: "application/json",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",

    // Your exact cookie jar
    cookie: COOKIE_BLOB,

    dnt: "1",
    origin: "https://www.target.com",
    priority: "u=1, i",

    referer: `https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-prismatic-evolutions-booster-bundle/-/A-${tcin}`,

    "sec-ch-ua": `"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"`,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": `"Windows"`,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",

    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  };
}


// ------------ fetchAvailability: main exported function ------------
export async function fetchAvailability({ tcin }) {
  // 1. Build URL + headers
  const url = buildUrl({ tcin });
  const headers = buildHeaders(tcin);

  // 2. Make request with undici
  const res = await request(url, {
    method: "GET",
    headers,
  });

  const status = res.statusCode;

  // 3. Decode body using undici's .body.decompress()
  //    which handles gzip/deflate/br for us.
  let text;
  try {
    const buf = await res.body.arrayBuffer();
    // undici already gave us decompressed bytes if possible
    text = new TextDecoder("utf-8").decode(buf);
  } catch (err) {
    return {
      ok: false,
      status,
      error: "Failed to read/decode body",
      debug: { err: String(err) },
    };
  }

  // 4. Parse JSON
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

  // 5. Extract clean fields we care about
  // Target nests availability under:
  // json.data.product.fulfillment
  //    .store_options[0]
  // We're going to be cautious and default to nulls.
  const productData = json?.data?.product || {};
  const fulfillment = productData?.fulfillment || {};
  const storeOptions = Array.isArray(fulfillment.store_options)
    ? fulfillment.store_options
    : [];

  const firstStore = storeOptions[0] || {};

  const storeId   = firstStore.location_id || STORE_ID;
  const statusText =
    firstStore.availability_status ||
    fulfillment.availability_status ||
    "UNKNOWN";

  // available_to_promise_quantity might be number
  const qty =
    firstStore.location_available_to_promise_quantity ??
    firstStore.available_to_promise_quantity ??
    0;

  // pickup / ship_to_store style strings
  const pickupStatus   = firstStore.order_pickup?.availability_status
    ?? firstStore.availability_status
    ?? "UNKNOWN";

  const shipToStoreStatus = firstStore.ship_to_store?.availability_status
    ?? "UNKNOWN";

  // location details (name, address, zip)
  const locInfo = firstStore.location_name
    ? firstStore
    : fulfillment;

  const storeName = locInfo.location_name || "Unknown store";
  const zip = locInfo?.mailing_address?.postal_code || ZIP;

  // Timestamp (from Target "Date" header) isn't exposed in body, so grab now
  const updated = new Date().toISOString();

  // 6. Build friendly response
  const clean = {
    ok: true,
    status,
    tcin,
    storeId,
    storeName,
    zip,
    status: statusText,
    qty: typeof qty === "number" ? qty : Number(qty) || 0,
    pickup: pickupStatus,
    shipToStore: shipToStoreStatus,
    updated,
    // still include some debug crumbs, in case we need to inspect:
    debug: {
      // WARNING: we include only safe debug.
      // Do NOT echo cookie back — never send COOKIE_BLOB here.
      // If you want super-debug, keep it server-side logs only.
      contentEncoding: res.headers?.["content-encoding"] || null,
      decodedOK: true,
    },
    raw: json, // <-- optional: you can remove this once you're confident
  };

  return clean;
}
