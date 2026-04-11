-- ============================================================
-- Maya — Development Seed Data
-- Run AFTER 001_initial_schema.sql
--
-- Creates a full demo dataset: admin, tenants, cleaners,
-- buildings, rooms, leases, incidents, tickets, and cleaning
-- assignments so the dashboard has real content to display.
--
-- All auth.users entries (including admin) are created by this seed.
-- No manual Auth setup needed — just run this after the schema migration.
-- ============================================================

DO $$
DECLARE
  -- Admin user — deterministic UUID so it's easy to reference
  v_admin_id UUID := '72c1b269-c2aa-4bc2-817f-c5c6012638c0';

  -- Demo tenants (no auth users needed for admin dashboard testing)
  v_tenant1_id UUID := gen_random_uuid();
  v_tenant2_id UUID := gen_random_uuid();
  v_tenant3_id UUID := gen_random_uuid();
  v_tenant4_id UUID := gen_random_uuid();

  -- Demo cleaners
  v_cleaner1_id UUID := gen_random_uuid();
  v_cleaner2_id UUID := gen_random_uuid();

  -- Demo security
  v_security1_id UUID := gen_random_uuid();

  -- Buildings
  v_building1_id UUID := gen_random_uuid();
  v_building2_id UUID := gen_random_uuid();
  v_building3_id UUID := gen_random_uuid();

  -- Rooms (named for reference in leases/incidents)
  v_room_a101 UUID := gen_random_uuid();
  v_room_a102 UUID := gen_random_uuid();
  v_room_a201 UUID := gen_random_uuid();
  v_room_a202 UUID := gen_random_uuid();
  v_room_dv_a1 UUID := gen_random_uuid();
  v_room_dv_a2 UUID := gen_random_uuid();
  v_room_dv_a3 UUID := gen_random_uuid();
  v_room_co_1 UUID := gen_random_uuid();
  v_room_co_2 UUID := gen_random_uuid();
  v_room_co_3 UUID := gen_random_uuid();

  -- Leases
  v_lease1 UUID := gen_random_uuid();
  v_lease2 UUID := gen_random_uuid();
  v_lease3 UUID := gen_random_uuid();
  v_lease4 UUID := gen_random_uuid();

  -- Incidents
  v_incident1 UUID := gen_random_uuid();
  v_incident2 UUID := gen_random_uuid();
  v_incident3 UUID := gen_random_uuid();

  -- Tickets
  v_ticket1 UUID := gen_random_uuid();
  v_ticket2 UUID := gen_random_uuid();
  v_ticket3 UUID := gen_random_uuid();

BEGIN

-- ── Auth Users (minimal records so FK to auth.users is satisfied) ──
-- All users need auth.users entries for the user_profiles FK constraint.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token)
VALUES
  (v_admin_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@maya.com',        crypt('SEED_PASS_REMOVED', gen_salt('bf')), NOW(), NOW(), NOW(), '', ''),
  (v_tenant1_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carlos@demo.maya.app',  crypt('SEED_PASS_REMOVED', gen_salt('bf')), NOW(), NOW(), NOW(), '', ''),
  (v_tenant2_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maria@demo.maya.app',   crypt('SEED_PASS_REMOVED', gen_salt('bf')), NOW(), NOW(), NOW(), '', ''),
  (v_tenant3_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roberto@demo.maya.app', crypt('SEED_PASS_REMOVED', gen_salt('bf')), NOW(), NOW(), NOW(), '', ''),
  (v_tenant4_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@demo.maya.app',     crypt('SEED_PASS_REMOVED', gen_salt('bf')), NOW(), NOW(), NOW(), '', ''),
  (v_cleaner1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lucia@demo.maya.app',   crypt('SEED_PASS_REMOVED', gen_salt('bf')), NOW(), NOW(), NOW(), '', ''),
  (v_cleaner2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pedro@demo.maya.app',   crypt('SEED_PASS_REMOVED', gen_salt('bf')), NOW(), NOW(), NOW(), '', ''),
  (v_security1_id,'00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jorge@demo.maya.app',   crypt('SEED_PASS_REMOVED', gen_salt('bf')), NOW(), NOW(), NOW(), '', '')
ON CONFLICT (id) DO NOTHING;

-- Also need identity records for Supabase Auth to work
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT id, id, email, jsonb_build_object('sub', id, 'email', email), 'email', NOW(), NOW(), NOW()
FROM auth.users WHERE email LIKE '%@demo.maya.app' OR email = 'admin@maya.com'
ON CONFLICT DO NOTHING;

-- ── User Profiles ───────────────────────────────────────────
INSERT INTO user_profiles (id, role, first_name, last_name, phone, rfc, is_active, is_locked) VALUES
  (v_admin_id,    'admin',    'Admin',     'Maya',      '+5215512345678', NULL,            TRUE, FALSE),
  (v_tenant1_id,  'tenant',   'Carlos',    'López',     '+5215598765432', 'LOPC950215XYZ', TRUE, FALSE),
  (v_tenant2_id,  'tenant',   'María',     'Hernández', '+5215587654321', 'HERM880401ABC', TRUE, FALSE),
  (v_tenant3_id,  'tenant',   'Roberto',   'García',    '+5215576543210', 'GARR900615DEF', TRUE, TRUE),  -- locked (late payment demo)
  (v_tenant4_id,  'tenant',   'Ana',       'Martínez',  '+5215565432109', 'MARA920830GHI', TRUE, FALSE),
  (v_cleaner1_id, 'cleaning', 'Lucía',     'Ramírez',   '+5215554321098', NULL,            TRUE, FALSE),
  (v_cleaner2_id, 'cleaning', 'Pedro',     'Sánchez',   '+5215543210987', NULL,            TRUE, FALSE),
  (v_security1_id,'security', 'Jorge',     'Torres',    '+5215532109876', NULL,            TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ── Buildings ───────────────────────────────────────────────
INSERT INTO buildings (id, name, address, city) VALUES
  (v_building1_id, 'Edificio Álamos',   'Calle Álamos 45, Col. Narvarte',      'Ciudad de México'),
  (v_building2_id, 'Edificio Del Valle', 'Av. Insurgentes 120, Col. Del Valle', 'Ciudad de México'),
  (v_building3_id, 'Edificio Coyoacán',  'Calle Malintzin 8, Col. Del Carmen',  'Ciudad de México');

-- ── Rooms ───────────────────────────────────────────────────
-- Álamos (4 rooms)
INSERT INTO rooms (id, building_id, room_number, section, status, monthly_rate) VALUES
  (v_room_a101,  v_building1_id, '101', 'Planta Baja', 'occupied',    5500.00),
  (v_room_a102,  v_building1_id, '102', 'Planta Baja', 'vacant',      5500.00),
  (v_room_a201,  v_building1_id, '201', 'Piso 2',      'occupied',    6000.00),
  (v_room_a202,  v_building1_id, '202', 'Piso 2',      'incoming',    6000.00);

-- Del Valle (3 rooms)
INSERT INTO rooms (id, building_id, room_number, section, status, monthly_rate) VALUES
  (v_room_dv_a1, v_building2_id, 'A1', NULL, 'occupied',    6500.00),
  (v_room_dv_a2, v_building2_id, 'A2', NULL, 'vacant',      6500.00),
  (v_room_dv_a3, v_building2_id, 'A3', NULL, 'maintenance', 6500.00);

-- Coyoacán (3 rooms)
INSERT INTO rooms (id, building_id, room_number, section, status, monthly_rate) VALUES
  (v_room_co_1,  v_building3_id, '1', 'Casa Principal', 'occupied', 7000.00),
  (v_room_co_2,  v_building3_id, '2', 'Casa Principal', 'occupied', 7000.00),
  (v_room_co_3,  v_building3_id, '3', 'Estudio',        'vacant',   5800.00);

-- ── Leases ──────────────────────────────────────────────────
INSERT INTO leases (id, room_id, tenant_id, start_date, end_date, monthly_rate, payment_day, deposit_amount, deposit_paid, status, access_code_encrypted) VALUES
  (v_lease1, v_room_a101,  v_tenant1_id, '2026-01-01', '2026-12-31', 5500.00, 1,  5500.00, TRUE,  'active', 'DEMO1234'),
  (v_lease2, v_room_a201,  v_tenant2_id, '2026-02-01', '2027-01-31', 6000.00, 5,  6000.00, TRUE,  'active', 'DEMO5678'),
  (v_lease3, v_room_dv_a1, v_tenant3_id, '2025-06-01', '2026-05-31', 6500.00, 10, 6500.00, TRUE,  'active', 'DEMO9012'),
  (v_lease4, v_room_co_1,  v_tenant4_id, '2026-03-01', NULL,         7000.00, 1,  7000.00, FALSE, 'active', 'DEMO3456');

-- ── Payments (current month for each lease) ─────────────────
INSERT INTO payments (lease_id, amount, due_date, status) VALUES
  (v_lease1, 5500.00, '2026-04-01', 'paid'),
  (v_lease2, 6000.00, '2026-04-05', 'pending'),
  (v_lease3, 6500.00, '2026-04-10', 'overdue'),
  (v_lease4, 7000.00, '2026-04-01', 'paid');

-- Previous month payments
INSERT INTO payments (lease_id, amount, due_date, paid_at, status) VALUES
  (v_lease1, 5500.00, '2026-03-01', '2026-03-01T10:00:00Z', 'paid'),
  (v_lease2, 6000.00, '2026-03-05', '2026-03-06T14:30:00Z', 'paid'),
  (v_lease3, 6500.00, '2026-03-10', NULL, 'overdue'),
  (v_lease4, 7000.00, '2026-03-01', '2026-03-02T09:15:00Z', 'paid');

-- ── Incidents ───────────────────────────────────────────────
INSERT INTO incidents (id, room_id, reported_by, assigned_to, title, description, category, priority, status, created_at) VALUES
  (v_incident1, v_room_a101,  v_tenant1_id, NULL,        'Fuga en el baño',           'Hay una fuga de agua debajo del lavabo que está mojando el piso.', 'plumbing',   'high',   'open',        '2026-04-03T08:30:00Z'),
  (v_incident2, v_room_dv_a1, v_tenant3_id, v_admin_id,  'Contacto eléctrico dañado', 'El contacto de la pared norte no funciona, hace chispas al conectar algo.', 'electrical', 'urgent', 'in_progress', '2026-04-01T15:00:00Z'),
  (v_incident3, v_room_co_1,  v_tenant4_id, NULL,        'Refrigerador no enfría',    'El refrigerador de la cocina dejó de enfriar desde ayer.', 'appliance',  'medium', 'open',        '2026-04-04T12:00:00Z');

-- Incident updates
INSERT INTO incident_updates (incident_id, author_id, note, status_changed_to, created_at) VALUES
  (v_incident2, v_admin_id, 'Se asignó electricista para revisión mañana.', 'in_progress', '2026-04-02T09:00:00Z');

-- ── Tickets ─────────────────────────────────────────────────
INSERT INTO tickets (id, room_id, created_by, assigned_to, type, title, description, status, priority, due_date, created_at) VALUES
  (v_ticket1, v_room_a102,  v_admin_id, v_cleaner1_id, 'cleaning',    'Limpieza profunda antes de ingreso',     'El cuarto 102 necesita limpieza profunda para nuevo inquilino que llega el 15 de abril.', 'open',        'high',   '2026-04-14', '2026-04-03T10:00:00Z'),
  (v_ticket2, v_room_dv_a3, v_admin_id, v_cleaner2_id, 'maintenance', 'Reparar puerta del closet',              'La puerta corrediza del closet se salió del riel.', 'assigned',    'medium', '2026-04-10', '2026-04-02T16:00:00Z'),
  (v_ticket3, v_room_co_2,  v_admin_id, v_cleaner1_id, 'cleaning',    'Limpieza semanal habitación 2',          'Limpieza estándar semanal.', 'in_progress', 'low',    '2026-04-05', '2026-04-01T08:00:00Z');

-- ── Cleaning Assignments ────────────────────────────────────
INSERT INTO cleaning_assignments (cleaner_id, room_id, scheduled_date, time_block, status) VALUES
  (v_cleaner1_id, v_room_a101,  '2026-04-05', 1, 'scheduled'),
  (v_cleaner1_id, v_room_a201,  '2026-04-05', 2, 'confirmed'),
  (v_cleaner2_id, v_room_dv_a1, '2026-04-05', 1, 'scheduled'),
  (v_cleaner2_id, v_room_co_1,  '2026-04-05', 3, 'scheduled'),
  (v_cleaner1_id, v_room_co_2,  '2026-04-05', 4, 'in_progress'),
  -- Yesterday's completed assignments
  (v_cleaner1_id, v_room_a101,  '2026-04-04', 1, 'completed'),
  (v_cleaner2_id, v_room_dv_a1, '2026-04-04', 2, 'completed'),
  (v_cleaner2_id, v_room_co_1,  '2026-04-04', 3, 'missed');

-- Cleaning sessions for completed assignments
INSERT INTO cleaning_sessions (assignment_id, arrived_at, completed_at, arrival_lat, arrival_lng)
SELECT id, '2026-04-04T08:05:00Z', '2026-04-04T09:45:00Z', 19.3800, -99.1590
FROM cleaning_assignments WHERE scheduled_date = '2026-04-04' AND cleaner_id = v_cleaner1_id AND status = 'completed';

INSERT INTO cleaning_sessions (assignment_id, arrived_at, completed_at, arrival_lat, arrival_lng)
SELECT id, '2026-04-04T10:10:00Z', '2026-04-04T11:50:00Z', 19.3910, -99.1680
FROM cleaning_assignments WHERE scheduled_date = '2026-04-04' AND cleaner_id = v_cleaner2_id AND status = 'completed';

-- ── Complaints ──────────────────────────────────────────────
INSERT INTO complaints (building_id, complainant_id, accused_id, room_id, category, description, is_anonymous, status, escalation_count) VALUES
  (v_building1_id, v_tenant1_id, v_tenant2_id, v_room_a201, 'noise', 'Música muy fuerte después de las 11pm de forma recurrente.', TRUE, 'open', 0),
  (v_building3_id, v_tenant4_id, NULL, v_room_co_2, 'cleanliness', 'Áreas comunes del pasillo siempre sucias.', FALSE, 'under_review', 1);

-- ── Guest Accesses ──────────────────────────────────────────
INSERT INTO guest_accesses (tenant_id, room_id, guest_name, purpose, valid_from, valid_until, is_approved) VALUES
  (v_tenant1_id, v_room_a101, 'Laura Pérez', 'Visita familiar fin de semana', '2026-04-05T10:00:00Z', '2026-04-06T18:00:00Z', TRUE),
  (v_tenant4_id, v_room_co_1, 'Uber Eats',   'Entrega de comida',            '2026-04-05T19:00:00Z', '2026-04-05T19:30:00Z', TRUE);

-- ── Notifications ───────────────────────────────────────────
INSERT INTO notifications (type, channel, title, body, metadata) VALUES
  ('payment_reminder', 'push', 'Recordatorio de pago', 'Tu pago de abril vence el día 5. Realiza tu pago para evitar bloqueo.', '{"lease_id": "' || v_lease2 || '"}'),
  ('incident_update',  'push', 'Actualización de incidente', 'Tu reporte de contacto eléctrico tiene una actualización.', '{"incident_id": "' || v_incident2 || '"}');

INSERT INTO notification_recipients (notification_id, user_id, status)
SELECT n.id, v_tenant2_id, 'sent'
FROM notifications n WHERE n.type = 'payment_reminder' LIMIT 1;

INSERT INTO notification_recipients (notification_id, user_id, status)
SELECT n.id, v_tenant3_id, 'delivered'
FROM notifications n WHERE n.type = 'incident_update' LIMIT 1;

RAISE NOTICE '✓ Seed data inserted successfully.';
RAISE NOTICE '';
RAISE NOTICE 'Demo users:';
RAISE NOTICE '  Admin:    admin@maya.com / SEED_PASS_REMOVED';
RAISE NOTICE '  Tenants:  Carlos López, María Hernández, Roberto García (locked), Ana Martínez';
RAISE NOTICE '  Cleaners: Lucía Ramírez, Pedro Sánchez';
RAISE NOTICE '  Security: Jorge Torres';
RAISE NOTICE '';
RAISE NOTICE 'Buildings: Álamos (4 rooms), Del Valle (3 rooms), Coyoacán (3 rooms)';
RAISE NOTICE 'Leases: 4 active | Payments: 2 paid, 1 pending, 1 overdue';
RAISE NOTICE 'Incidents: 3 (open + in_progress) | Tickets: 3 | Cleaning: 8 assignments';

END $$;
