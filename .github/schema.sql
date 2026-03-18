-- ═══════════════════════════════════════════════
--  db/schema.sql
--  DMK Campaign Studio — Database Schema
--
--  Run this file once to create all tables:
--  psql -U postgres -d dmk_campaign -f db/schema.sql
-- ═══════════════════════════════════════════════

-- ─── Users ───────────────────────────────────────
-- Campaign managers and editors who log in
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100)        NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255)        NOT NULL,  -- bcrypt hashed
  role       VARCHAR(20)         DEFAULT 'editor', -- 'admin' or 'editor'
  created_at TIMESTAMP           DEFAULT NOW()
);

-- ─── Generated Content ───────────────────────────
-- Stores every AI-generated caption and reel script
CREATE TABLE IF NOT EXISTS generated_content (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,   -- 'caption', 'reel_script'
  topic      TEXT,
  content    TEXT        NOT NULL,
  created_at TIMESTAMP   DEFAULT NOW()
);

-- ─── Campaign Posts ───────────────────────────────
-- Draft posts ready to be scheduled or published
CREATE TABLE IF NOT EXISTS campaign_posts (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  caption      TEXT        NOT NULL,
  image_url    TEXT,
  topic        VARCHAR(255),
  status       VARCHAR(20) DEFAULT 'draft', -- draft, scheduled, posted
  scheduled_at TIMESTAMP,
  created_at   TIMESTAMP   DEFAULT NOW()
);

-- ─── Media Assets ─────────────────────────────────
-- Stores generated posters and uploaded leader photos
CREATE TABLE IF NOT EXISTS media_assets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50),  -- 'poster', 'leader_photo', 'reel_thumbnail'
  url        TEXT NOT NULL,
  metadata   JSONB,        -- stores template, size, slogan etc.
  created_at TIMESTAMP     DEFAULT NOW()
);

-- ─── Scheduled Posts ──────────────────────────────
-- Posts with a specific publish time (used by cron job)
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  caption       TEXT NOT NULL,
  image_url     TEXT NOT NULL,
  scheduled_at  TIMESTAMP,
  status        VARCHAR(20) DEFAULT 'pending', -- pending, posted, failed, cancelled
  posted_at     TIMESTAMP,
  ig_post_id    VARCHAR(100),  -- Instagram post ID after publishing
  error_message TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ─── Indexes for speed ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status
  ON scheduled_posts(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_generated_content_user
  ON generated_content(user_id, type);

CREATE INDEX IF NOT EXISTS idx_media_assets_user
  ON media_assets(user_id, type);

-- ─── Default admin user (change password!) ────────
-- Password: dmk@admin123 (change this immediately)
INSERT INTO users (name, email, password, role)
VALUES (
  'DMK Admin',
  'admin@dmkcampaign.in',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'admin'
) ON CONFLICT (email) DO NOTHING;
