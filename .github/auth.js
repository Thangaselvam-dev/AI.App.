// ═══════════════════════════════════════════════
//  routes/auth.js
//  Login & Register Routes
//
//  Endpoints:
//  POST /api/auth/register  — create new admin user
//  POST /api/auth/login     — login and get JWT token
//  GET  /api/auth/me        — get logged-in user info
// ═══════════════════════════════════════════════

const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const router   = express.Router();
const db       = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

// ─── POST /api/auth/register ────────────────────
// Creates a new user in the database
router.post("/register", async (req, res) => {
  const { name, email, password, role = "editor" } = req.body;

  // Basic validation
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  try {
    // Check if email already exists
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered." });
    }

    // Hash the password (never store plain text passwords!)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into database
    const result = await db.query(
      `INSERT INTO users (name, email, password, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, email, role`,
      [name, email, hashedPassword, role]
    );

    const user = result.rows[0];

    // Create a JWT token for the new user
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // Token lasts 7 days
    );

    res.status(201).json({ message: "Account created successfully.", token, user });

  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed." });
  }
});

// ─── POST /api/auth/login ───────────────────────
// Logs in a user and returns a JWT token
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // Find user by email
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = result.rows[0];

    // Compare submitted password with stored hash
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful.",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// ─── GET /api/auth/me ───────────────────────────
// Returns the logged-in user's profile (protected route)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, email, role, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch user." });
  }
});

module.exports = router;
