// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import targetRoutes from "./targetRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- basic health checks ---
app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// --- mount Target routes ---
app.use("/api/target", targetRoutes);
console.log("✅ Target routes mounted at /api/target");

// --- 404 fallback (keep last) ---
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not Found", path: req.path });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
