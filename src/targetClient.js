// backend/src/targetClient.js  (ESM)

// Very small RedSky client that uses the ephemeral Target "web key" you grabbed
// from Network tab (DevTools). It returns a normalized array of products.

function buildSearchUrl({ q, key, store }) {
  const params = new URLSearchParams({
    key,                 // Target web key (ephemeral)
    keyword: q,          // search term, e.g., "151", "prismatic"
    channel: "WEB",
    count: "24",
    offset: "0"
  });

  // If you add a store id, RedSky tends to bias results to that store
  if (store) params.set("store_id", store);

  return `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v1?${params}`;
}

export async function searchTarget({ q, key, store }) {
  const url = buildSearchUrl({ q, key, store });

  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "application/json"
    }
  });

  if (!r.ok) {
    throw new Error(`redsky ${r.status}`);
  }

  const json = await r.json();

  // The RedSky structure changes. Grab the most likely list of products:
  const products =
    json?.data?.search?.products ||
    json?.data?.children ||
    json?.data?.results ||
    [];

  const items = products.map((p) => {
    const tcin = p.tcin || p.item?.tcin;
    const title =
      p.title ||
      p.item?.product_description?.title ||
      p.item?.product_description?.downstream_description ||
      p.item?.enrichment?.buy_url ||
      "Unknown";

    // Try to pull any price-like thing that might exist as an example:
    const price =
      p.price?.current_retail ||
      p.price?.formatted_current_price ||
      p.price?.current_price ||
      null;

    const url = tcin ? `https://www.target.com/p/${tcin}` : undefined;

    // A very rough stock hint if present:
    const in_stock =
      p.fulfillment?.is_out_of_stock === false ||
      p.sale_channel_availability?.status === "IN_STOCK" ||
      undefined;

    return { tcin, title, price, url, in_stock, raw: p };
  });

  return { items, raw: json };
}
