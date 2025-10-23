// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---- Health ---------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ status: true, ts: Date.now() });
});

// ---- CSV products (existing) ----------------------------------------
// This example returns an empty list if you already had a parser elsewhere.
// If you already have a working products handler, keep that instead.
app.get("/api/products", async (req, res) => {
  try {
    // If you have a CSV/Google Sheets loader, call it here and return JSON.
    // Placeholder to keep route alive:
    res.json([]);
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ---- Target live search ---------------------------------------------
/**
 * Expected env (set in Render → Environment):
 *   TARGET_WEB_KEY   -> value you found in Network tab (redsky 'key' query param)
 * Optional:
 *   TARGET_STORE_ID  -> default Target store id (e.g., 2314)
 */
function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj?.[k] !== undefined) out[k] = obj[k];
  return out;
}

app.get("/api/target/search", async (req, res) => {
  try {
    const key = process.env.TARGET_WEB_KEY;
    if (!key) return res.status(500).json({ ok: false, error: "TARGET_WEB_KEY missing" });

    const q = (req.query.q || "").toString().trim();
    if (!q) return res.status(400).json({ ok: false, error: "Missing q" });

    const store = (req.query.store || process.env.TARGET_STORE_ID || "").toString().trim();

    // RedSky search endpoint (public web API used by target.com)
    const url = new URL("https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v1");
    url.searchParams.set("key", key);
    url.searchParams.set("keyword", q);
    url.searchParams.set("count", "24");
    url.searchParams.set("offset", "0");
    if (store) url.searchParams.set("store_id", store);

    const r = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ ok: false, error: `Target http ${r.status}`, body: text.slice(0, 200) });
    }
    const data = await r.json();

    const products = data?.data?.search?.products || [];
    const items = products.map((p) => {
      const bp = p?.price?.current_retail || p?.price?.current_retail_min;
      return {
        tcin: p?.tcin,
        title: p?.item?.product_description?.title,
        price: typeof bp === "number" ? bp.toFixed(2) : undefined,
        url: p?.item?.enrichment?.buy_url || (p?.item?.fully_qualified_url ? `https://www.target.com${p.item.fully_qualified_url}` : undefined),
        in_stock: p?.fulfillment?.store_options?.some?.((opt) => opt?.in_store_only === true || opt?.order_pickup?.availability_status === "IN_STOCK") || false,
      };
    });

    res.json({ ok: true, query: { q, store: store || null }, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ---- Root helps you remember available routes -----------------------
app.get("/", (req, res) => {
  res.type("text").send(
    [
      "OK",
      "Routes:",
      "  GET /health",
      "  GET /api/products",
      "  GET /api/target/search?q=151&store=2314",
    ].join("\n")
  );
});

// ---- Start ----------------------------------------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
