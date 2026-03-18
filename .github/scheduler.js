// ═══════════════════════════════════════════════
//  routes/scheduler.js
//  Instagram Post Scheduler
//
//  Endpoints:
//  POST /api/scheduler/schedule   — schedule a post
//  GET  /api/scheduler/queue      — view scheduled posts
//  DELETE /api/scheduler/:id      — cancel a post
//  POST /api/scheduler/post-now   — post immediately
// ═══════════════════════════════════════════════

const express = require("express");
const router  = express.Router();
const db      = require("../db/pool");
const { postToInstagram } = require("../services/instagram");
const { authMiddleware }  = require("../middleware/auth");

router.use(authMiddleware);

// ─── POST /api/scheduler/schedule ───────────────
// Schedules a post to go out at a specific time
//
// Request body:
// {
//   caption:      "caption text...",
//   image_url:    "https://...",
//   scheduled_at: "2025-01-26T09:00:00.000Z"
// }
router.post("/schedule", async (req, res) => {
  const { caption, image_url, scheduled_at } = req.body;

  if (!caption || !image_url || !scheduled_at) {
    return res.status(400).json({
      error: "caption, image_url, and scheduled_at are all required.",
    });
  }

  // Validate that the scheduled time is in the future
  const postTime = new Date(scheduled_at);
  if (postTime <= new Date()) {
    return res.status(400).json({ error: "scheduled_at must be a future time." });
  }

  try {
    const result = await db.query(
      `INSERT INTO scheduled_posts (user_id, caption, image_url, scheduled_at, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING id, scheduled_at`,
      [req.user.id, caption, image_url, postTime]
    );

    const post = result.rows[0];

    res.json({
      success:      true,
      post_id:      post.id,
      scheduled_at: post.scheduled_at,
      message:      `Post scheduled for ${new Date(post.scheduled_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
    });

  } catch (err) {
    console.error("Scheduler error:", err);
    res.status(500).json({ error: "Could not schedule post." });
  }
});

// ─── POST /api/scheduler/post-now ───────────────
// Posts to Instagram immediately (no scheduling)
router.post("/post-now", async (req, res) => {
  const { caption, image_url } = req.body;

  if (!caption || !image_url) {
    return res.status(400).json({ error: "caption and image_url are required." });
  }

  try {
    const igResult = await postToInstagram({ caption, image_url });

    // Log the post in database
    await db.query(
      `INSERT INTO scheduled_posts (user_id, caption, image_url, status, posted_at, created_at)
       VALUES ($1, $2, $3, 'posted', NOW(), NOW())`,
      [req.user.id, caption, image_url]
    );

    res.json({
      success:   true,
      instagram: igResult,
      message:   "Post published to Instagram successfully!",
    });

  } catch (err) {
    console.error("Post-now error:", err);
    res.status(500).json({ error: "Failed to post to Instagram.", detail: err.message });
  }
});

// ─── GET /api/scheduler/queue ───────────────────
// Returns all scheduled posts (pending and posted)
router.get("/queue", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, caption, image_url, scheduled_at, status, posted_at, created_at
       FROM scheduled_posts
       WHERE user_id = $1
       ORDER BY scheduled_at ASC`,
      [req.user.id]
    );

    // Separate into pending and posted
    const pending = result.rows.filter(p => p.status === "pending");
    const posted  = result.rows.filter(p => p.status === "posted");
    const failed  = result.rows.filter(p => p.status === "failed");

    res.json({ pending, posted, failed, total: result.rows.length });

  } catch (err) {
    res.status(500).json({ error: "Could not fetch schedule queue." });
  }
});

// ─── DELETE /api/scheduler/:id ──────────────────
// Cancels a scheduled post (only if still pending)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `UPDATE scheduled_posts
       SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Post not found or already published." });
    }

    res.json({ success: true, message: "Scheduled post cancelled." });

  } catch (err) {
    res.status(500).json({ error: "Could not cancel post." });
  }
});

module.exports = router;
