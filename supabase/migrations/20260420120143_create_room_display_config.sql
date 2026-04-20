/*
  # Room Display Configuration & Building Display Modes

  Persistent configuration for room-level datapoint display in the 3D building view
  and building-wide display modes (temperature, CO2, alarm, presence, etc.).

  1. New Tables
    - `room_display_config`
      - `id` (uuid, primary key)
      - `building_id` (text) - building identifier from the addon
      - `floor_id` (text) - floor identifier
      - `room_id` (text, unique with building_id) - room identifier
      - `primary_datapoint` (text) - the datapoint id shown in the whole-building view
      - `primary_label` (text) - optional display label override
      - `primary_unit` (text) - optional unit override
      - `visible_datapoints` (jsonb) - ordered array of datapoint display configs
      - `description` (text) - room description
      - `metadata` (jsonb) - freeform metadata (setpoints, etc.)
      - `updated_at` (timestamptz)
      - `created_at` (timestamptz)
    - `building_display_state`
      - `id` (uuid, primary key)
      - `building_id` (text, unique)
      - `mode` (text) - active display mode (temperature, co2, alarm, presence, mode, custom, none)
      - `mode_config` (jsonb) - mode-specific configuration (thresholds, colors)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Permissive policies for authenticated and anonymous users (single-tenant addon deployment)
    - Future-ready: the policies check against auth role but do not restrict by user
      since this addon runs as a shared building-automation panel.

  3. Notes
    - The addon does not yet use Supabase auth; policies allow both anon and
      authenticated access for read/write to keep the addon functional.
    - When auth is added later, policies can be tightened without schema changes.
*/

CREATE TABLE IF NOT EXISTS room_display_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id text NOT NULL,
  floor_id text NOT NULL DEFAULT '',
  room_id text NOT NULL,
  primary_datapoint text NOT NULL DEFAULT '',
  primary_label text NOT NULL DEFAULT '',
  primary_unit text NOT NULL DEFAULT '',
  visible_datapoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_display_config_building
  ON room_display_config (building_id);
CREATE INDEX IF NOT EXISTS idx_room_display_config_floor
  ON room_display_config (building_id, floor_id);

ALTER TABLE room_display_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room config - anon can read"
  ON room_display_config FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Room config - authenticated can read"
  ON room_display_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Room config - anon can insert"
  ON room_display_config FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Room config - authenticated can insert"
  ON room_display_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Room config - anon can update"
  ON room_display_config FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Room config - authenticated can update"
  ON room_display_config FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Room config - anon can delete"
  ON room_display_config FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Room config - authenticated can delete"
  ON room_display_config FOR DELETE
  TO authenticated
  USING (true);


CREATE TABLE IF NOT EXISTS building_display_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id text UNIQUE NOT NULL,
  mode text NOT NULL DEFAULT 'none',
  mode_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE building_display_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Building mode - anon can read"
  ON building_display_state FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Building mode - authenticated can read"
  ON building_display_state FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Building mode - anon can insert"
  ON building_display_state FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Building mode - authenticated can insert"
  ON building_display_state FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Building mode - anon can update"
  ON building_display_state FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Building mode - authenticated can update"
  ON building_display_state FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
