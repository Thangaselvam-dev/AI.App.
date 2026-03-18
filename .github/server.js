// ═══════════════════════════════════════════════
//  DMK Campaign Studio — Main Server
//  This is the entry point. It starts your API.
// ═══════════════════════════════════════════════

require("dotenv").config(); // Load .env file variables

const express    = require("express");
const cors       = require("cors");
const rateLimit  = require("express-rate-limit");

// Import all route files (each handles one feature)
const authRoutes      = require("./routes/auth");
const captionRoutes   = require("./routes/caption");
const posterRoutes    = require("./routes/poster");
const reelRoutes      = require("./routes/reel");
const schedulerRoutes = require("./routes/scheduler");
const contentRoutes   = require("./routes/content");

// Start the cron job that auto-posts to Instagram
require("./services/cronJob");

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware (runs on every request) ─────────
// Allow requests from your mobile app and admin panel
app.use(cors({
  origin: [
    "http://localhost:3000",   // Next.js admin panel
    "http://localhost:19006",  // Expo mobile app
    "https://dmkcampaign.in",  // Your live domain
  ],
  credentials: true,
}));

// Parse incoming JSON body (so we can read req.body)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — prevents abuse (100 requests per 15 min)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Please try again later." },
});
app.use("/api/", limiter);

// ─── Routes ─────────────────────────────────────
// Each route file handles a different feature
app.use("/api/auth",      authRoutes);      // Login / Register
app.use("/api/caption",   captionRoutes);   // Tamil caption generator
app.use("/api/poster",    posterRoutes);    // DMK poster generator
app.use("/api/reel",      reelRoutes);      // Reel script generator
app.use("/api/scheduler", schedulerRoutes); // Instagram scheduler
app.use("/api/content",   contentRoutes);   // Saved content library

// ─── Health Check ────────────────────────────────
// Visit http://localhost:5000/health to confirm server is running
app.get("/health", (req, res) => {
  res.json({
    status:  "running",
    app:     "DMK Campaign Studio API",
    version: "1.0.0",
    time:    new Date().toISOString(),
  });
});

// ─── 404 Handler ────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler ────────────────────────
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

// ─── Start Server ────────────────────────────────
app.listen(PORT, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  DMK Campaign Studio API`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

module.exports = app;
