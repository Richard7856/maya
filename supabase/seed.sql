-- ============================================================
-- Maya — Development Seed Data
-- Run AFTER 001_initial_schema.sql
--
-- IMPORTANT: This creates test data only.
-- The admin user must be created first via Supabase Auth
-- (Dashboard → Authentication → Users → Add User), then
-- copy the UUID into the INSERT below.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Replace this UUID with the actual admin user UUID from
-- Supabase Authentication after you create the admin account.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  -- REPLACE THIS with the UUID from Supabase Auth → Users after creating admin
  v_admin_id UUID := '72c1b269-c2aa-4bc2-817f-c5c6012638c0';

  v_building1_id UUID := gen_random_uuid();
  v_building2_id UUID := gen_random_uuid();
  v_building3_id UUID := gen_random_uuid();
BEGIN

-- ── Admin user profile ───────────────────────────────────────
-- Create this user in Supabase Auth first, then insert the profile.
-- Supabase Auth email: admin@maya.app | Password: Maya2025!
INSERT INTO user_profiles (id, role, first_name, last_name, phone, is_active)
VALUES (v_admin_id, 'admin', 'Admin', 'Maya', '+5215512345678', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── Buildings ────────────────────────────────────────────────
INSERT INTO buildings (id, name, address, city) VALUES
  (v_building1_id, 'Edificio Álamos',   'Calle Álamos 45, Col. Narvarte',    'Ciudad de México'),
  (v_building2_id, 'Edificio Del Valle', 'Av. Insurgentes 120, Col. Del Valle', 'Ciudad de México'),
  (v_building3_id, 'Edificio Coyoacán',  'Calle Malintzin 8, Col. Del Carmen', 'Ciudad de México');

-- ── Rooms — Edificio Álamos (4 rooms) ───────────────────────
INSERT INTO rooms (building_id, room_number, section, status, monthly_rate) VALUES
  (v_building1_id, '101', 'Planta Baja', 'occupied',   5500.00),
  (v_building1_id, '102', 'Planta Baja', 'vacant',     5500.00),
  (v_building1_id, '201', 'Piso 2',      'occupied',   6000.00),
  (v_building1_id, '202', 'Piso 2',      'incoming',   6000.00);

-- ── Rooms — Edificio Del Valle (3 rooms) ────────────────────
INSERT INTO rooms (building_id, room_number, section, status, monthly_rate) VALUES
  (v_building2_id, 'A1', NULL, 'occupied',    6500.00),
  (v_building2_id, 'A2', NULL, 'vacant',      6500.00),
  (v_building2_id, 'A3', NULL, 'maintenance', 6500.00);

-- ── Rooms — Edificio Coyoacán (3 rooms) ─────────────────────
INSERT INTO rooms (building_id, room_number, section, status, monthly_rate) VALUES
  (v_building3_id, '1', 'Casa Principal', 'occupied', 7000.00),
  (v_building3_id, '2', 'Casa Principal', 'occupied', 7000.00),
  (v_building3_id, '3', 'Estudio',        'vacant',   5800.00);

RAISE NOTICE 'Seed data inserted successfully.';
RAISE NOTICE 'Building 1 (Álamos): %', v_building1_id;
RAISE NOTICE 'Building 2 (Del Valle): %', v_building2_id;
RAISE NOTICE 'Building 3 (Coyoacán): %', v_building3_id;
RAISE NOTICE '';
RAISE NOTICE 'NEXT STEPS:';
RAISE NOTICE '1. Create admin user in Supabase Auth: admin@maya.app';
RAISE NOTICE '2. Copy the UUID and replace v_admin_id at the top of this file';
RAISE NOTICE '3. Re-run the admin INSERT only (or update the profile manually)';

END $$;
