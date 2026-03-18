// ═══════════════════════════════════════════════
//  routes/reel.js
//  Instagram Reel Script Generator
//
//  Endpoints:
//  POST /api/reel/generate    — generate a reel script
//  GET  /api/reel/history     — past scripts
// ═══════════════════════════════════════════════

const express = require("express");
const router  = express.Router();
const db      = require("../db/pool");
const { generateReelScript } = require("../services/aiText");
const { authMiddleware }     = require("../middleware/auth");

router.use(authMiddleware);

// ─── POST /api/reel/generate ────────────────────
// Generates a complete Reel script with scenes
//
// Request body:
// {
//   topic:    "Kalaignar Centenary Celebration",
//   duration: 30,          ← seconds (15, 30, 60)
//   style:    "motivational|news|celebration|scheme"
// }
router.post("/generate", async (req, res) => {
  const { topic, duration = 30, style = "motivational" } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required." });
  }

  if (![15, 30, 60].includes(Number(duration))) {
    return res.status(400).json({ error: "Duration must be 15, 30, or 60 seconds." });
  }

  try {
    const script = await generateReelScript({ topic, duration: Number(duration), style });

    // Save to database
    await db.query(
      `INSERT INTO generated_content (user_id, type, topic, content, created_at)
       VALUES ($1, 'reel_script', $2, $3, NOW())`,
      [req.user.id, topic, script]
    );

    res.json({
      success:  true,
      script,
      topic,
      duration,
      style,
      tip: "Use CapCut or Adobe Premiere to produce the final reel from this script.",
    });

  } catch (err) {
    console.error("Reel script error:", err);
    res.status(500).json({ error: "Reel script generation failed.", detail: err.message });
  }
});

// ─── GET /api/reel/history ──────────────────────
router.get("/history", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, topic, content, created_at
       FROM generated_content
       WHERE user_id = $1 AND type = 'reel_script'
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ scripts: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch history." });
  }
});

module.exports = router;
