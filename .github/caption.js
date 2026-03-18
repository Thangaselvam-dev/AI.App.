// ═══════════════════════════════════════════════
//  routes/caption.js
//  Tamil Caption Generator — DMK Tone
//
//  Endpoints:
//  POST /api/caption/generate  — generate a caption
//  GET  /api/caption/history   — get past captions
//  POST /api/caption/save      — save a caption
// ═══════════════════════════════════════════════

const express  = require("express");
const router   = express.Router();
const db       = require("../db/pool");
const { generateTamilCaption } = require("../services/aiText");
const { authMiddleware }       = require("../middleware/auth");

// All caption routes require login
router.use(authMiddleware);

// ─── POST /api/caption/generate ─────────────────
// Generates a Tamil Instagram caption with DMK tone
//
// Request body:
// {
//   topic:    "கல்வி மேம்பாடு",         ← what the post is about
//   postType: "achievement",             ← achievement / scheme / event / quote
//   leader:   "மு.க.ஸ்டாலின்",          ← optional: feature a leader
//   hashtags: true                       ← include hashtags?
// }
router.post("/generate", async (req, res) => {
  const { topic, postType = "general", leader = "", hashtags = true } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required." });
  }

  try {
    const caption = await generateTamilCaption({ topic, postType, leader, hashtags });

    // Save to database automatically
    await db.query(
      `INSERT INTO generated_content (user_id, type, topic, content, created_at)
       VALUES ($1, 'caption', $2, $3, NOW())`,
      [req.user.id, topic, caption]
    );

    res.json({
      success: true,
      caption,
      topic,
      generated_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error("Caption generation error:", err);
    res.status(500).json({ error: "Caption generation failed.", detail: err.message });
  }
});

// ─── GET /api/caption/history ───────────────────
// Returns the last 20 generated captions for this user
router.get("/history", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, topic, content, created_at
       FROM generated_content
       WHERE user_id = $1 AND type = 'caption'
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    res.json({ captions: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch history." });
  }
});

// ─── POST /api/caption/save ─────────────────────
// Saves a caption to the campaign posts table
router.post("/save", async (req, res) => {
  const { caption, topic, scheduled_at } = req.body;

  if (!caption) {
    return res.status(400).json({ error: "Caption content is required." });
  }

  try {
    const result = await db.query(
      `INSERT INTO campaign_posts (user_id, caption, topic, status, scheduled_at, created_at)
       VALUES ($1, $2, $3, 'draft', $4, NOW())
       RETURNING id`,
      [req.user.id, caption, topic, scheduled_at || null]
    );

    res.json({ success: true, post_id: result.rows[0].id, message: "Caption saved to campaign." });

  } catch (err) {
    res.status(500).json({ error: "Could not save caption." });
  }
});

module.exports = router;
