-- Jgoalz Phase 2 Schema Migration
-- Run this in Supabase SQL Editor AFTER the initial schema

-- 1. Player profile enhancements
ALTER TABLE players ADD COLUMN IF NOT EXISTS commitment text NOT NULL DEFAULT 'sub'
  CHECK (commitment IN ('permanent', 'sub'));
ALTER TABLE players ADD COLUMN IF NOT EXISTS play_day integer
  CHECK (play_day IS NULL OR play_day BETWEEN 0 AND 6);
ALTER TABLE players ADD COLUMN IF NOT EXISTS play_time text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS location_preference text;  -- stores location name (text), not FK; enforced at app layer
ALTER TABLE players ADD COLUMN IF NOT EXISTS phone2 text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE players ADD COLUMN IF NOT EXISTS school text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS waiver_accepted_at timestamptz;
ALTER TABLE players ADD COLUMN IF NOT EXISTS policy_accepted_at timestamptz;

-- 2. Locations reference table (extensible)
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed current locations
INSERT INTO locations (name) VALUES ('Boro Park'), ('Williamsburg'), ('Flatbush')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access" ON locations FOR ALL USING (true) WITH CHECK (true);

-- 3. Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  segment text CHECK (segment IS NULL OR segment IN ('women', 'teens', 'girls')),
  sent_via_sms boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access" ON announcements FOR ALL USING (true) WITH CHECK (true);

-- 4. Reviews / comments table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  body text NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access" ON reviews FOR ALL USING (true) WITH CHECK (true);

-- 5. Experience level for registration
ALTER TABLE players ADD COLUMN IF NOT EXISTS experience_level text
  CHECK (experience_level IS NULL OR experience_level IN ('beginner', 'experienced'));

-- 5b. Password hash for player auth
ALTER TABLE players ADD COLUMN IF NOT EXISTS password_hash text;

-- 5c. Marital status for women
ALTER TABLE players ADD COLUMN IF NOT EXISTS marital_status text
  CHECK (marital_status IS NULL OR marital_status IN ('Single', 'Married', 'Other'));

-- 6. Cancellation policy acknowledgments (per session signup)
ALTER TABLE session_players ADD COLUMN IF NOT EXISTS policy_accepted boolean NOT NULL DEFAULT false;

-- 7. Admin flag for players
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Transportation toggle for girls games
ALTER TABLE games ADD COLUMN IF NOT EXISTS requires_transport boolean NOT NULL DEFAULT false;

-- Soft-delete support for games
ALTER TABLE games ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- 6. Add sms_log types for new features
-- (existing check constraint needs to be replaced)
ALTER TABLE sms_log DROP CONSTRAINT IF EXISTS sms_log_type_check;
ALTER TABLE sms_log ADD CONSTRAINT sms_log_type_check
  CHECK (type IN ('spot_open', 'credit_low', 'payment_reminder',
    'cancellation_confirm', 'driver_roster', 'drop_in_notification',
    'announcement', 'welcome'));
