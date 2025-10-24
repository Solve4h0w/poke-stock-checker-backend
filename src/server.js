// backend/src/server.js
import "dotenv/config.js";
import express from "express";
import cors from "cors";
import buildTargetRouter from "./targetRoutes.js";

const app = express();
app.use(cors());

// Simple health checks
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Mount Target routes
app.use("/api/target", buildTargetRouter(process.env));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);
});
