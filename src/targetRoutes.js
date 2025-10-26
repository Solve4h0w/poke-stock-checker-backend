// backend/src/targetRoutes.js
//
// This router exposes 2 main endpoints:
//
// 1. /api/target/item/:tcin
//    -> returns basic item info (price, title, etc.) for a given tcin, no store context
//
// 2. /api/target/store/:storeId/item/:tcin
//    -> returns store-specific availability using your captured cookie + headers
//
// Note: We rely on helpers from fetchAvailability.js:
//   - fetchItemStatus(tcin)
//   - fetchAvailability({ tcin, storeId, lat, lng, zip, visitorId, cookie })

import { Router } from "express";
import {
  fetchItemStatus,
  fetchAvailability,
} from "./fetchAvailability.js";

const router = Router();

/**
 * Simple ping to confirm the router is mounted
 * GET /api/target/ping
 */
router.get("/ping", (req, res) => {
  res.json({ ok: true, msg: "targetRoutes alive" });
});

/**
 * GET /api/target/item/:tcin
 *
 * Example:
 *   /api/target/item/93954446
 *
 * Response example on success:
 * {
 *   ok: true,
 *   tcin: "93954446",
 *   title: "...",
 *   price: "...",
 *   pickup: { available: false, qty: null },
 *   ship:   { available: false, qty: null },
 *   raw: { ...full raw Target JSON... }
 * }
 *
 * On error:
 * {
 *   ok: false,
 *   status: <code>,
 *   error: "...",
 *   snippet: "..." // first ~500 chars of Target's error, if any
 * }
 */
router.get("/item/:tcin", async (req, res) => {
  const { tcin } = req.params || {};
  if (!tcin) {
    return res.status(400).json({
      ok: false,
      error: "Missing tcin",
    });
  }

  try {
    const result = await fetchItemStatus(tcin);

    // if Target gave us an error (e.g. 502) bubble that status
    if (!result.ok) {
      return res
        .status(result.status || 502)
        .json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error("[target/item] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown error",
    });
  }
});

/**
 * GET /api/target/store/:storeId/item/:tcin
 *
 * This is your per-store "are they in stock RIGHT NOW?" endpoint.
 *
 * Example:
 *   /api/target/store/2314/item/93954446
 *
 * Where:
 *   - storeId = "2314" (Richland)
 *   - tcin    = "93954446" (Prismatic Evolutions bundle)
 *
 * We also include:
 *   - lat/lng/zip (geo for that store area)
 *   - visitorId    (from your own request headers)
 *   - cookie       (full cookie string copied from DevTools)
 *
 * On success you'll get something like:
 * {
 *   ok: true,
 *   status: 200,
 *   tcin: "93954446",
 *   storeId: "2314",
 *   raw: { ... }
 * }
 *
 * In raw, we'll be able to inspect pickup / available_to_promise_quantity etc.
 */
router.get("/store/:storeId/item/:tcin", async (req, res) => {
  const { storeId, tcin } = req.params || {};

  if (!storeId || !tcin) {
    return res.status(400).json({
      ok: false,
      error: "Missing storeId or tcin",
    });
  }

  //
  // STATIC CONTEXT for now (Richland WA 99336)
  //
  // You pulled these from DevTools:
  //   latitude=46.230
  //   longitude=-119.240
  //   zip=99336
  //
  // We'll ship those to fetchAvailability.
  //
  const lat = "46.230";
  const lng = "-119.240";
  const zip = "99336";

  //
  // This is from the request header:
  //   visitor_id=01989633EB690201997B4F22E8604F90
  //
  const visitorId = "01989633EB690201997B4F22E8604F90";

  //
  // FULL COOKIE STRING (copied from your request headers)
  // IMPORTANT:
  //   - keep the backticks
  //   - don't edit this unless it stops working and you re-capture a fresh cookie
  //
  const cookie = `
sapphire=1; visitorId=01989633EB690201997B4F22E8604F90; TealeafAkaSid=xe4YCxKzH4iAnRGBR5c11tptJxc1mgUp; UserLocation=99336|46.230|-119.240|WA|US; _pxvid=60561093-763d-11f0-be94-60c91b08304b; crl8.fpcuid=55cdaada-8a4a-4be7-ad94-c465f2659ce6; 3YCzT93n=A5ZQU9CYAQAA367DZDAAcJcATrPMB_7JbvGr_gMWDj6d3KwBj01AQ7BmGAHGAWAp1T-ucr_owH8AAEB3AAAAAA|1|1|5490d5e72a3cf0eca0167717be620bd48a0e90a5; brwsr=723ad992-8227-11f0-bdbe-cd4ada1d5979; _gcl_gs=2.1.k1$i1759956141$u139466166; ci_ref=tgt_adv_xasd0002; _gcl_au=1.1.1435774098.1754866770.92319432.1759960116.1759960116; fiatsCookie=DSI_2314|DSN_Richland|DSZ_99352; BVBRANDID=ac7b9beb-b2a4-45e6-b76d-5b84365a2e4a; _gcl_aw=GCL.1760654196.CjwKCAjwr8LHBhBKEiwAy47uUnqVGKTAZWMR9n-MlS7_D1x0xuvNs1NwburLWZ7iNIJCvqbK0FrXaxoCQ0kQAvD_BwE; _gcl_dc=GCL.1760654196.CjwKCAjwr8LHBhBKEiwAy47uUnqVGKTAZWMR9n-MlS7_D1x0xuvNs1NwburLWZ7iNIJCvqbK0FrXaxoCQ0kQAvD_BwE; ci_pixmgr=imprad; ci_cpng=PTID3; ci_clkid=702cca72Nadfd11f08179890c3496a898; ci_lnm=1945656; pxcts=0c0b1623-afc6-11f0-afa2-04ca52c7145b; mid=8183471813; usprivacy=1NN-; stateprivacycontrols=N; hasApp=true; loyaltyid=tly.4a1dca57996e45e49b03f29f7740f493; profileCreatedDate=2018-08-27T22:02:50.055Z; sapphire_audiences={%22base_membership%22:true%2C%22card_membership%22:false%2C%22paid_membership%22:false}; sddStore=DSI_830|DSN_undefined|DSZ_99336; accessToken=eyJraWQiOiJlYXMyIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiI4MTgzNDcxODEzIiwiaXNzIjoiTUk2IiwiZXhwIjoxNzYxNTE3MTE2LCJpYXQiOjE3NjE0MzA3MTYsImp0aSI6IlRHVC5kMmI3OTAwMzhlNjg0MjZhYmY2NmEyYjUzZWI2MTU0MS1sIiwic2t5IjoiZWFzMiIsInN1dCI6IlIiLCJkaWQiOiI3ODhjZjVjNzk5NmRiNDJlZDJjNTQ4NjJmZjEzOTE0Y2Q2MGJlN2YxYzUwNWJjMzhjZjIzMmVhNzE0Yzc0NzJmIiwiZWlkIjoic2pmcmVlZG9tMjAxNkBnbWFpbC5jb20iLCJzY28iOiJlY29tLmxvdyxvcGVuaWQiLCJjbGkiOiJlY29tLXdlYi0xLjAuMCIsInR2MSI6IjM2NDcwNzg1IiwiYXNsIjoiTCJ9.sOJB3ROtvrTlLYzrQXuu2ppMYJ0whkXGGBK3iRd-4gqdvrgWDuGiMM36NuqSXCmkNpIo_ccBcXkJOqBIKjGfa1yh6FokHcjCvWPmRWP9t38GsvJg5a3B6oQQnRmkFFJB151JlJj40xzj006m7S_h1xxy1o_XlQLH89VPMHGHmqCJG1Y4zfk7GrSNhf_ZgW8Dbvxn4Bn39rsNSW8uzIxHS_VzDhIbXQ1_V6W8J4djCeM6xPWfzLvG9qe2135XIylcnsElw7atzt1d6slzLugHh2HLcE16AsTNRvM9_9LGJnplPy0lnDRNLdvi-OLgUBRerlnKbvhR64AANnW9B57Gsg; refreshToken=TGT.d2b790038e68426abf66a2b53eb61541-l; idToken=eyJhbGciOiJub25lIn0.eyJzdWIiOiI4MTgzNDcxODEzIiwiaXNzIjoiTUk2IiwiZXhwIjoxNzYxNTE3MTE2LCJpYXQiOjE3NjE0MzA3MTYsImFzcyI6IkwiLCJzdXQiOiJSIiwiY2xpIjoiZWNvbS13ZWItMS4wLjAiLCJwcm8iOnsiZm4iOiJTdGVwaGVuIiwiZm51IjoiU3RlcGhlbiIsImVtIjoic2pmKioqQCoqKiIsInBoIjp0cnVlLCJsZWQiOm51bGwsImx0eSI6dHJ1ZSwic3QiOiJXQSIsInNuIjoiMjMxNCJ9fQ.; adScriptData=WA; __gads=ID=5bea12f19943cf37:T=1759956045:RT=1761432042:S=ALNI_MbXRh1BjwRUUF3NKdJ9JsVGl5W-SA; __eoi=ID=47ce9b9afa47b825:T=1759956045:RT=1761432042:S=AA-Afja6J_Gtksq3cxBctB_ASUC4; granify.uuid=6e424aec-f82b-4d26-a86e-5ef0bdc5a938; granify.new_user.cq1cu=false; ffsession={%22sessionHash%22:%22e8adef0a85ce21761192558580%22%2C%22prevPageName%22:%22toys:%20product%20detail%22%2C%22prevPageType%22:%22product%20details%22%2C%22prevPageUrl%22:%22https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-prismatic-evolutions-booster-bundle/-/A-93954446#lnk=sametab%22%2C%22sessionHit%22:47%2C%22prevSearchTerm%22:%22%20pokemon%20cards%22}; granify.session.cq1cu=1761440798227; _tgt_session=bfa67e82c48248b98e844bc625f30426.df7b8c7bdcfaa9f66573cb9b99baf572b0470f0c97c937c26eabb67d77308226aef8c2ce4983ea9d2d314e45978e779d71b59201f39e35a430738471ae21d6f9461289926f986206c0fbceab80ae623a67c4481ae0876f9d5860dad1a271dc715da0de02107a6df9dc44bbad815a3d8759aff7a8bba4dedc51796fb3a06a18705a2d66be325e63d3db1ab661d92bb643c7495a6c3229bbda80b42941c2b82aa34490575175d3227e13b8940b84c9ce48d5f820da62b5e558653c8e40847b6a2502b699be0f2aa8c3703402101df6b1472a5a600f1b4a8753194b651b45f111eac1.0x26dda2eb6f41b026093ee02eb3e1f5b60d50eb05dc95af093000e022ce4fb7c2; fs_lua=1.1761441686994; fs_uid=#o-221JN4-na1#0e1fcd7e-4002-4e0e-aa84-65090ec07761:d020ccd5-ad81-47cb-a31a-62fd4f743a0f:1761440794525::2#aa740b27#/1791492192; _px3=65e923aceb6cecd791b3adf4611f541325668123960a0ee1342f4cdbda2d2fc7:VDmSILskYcDU1kpQbkB3xrCFVV0/txeCabmBCc39XJU2WQggYm+bDD6MyCOJfYQD0Pv8itWsUz5QndG+hMpMhA==:1000:Sr3iTxisBQfy2JadoZU7JajYR2NGE96BVwEV5iYjPQoD/icx6+ZRJT4OOV0FlLVexTVjXtQIZAYcUx7N5MBrdDaihSDLFUPqcprl788EDmZC5UnkoGrWL++fduE92+80QqskHPYXhtxGP5eme6nzO2XmTB7F/6OD1j6+HQwvcvGoR+tHgcZOdy3Sb7wJWJBNeTOTxpoP97xItYZ9+dvwllJGxkuhZuEOKpH0zER198s=
  `.trim();

  try {
    const result = await fetchAvailability({
      tcin,
      storeId,
      lat,
      lng,
      zip,
      visitorId,
      cookie,
    });

    if (!result.ok) {
      return res
        .status(result.status || 502)
        .json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error("[target/store/item] error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown error",
    });
  }
});

export default router;
