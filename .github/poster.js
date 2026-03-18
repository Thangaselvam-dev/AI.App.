// ═══════════════════════════════════════════════
//  routes/poster.js
//  DMK Poster Generator — Red/Black Theme
//
//  Endpoints:
//  POST /api/poster/generate    — generate a poster
//  GET  /api/poster/templates   — list poster templates
//  GET  /api/poster/library     — get saved posters
// ═══════════════════════════════════════════════

const express = require("express");
const router  = express.Router();
const db      = require("../db/pool");
const { generateDMKPoster }  = require("../services/aiPoster");
const { authMiddleware }     = require("../middleware/auth");

router.use(authMiddleware);

// ─── POST /api/poster/generate ──────────────────
// Generates a DMK-themed Instagram poster
//
// Request body:
// {
//   slogan:       "தமிழகம் முன்னேறும்",
//   event:        "Republic Day",
//   template:     "rally|achievement|scheme|birthday",
//   leader_photo: "url or base64",   ← optional
//   size:         "post|story|reel"
// }
router.post("/generate", async (req, res) => {
  const {
    slogan,
    event        = "",
    template     = "achievement",
    leader_photo = null,
    size         = "post"       // post=1080x1080, story=1080x1920
  } = req.body;

  if (!slogan) {
    return res.status(400).json({ error: "Slogan text is required." });
  }

  // Determine dimensions from size
  const dimensions = {
    post:  { width: 1080, height: 1080 },
    story: { width: 1080, height: 1920 },
    reel:  { width: 1080, height: 1920 },
  };
  const { width, height } = dimensions[size] || dimensions.post;

  try {
    const result = await generateDMKPoster({
      slogan,
      event,
      template,
      leader_photo,
      width,
      height,
    });

    // Save poster record to database
    await db.query(
      `INSERT INTO media_assets (user_id, type, url, metadata, created_at)
       VALUES ($1, 'poster', $2, $3, NOW())`,
      [
        req.user.id,
        result.image_url,
        JSON.stringify({ slogan, event, template, size }),
      ]
    );

    res.json({
      success:   true,
      image_url: result.image_url,
      slogan,
      template,
      size,
    });

  } catch (err) {
    console.error("Poster generation error:", err);
    res.status(500).json({ error: "Poster generation failed.", detail: err.message });
  }
});

// ─── GET /api/poster/templates ──────────────────
// Returns the list of available DMK poster templates
router.get("/templates", (req, res) => {
  const templates = [
    {
      id:          "rally",
      name:        "Rally Announcement",
      description: "Bold red background with crowd silhouette",
      colors:      ["#C41E3A", "#1A1A1A"],
      style:       "High energy, large typography",
    },
    {
      id:          "achievement",
      name:        "Government Achievement",
      description: "Professional gradient with DMK logo and stats",
      colors:      ["#C41E3A", "#8B0000"],
      style:       "Clean, informational",
    },
    {
      id:          "scheme",
      name:        "Welfare Scheme",
      description: "Warm red with people imagery and Tamil text",
      colors:      ["#C41E3A", "#FFD700"],
      style:       "Approachable, hopeful",
    },
    {
      id:          "birthday",
      name:        "Leader Birthday",
      description: "Celebration theme with leader photo frame",
      colors:      ["#C41E3A", "#1A1A1A", "#FFD700"],
      style:       "Festive, reverent",
    },
    {
      id:          "quote",
      name:        "Inspirational Quote",
      description: "Minimalist dark background with Tamil typography",
      colors:      ["#1A1A1A", "#C41E3A"],
      style:       "Elegant, powerful",
    },
  ];

  res.json({ templates });
});

// ─── GET /api/poster/library ────────────────────
// Returns posters saved by this user
router.get("/library", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, url, metadata, created_at
       FROM media_assets
       WHERE user_id = $1 AND type = 'poster'
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ posters: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch poster library." });
  }
});

module.exports = router;
