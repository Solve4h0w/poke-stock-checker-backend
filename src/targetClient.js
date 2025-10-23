// backend/src/targetClient.js
import fetch from "node-fetch";

/**
 * Minimal Target “client” that calls the same internal JSON APIs
 * the Target product page calls (via RedSky) using the web “key”
 * you captured in DevTools.
 */

const TARGET_BASE = "https://redsky.target.com/redsky_aggregations";

/**
 * Search Target catalog by keyword.
 * @param {string} q  keyword, e.g., "pokemon", "151", "prismatic"
 * @param {string} key  Target web key from DevTools
 * @param {string|number} storeId Target store id (optional but helps availability)
 */
export async function searchTarget({ q, key, storeId }) {
  if (!key) throw new Error("Missing Target web key");

  // This aggregator returns a compact product list for a query.
  // We keep it simple and just extract some basic fields.
  const url = new URL(`${TARGET_BASE}/v1/web/plp_search_v1`);
  url.searchParams.set("key", key);
  url.searchParams.set("keyword", q);
  url.searchParams.set("page", "1");
  url.searchParams.set("size", "24"); // first page
  if (storeId) url.searchParams.set("store_id", String(storeId));

  const res = await fetch(url.toString(), {
    headers: {
      "accept": "application/json",
      "x-requested-with": "XMLHttpRequest",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Target search failed: ${res.status} ${text}`);
  }

  const json = await res.json();

  // Extract a small, stable subset for your app
  const items = (json?.data?.search?.products || []).map((p) => ({
    tcin: p?.tcin,
    title: p?.item?.product_description?.title || p?.title,
    brand: p?.item?.brand_name,
    price: p?.price?.current_retail || p?.price?.formatted_current_price,
    image: p?.item?.enrichment?.images?.primary_image_url,
    url: p?.item?.enrichment?.buy_url || (p?.tcin ? `https://www.target.com/p/${p.tcin}` : null),
  }));

  return { ok: true, count: items.length, items };
}
