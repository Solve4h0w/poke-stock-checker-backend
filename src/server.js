// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Health checks ---
app.get("/", (req, res) => {
  res.send("ok");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// OPTIONAL: if you already have other routers, keep them here, e.g.
// import pushRoutes from "./pushRoutes.js";
// import targetRoutes from "./targetRoutes.js";
// app.use("/api", pushRoutes);
// app.use("/api/target", targetRoutes);

// 404 fall-through (so you get JSON instead of "Cannot GET /...")
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not Found", path: req.path });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
