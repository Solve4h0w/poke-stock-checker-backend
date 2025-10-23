// backend/src/server.js  (ESM)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import targetRoutes from "./targetRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Health ----------
app.get("/health", (_req, res) => {
  res.json({ status: true, ts: Date.now() });
});

// ---------- Products (your existing polling endpoint) ----------
const PRODUCTS_PATH = process.env.PRODUCTS_PATH || "/api/products";
const DATA_URL = process.env.DATA_URL || "";
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 60);

let _cache = { ts: 0, data: [] };

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "text/plain, */*",
    },
  });
  if (!r.ok) throw new Error(`DATA_URL fetch failed: ${r.status}`);
  return r.text();
}

function parseCSV(text) {
  // Tiny CSV parser good enough for simple Google Sheets CSV
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift()?.split(",") ?? [];
  return lines.map((line) => {
    const cols = line.split(",");
    const obj = {};
    header.forEach((h, i) => (obj[h.trim()] = (cols[i] || "").trim()));
    return obj;
  });
}

async function loadProducts() {
  if (!DATA_URL) return [];
  const raw = await fetchText(DATA_URL);
  // If your sheet is CSV, this will work. If you ever switch to JSON, adapt here.
  return parseCSV(raw);
}

app.get(PRODUCTS_PATH, async (_req, res) => {
  try {
    const now = Date.now();
    if (now - _cache.ts > CACHE_TTL_SECONDS * 1000) {
      const data = await loadProducts();
      _cache = { ts: now, data };
    }
    res.json(_cache.data);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ---------- Target endpoints ----------
app.use("/api/target", targetRoutes);

// ---------- Root ----------
app.get("/", (_req, res) => {
  res.type("text/plain").send("ok");
});

// ---------- Listen ----------
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
