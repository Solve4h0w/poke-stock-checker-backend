// backend/src/targetClient.js
import 'dotenv/config';

const REDSKY_BASE =
  'https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';

export async function searchTarget(keyword) {
  const key = process.env.TARGET_WEB_KEY;
  const storeId = process.env.TARGET_STORE_ID || '2314'; // fallback = a real store

  if (!key) {
    throw new Error('TARGET_WEB_KEY is missing');
  }

  // keep it simple: pass the minimum that works reliably
  const params = new URLSearchParams({
    key,                                // your redsky "web" key from plp_search_v2
    count: '24',                        // page size
    offset: '0',
    default_purchasability_filter: 'true',
    include_sponsored: 'true',
    keyword: keyword,
    page: `/s?searchTerm=${encodeURIComponent(keyword)}`,
    platform: 'desktop',
    channel: 'WEB',
    pricing_store_id: storeId,
    store_ids: storeId,
  });

  const url = `${REDSKY_BASE}?${params.toString()}`;

  const headers = {
    // make it look like a browser page search
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://www.target.com',
    'Referer': `https://www.target.com/s?searchTerm=${encodeURIComponent(keyword)}`,
    'User-Agent': UA,
  };

  const res = await fetch(url, { headers });

  if (!res.ok) {
    // expose exact http code in error to make debugging transparent
    const bodyText = await res.text().catch(() => '');
    throw new Error(`Target search failed: ${res.status} ${bodyText.slice(0, 200)}`);
  }

  const data = await res.json();

  // RedSky shape: data?.data?.search?.products
  const products =
    data?.data?.search?.products?.map(p => ({
      tcin: p?.tcin,
      title: p?.item?.product_description?.title,
      upc: p?.item?.primary_barcode,
      price: p?.price?.current_retail || p?.price?.formatted_current_price,
      availability: p?.fulfillment?.shipping_options?.[0]?.availability_status
        || p?.fulfillment?.pickup_options?.[0]?.availability_status
        || p?.fulfillment?.scheduled_delivery_options?.[0]?.availability_status
        || null,
      image: p?.item?.enrichment?.images?.primary_image_url
        || p?.item?.enrichment?.images?.base_url,
      url: p?.item?.enrichment?.buy_url || null,
      raw: p, // keep raw in case you want to inspect later
    })) ?? [];

  return { ok: true, count: products.length, products };
}
