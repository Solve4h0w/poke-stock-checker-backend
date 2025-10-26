// backend/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";

import targetRoutes from "./targetRoutes.js";
import { startWatcher } from "./watcher.js";

const app = express();
app.use(cors());
app.use(express.json());

// simple health checks
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/api/health", (req, res) => res.json({ ok: true }));

// mount Target API routes
app.use("/api/target", targetRoutes);

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);

  // kick off inventory watcher loop
  startWatcher();
});
