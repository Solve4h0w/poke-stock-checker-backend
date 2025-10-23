// backend/src/products.service.js
// Aggregates Pokémon product results from retailers by keyword + zip.
// Currently implements BestBuy via official API. Walmart/Target placeholders included.
//
// OUTPUT schema is normalized to:
// { name, store, status, url, price, sku, storeId, distance, pickup, online }

const fetchJson = async (url, headers = {}) => {
  const res = await fetch(url, { headers });
  const text = await res.text();

  // Fail fast if upstream is HTML (not JSON)
  if (/<!doctype html>|<html/i.test(text)) {
    throw new Error(`Upstream returned HTML: ${url}`);
  }
  try { return JSON.parse(text); }
  catch { throw new Error(`Invalid JSON from: ${url}`); }
};

/**
 * BESTBUY
 * Uses official BestBuy Developer API (free key required)
 * Env: BESTBUY_API_KEY
 * Docs (search "BestBuy API"): products endpoint with `search=` and `postalCode=`
 */
async function searchBestBuy(query, zip) {
  const key = process.env.BESTBUY_API_KEY;
  if (!key) return [];

  // Category filter narrows to Trading Cards (optional; adjust as needed).
  // You can remove `+categoryPath.id=abcat0712002` if you want broader results.
  const q = encodeURIComponent(query);
  const url =
    `https://api.bestbuy.com/v1/products(` +
      `search=${q}` +
      `&type!=Music` + // example of excluding noise
      `&type!=Movie` +
      `)+categoryPath.id=abcat0712002` + // Trading Cards (approx)
    `?apiKey=${key}` +
    `&format=json` +
    `&show=name,sku,url,onlineAvailability,salePrice,addToCartUrl,thumbnailImage` +
    `&pageSize=30` +
    (zip ? `&postalCode=${encodeURIComponent(zip)}` : "");

  const data = await fetchJson(url);

  const items = Array.isArray(data.products) ? data.products : [];
  return items.map(p => ({
    name: p.name,
    store: "BestBuy",
    status: p.onlineAvailability ? "In stock" : "Out of stock",
    url: p.addToCartUrl || p.url,
    price: p.salePrice ?? null,
    sku: String(p.sku),
    storeId: null,
    distance: null,
    pickup: null,
    online: p.onlineAvailability === true
  }));
}

/**
 * WALMART (placeholder)
 * For local store restock you typically need a store/location-aware endpoint.
 * We’ll leave this returning [] for now so you can add it later if desired.
 */
async function searchWalmart(_query, _zip) {
  // TODO: implement (requires location-aware upstream)
  return [];
}

/**
 * TARGET (placeholder)
 * Same note as Walmart; leave empty until you decide on a reliable upstream.
 */
async function searchTarget(_query, _zip) {
  // TODO: implement (requires location-aware upstream)
  return [];
}

async function searchProducts({ query, zip }) {
  const q = (query || "").trim();
  if (!q) return [];

  const results = [];
  const tasks = [
    searchBestBuy(q, zip),
    searchWalmart(q, zip),
    searchTarget(q, zip),
  ];

  const settled = await Promise.allSettled(tasks);
  for (const s of settled) {
    if (s.status === "fulfilled" && Array.isArray(s.value)) {
      results.push(...s.value);
    } else if (s.status === "rejected") {
      console.error("[products] source error:", s.reason?.message || s.reason);
    }
  }

  // Basic Pokémon-only filter (defensive).
  const pokeOnly = results.filter(r => /pok[eé]mon/i.test(r.name));
  return pokeOnly;
}

module.exports = { searchProducts };
