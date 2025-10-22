// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const DATA_URL = process.env.DATA_URL || ""; // public CSV export url
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 60);

let cache = { data: null, expiresAt: 0 };

function toBool(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return ["true", "1", "yes", "y"].includes(s);
}

function normalizeRow([store, item, inStock]) {
  const s = (store ?? "").toString().trim();
  const i = (item ?? "").toString().trim();
  const stock = toBool(inStock);
  // drop fully-blank rows; otherwise default unknowns
  if (!s && !i) return null;
  return { store: s || "Unknown", item: i || "Unknown", inStock: stock };
}

function parseCSV(csv) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  // Expect header line then data
  const dataLines = lines.slice(1);
  return dataLines
    .map((line) => line.split(","))
    .map(normalizeRow)
    .filter(Boolean);
}

async function fetchFromSource() {
  if (!DATA_URL) throw new Error("Missing DATA_URL env var");
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

function cacheValid() {
  return cache.data && Date.now() < cache.expiresAt;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    time: Date.now(),
    cacheValid: cacheValid(),
    source: DATA_URL ? "csv" : "unset",
    url: DATA_URL || null,
  });
});

app.get("/stock", async (_req, res) => {
  try {
    if (cacheValid()) {
      return res.json(cache.data);
    }
    const data = await fetchFromSource();
    cache = {
      data,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    };
    res.json(data);
  } catch (err) {
    console.error("Error in /stock:", err);
    res.status(200).json([
      { store: "Unknown", item: "Error", inStock: false, error: String(err.message || err) },
    ]);
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on 0.0.0.0:${PORT}`);
  if (DATA_URL) console.log("Source:", DATA_URL);
  console.log("Cache TTL (s):", CACHE_TTL_SECONDS);
});
