import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import listingsRoutes from "./routes/listings.js";
import paymentsRoutes from "./routes/payments.js";
import aiRoutes from "./routes/ai.js";
import fraudRoutes from "./routes/fraud.js";
import reviewsRoutes from "./routes/reviews.js";
import adminRoutes from "./routes/admin.js";
import analyticsRoutes from "./routes/analytics.js";
import supportRoutes from "./routes/support.js";
import logisticsRoutes from "./routes/logistics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.API_PORT || process.env.PORT || "3001", 10);

// ── Middleware ───────────────────────────────────────────
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? false : "*",
    credentials: true,
  })
);
app.use(express.json());

// ── Routes ──────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/fraud", fraudRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/logistics", logisticsRoutes);

// ── Health check ────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
});

// ── Serve static files in production ────────────────────
if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(__dirname, "../../dist/client");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ── Global error handler ────────────────────────────────
app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    });
  }
);

// ── Start ───────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Nexus Exchange server running on http://0.0.0.0:${PORT}`);
});

export default app;