-- ============================================================
-- Maya — Development Seed Data
-- Run AFTER 001_initial_schema.sql (and 002, 003, 004 if present)
--
-- Este script es idempotente: limpia los datos demo existentes antes
-- de reinsertar para que siempre quede en un estado conocido.
--
-- ✅ CREDENCIALES DEMO (todas usan la misma contraseña):
--
--   Admin:    admin@maya.com          / Maya2024!
--   Tenants:  carlos@demo.maya.app   / Maya2024!
--             maria@demo.maya.app    / Maya2024!
--             roberto@demo.maya.app  / Maya2024!  (cuenta bloqueada — demo de morosidad)
--             ana@demo.maya.app      / Maya2024!
--   Cleaning: lucia@demo.maya.app    / Maya2024!
--             pedro@demo.maya.app    / Maya2024!
--   Security: jorge@demo.maya.app    / Maya2024!
--
-- ⚠️  NO uses estas cuentas en producción.
-- ============================================================

DO $$
DECLARE
  -- UUIDs deterministas para que el seed sea reproducible.
  -- El admin tiene su propio UUID fijo desde el inicio del proyecto.
  v_admin_id    UUID := '72c1b269-c2aa-4bc2-817f-c5c6012638c0';

  -- Tenants — UUIDs fijos para que las contraseñas sean siempre conocidas
  v_tenant1_id  UUID := 'ba000001-0000-4000-8000-000000000001';  -- carlos
  v_tenant2_id  UUID := 'ba000002-0000-4000-8000-000000000002';  -- maria
  v_tenant3_id  UUID := 'ba000003-0000-4000-8000-000000000003';  -- roberto (locked)
  v_tenant4_id  UUID := 'ba000004-0000-4000-8000-000000000004';  -- ana

  -- Cleaning staff
  v_cleaner1_id UUID := 'bb000001-0000-4000-8000-000000000001';  -- lucia
  v_cleaner2_id UUID := 'bb000002-0000-4000-8000-000000000002';  -- pedro

  -- Security
  v_security1_id UUID := 'bc000001-0000-4000-8000-000000000001'; -- jorge

  -- Buildings
  v_building1_id UUID := 'bd000001-0000-4000-8000-000000000001';
  v_building2_id UUID := 'bd000002-0000-4000-8000-000000000002';
  v_building3_id UUID := 'bd000003-0000-4000-8000-000000000003';

  -- Rooms
  v_room_a101  UUID := 'be000001-0000-4000-8000-000000000001';
  v_room_a102  UUID := 'be000002-0000-4000-8000-000000000002';
  v_room_a201  UUID := 'be000003-0000-4000-8000-000000000003';
  v_room_a202  UUID := 'be000004-0000-4000-8000-000000000004';
  v_room_dv_a1 UUID := 'be000005-0000-4000-8000-000000000005';
  v_room_dv_a2 UUID := 'be000006-0000-4000-8000-000000000006';
  v_room_dv_a3 UUID := 'be000007-0000-4000-8000-000000000007';
  v_room_co_1  UUID := 'be000008-0000-4000-8000-000000000008';
  v_room_co_2  UUID := 'be000009-0000-4000-8000-000000000009';
  v_room_co_3  UUID := 'be000010-0000-4000-8000-000000000010';

  -- Leases
  v_lease1 UUID := 'bf000001-0000-4000-8000-000000000001';
  v_lease2 UUID := 'bf000002-0000-4000-8000-000000000002';
  v_lease3 UUID := 'bf000003-0000-4000-8000-000000000003';
  v_lease4 UUID := 'bf000004-0000-4000-8000-000000000004';

  -- Incidents
  v_incident1 UUID := 'c0000001-0000-4000-8000-000000000001';
  v_incident2 UUID := 'c0000002-0000-4000-8000-000000000002';
  v_incident3 UUID := 'c0000003-0000-4000-8000-000000000003';

  -- Tickets
  v_ticket1 UUID := 'c1000001-0000-4000-8000-000000000001';
  v_ticket2 UUID := 'c1000002-0000-4000-8000-000000000002';
  v_ticket3 UUID := 'c1000003-0000-4000-8000-000000000003';

BEGIN

-- ── Limpieza robusta de datos demo ───────────────────────────────────────────
-- Borra TODO excepto el admin (id fijo 72c1b269-…).
-- Orden hoja → raíz para respetar FKs sin importar qué UUIDs haya de corridas anteriores.
-- En una DB de desarrollo esto es seguro: el seed re-inserta todo de cero.

DELETE FROM ticket_items;
DELETE FROM tickets;
DELETE FROM incident_updates;
DO $inner$ BEGIN
  DELETE FROM incident_photos;
EXCEPTION WHEN undefined_table THEN NULL;  -- tabla opcional, ignorar si no existe
END $inner$;
DELETE FROM incidents;
DELETE FROM cleaning_sessions;
DELETE FROM cleaning_assignments;
DELETE FROM notification_recipients;
DELETE FROM notifications;
DELETE FROM guest_accesses;
DELETE FROM complaints;
DELETE FROM payments;
DELETE FROM leases;
DELETE FROM rooms;
DELETE FROM buildings;

-- Borrar perfiles y auth de usuarios demo (el admin se omite por UUID/email)
DELETE FROM user_profiles
  WHERE id != '72c1b269-c2aa-4bc2-817f-c5c6012638c0';
DELETE FROM auth.identities
  WHERE provider_id != 'admin@maya.com';
DELETE FROM auth.users
  WHERE email != 'admin@maya.com';


-- ── Auth Users ───────────────────────────────────────────────────────────────
-- Contraseña única para todas las cuentas demo: Maya2024!
--
-- raw_app_meta_data es OBLIGATORIO para que Supabase Auth funcione:
-- sin él el endpoint /auth/v1/token devuelve 500 aunque la contraseña sea correcta.
-- raw_user_meta_data también se requiere (puede ser objeto vacío).

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin
)
VALUES
  (v_admin_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@maya.com',        crypt('Maya2024!', gen_salt('bf')), NOW(), NOW(), NOW(), '', '',
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),

  (v_tenant1_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'carlos@demo.maya.app',  crypt('Maya2024!', gen_salt('bf')), NOW(), NOW(), NOW(), '', '',
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),

  (v_tenant2_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'maria@demo.maya.app',   crypt('Maya2024!', gen_salt('bf')), NOW(), NOW(), NOW(), '', '',
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),

  (v_tenant3_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'roberto@demo.maya.app', crypt('Maya2024!', gen_salt('bf')), NOW(), NOW(), NOW(), '', '',
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),

  (v_tenant4_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ana@demo.maya.app',     crypt('Maya2024!', gen_salt('bf')), NOW(), NOW(), NOW(), '', '',
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),

  (v_cleaner1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'lucia@demo.maya.app',   crypt('Maya2024!', gen_salt('bf')), NOW(), NOW(), NOW(), '', '',
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),

  (v_cleaner2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pedro@demo.maya.app',   crypt('Maya2024!', gen_salt('bf')), NOW(), NOW(), NOW(), '', '',
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),

  (v_security1_id,'00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'jorge@demo.maya.app',   crypt('Maya2024!', gen_salt('bf')), NOW(), NOW(), NOW(), '', '',
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false)

ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('Maya2024!', gen_salt('bf')),
  raw_app_meta_data  = '{"provider":"email","providers":["email"]}'::jsonb,
  raw_user_meta_data = '{}'::jsonb,
  updated_at         = NOW();

-- auth.identities — necesario para el flujo email/password.
-- id usa gen_random_uuid() (distinto del user_id) como requieren las versiones nuevas de Supabase.
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
VALUES
  (gen_random_uuid(), v_admin_id,    'admin@maya.com',
   jsonb_build_object('sub', v_admin_id::text,    'email', 'admin@maya.com'),        'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), v_tenant1_id,  'carlos@demo.maya.app',
   jsonb_build_object('sub', v_tenant1_id::text,  'email', 'carlos@demo.maya.app'),  'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), v_tenant2_id,  'maria@demo.maya.app',
   jsonb_build_object('sub', v_tenant2_id::text,  'email', 'maria@demo.maya.app'),   'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), v_tenant3_id,  'roberto@demo.maya.app',
   jsonb_build_object('sub', v_tenant3_id::text,  'email', 'roberto@demo.maya.app'), 'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), v_tenant4_id,  'ana@demo.maya.app',
   jsonb_build_object('sub', v_tenant4_id::text,  'email', 'ana@demo.maya.app'),     'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), v_cleaner1_id, 'lucia@demo.maya.app',
   jsonb_build_object('sub', v_cleaner1_id::text, 'email', 'lucia@demo.maya.app'),   'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), v_cleaner2_id, 'pedro@demo.maya.app',
   jsonb_build_object('sub', v_cleaner2_id::text, 'email', 'pedro@demo.maya.app'),   'email', NOW(), NOW(), NOW()),
  (gen_random_uuid(), v_security1_id,'jorge@demo.maya.app',
   jsonb_build_object('sub', v_security1_id::text,'email', 'jorge@demo.maya.app'),   'email', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;


-- ── User Profiles ─────────────────────────────────────────────────────────────
INSERT INTO user_profiles (id, role, first_name, last_name, phone, rfc, is_active, is_locked) VALUES
  (v_admin_id,    'admin',    'Admin',   'Maya',      '+5215512345678', NULL,            TRUE, FALSE),
  (v_tenant1_id,  'tenant',   'Carlos',  'López',     '+5215598765432', 'LOPC950215XYZ', TRUE, FALSE),
  (v_tenant2_id,  'tenant',   'María',   'Hernández', '+5215587654321', 'HERM880401ABC', TRUE, FALSE),
  (v_tenant3_id,  'tenant',   'Roberto', 'García',    '+5215576543210', 'GARR900615DEF', TRUE, TRUE),
  (v_tenant4_id,  'tenant',   'Ana',     'Martínez',  '+5215565432109', 'MARA920830GHI', TRUE, FALSE),
  (v_cleaner1_id, 'cleaning', 'Lucía',   'Ramírez',   '+5215554321098', NULL,            TRUE, FALSE),
  (v_cleaner2_id, 'cleaning', 'Pedro',   'Sánchez',   '+5215543210987', NULL,            TRUE, FALSE),
  (v_security1_id,'security', 'Jorge',   'Torres',    '+5215532109876', NULL,            TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;


-- ── Buildings ─────────────────────────────────────────────────────────────────
INSERT INTO buildings (id, name, address, city) VALUES
  (v_building1_id, 'Edificio Álamos',    'Calle Álamos 45, Col. Narvarte',      'Ciudad de México'),
  (v_building2_id, 'Edificio Del Valle', 'Av. Insurgentes 120, Col. Del Valle', 'Ciudad de México'),
  (v_building3_id, 'Edificio Coyoacán',  'Calle Malintzin 8, Col. Del Carmen',  'Ciudad de México');


-- ── Rooms ─────────────────────────────────────────────────────────────────────
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


-- ── Leases ────────────────────────────────────────────────────────────────────
INSERT INTO leases (id, room_id, tenant_id, start_date, end_date, monthly_rate, payment_day, deposit_amount, deposit_paid, status, access_code_encrypted) VALUES
  (v_lease1, v_room_a101,  v_tenant1_id, CURRENT_DATE - INTERVAL '4 months', CURRENT_DATE + INTERVAL '8 months', 5500.00, 1,  5500.00, TRUE,  'active', 'DEMO1234'),
  (v_lease2, v_room_a201,  v_tenant2_id, CURRENT_DATE - INTERVAL '3 months', CURRENT_DATE + INTERVAL '9 months', 6000.00, 5,  6000.00, TRUE,  'active', 'DEMO5678'),
  (v_lease3, v_room_dv_a1, v_tenant3_id, CURRENT_DATE - INTERVAL '11 months', CURRENT_DATE + INTERVAL '1 month', 6500.00, 10, 6500.00, TRUE,  'active', 'DEMO9012'),
  (v_lease4, v_room_co_1,  v_tenant4_id, CURRENT_DATE - INTERVAL '2 months', NULL,                               7000.00, 1,  7000.00, FALSE, 'active', 'DEMO3456');


-- ── Payments ──────────────────────────────────────────────────────────────────
-- Pago del mes actual para cada contrato
INSERT INTO payments (lease_id, amount, due_date, status) VALUES
  (v_lease1, 5500.00, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '0 days',  'paid'),
  (v_lease2, 6000.00, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '4 days',  'pending'),
  (v_lease3, 6500.00, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '9 days',  'overdue'),
  (v_lease4, 7000.00, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '0 days',  'paid');

-- Pagos del mes anterior
INSERT INTO payments (lease_id, amount, due_date, paid_at, status) VALUES
  (v_lease1, 5500.00, DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month',
   DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '2 hours', 'paid'),
  (v_lease2, 6000.00, DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '4 days',
   DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '5 days' + INTERVAL '14 hours', 'paid'),
  (v_lease3, 6500.00, DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '9 days',
   NULL, 'overdue'),
  (v_lease4, 7000.00, DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month',
   DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '1 day' + INTERVAL '9 hours', 'paid');


-- ── Incidents ─────────────────────────────────────────────────────────────────
INSERT INTO incidents (id, room_id, reported_by, assigned_to, title, description, category, priority, status, created_at) VALUES
  (v_incident1, v_room_a101,  v_tenant1_id, NULL,       'Fuga en el baño',
   'Hay una fuga de agua debajo del lavabo que está mojando el piso.',
   'plumbing', 'high', 'open', NOW() - INTERVAL '20 days'),
  (v_incident2, v_room_dv_a1, v_tenant3_id, v_admin_id, 'Contacto eléctrico dañado',
   'El contacto de la pared norte no funciona, hace chispas al conectar algo.',
   'electrical', 'urgent', 'in_progress', NOW() - INTERVAL '22 days'),
  (v_incident3, v_room_co_1,  v_tenant4_id, NULL,       'Refrigerador no enfría',
   'El refrigerador de la cocina dejó de enfriar desde ayer.',
   'appliance', 'medium', 'open', NOW() - INTERVAL '19 days');

INSERT INTO incident_updates (incident_id, author_id, note, status_changed_to, created_at) VALUES
  (v_incident2, v_admin_id, 'Se asignó electricista para revisión mañana.',
   'in_progress', NOW() - INTERVAL '21 days');


-- ── Tickets ───────────────────────────────────────────────────────────────────
INSERT INTO tickets (id, room_id, created_by, assigned_to, type, title, description, status, priority, due_date, created_at) VALUES
  (v_ticket1, v_room_a102,  v_admin_id, v_cleaner1_id, 'cleaning',
   'Limpieza profunda antes de ingreso',
   'El cuarto 102 necesita limpieza profunda para nuevo inquilino.',
   'open', 'high', CURRENT_DATE + INTERVAL '7 days', NOW() - INTERVAL '20 days'),
  (v_ticket2, v_room_dv_a3, v_admin_id, v_cleaner2_id, 'maintenance',
   'Reparar puerta del closet',
   'La puerta corrediza del closet se salió del riel.',
   'assigned', 'medium', CURRENT_DATE + INTERVAL '3 days', NOW() - INTERVAL '21 days'),
  (v_ticket3, v_room_co_2,  v_admin_id, v_cleaner1_id, 'cleaning',
   'Limpieza semanal habitación 2',
   'Limpieza estándar semanal.',
   'in_progress', 'low', CURRENT_DATE + INTERVAL '1 day', NOW() - INTERVAL '22 days');


-- ── Cleaning Assignments ──────────────────────────────────────────────────────
-- Asignaciones para HOY (CURRENT_DATE) — así la app de limpieza muestra tareas.
-- Se usan diferentes bloques horarios para que haya variedad en los stats.
INSERT INTO cleaning_assignments (cleaner_id, room_id, scheduled_date, time_block, status) VALUES
  (v_cleaner1_id, v_room_a101,  CURRENT_DATE, 1, 'confirmed'),
  (v_cleaner1_id, v_room_a201,  CURRENT_DATE, 2, 'scheduled'),
  (v_cleaner1_id, v_room_co_2,  CURRENT_DATE, 3, 'in_progress'),
  (v_cleaner2_id, v_room_dv_a1, CURRENT_DATE, 1, 'scheduled'),
  (v_cleaner2_id, v_room_co_1,  CURRENT_DATE, 2, 'scheduled');

-- Asignaciones de ayer con resultados para tener historial
INSERT INTO cleaning_assignments (cleaner_id, room_id, scheduled_date, time_block, status) VALUES
  (v_cleaner1_id, v_room_a101,  CURRENT_DATE - 1, 1, 'completed'),
  (v_cleaner2_id, v_room_dv_a1, CURRENT_DATE - 1, 2, 'completed'),
  (v_cleaner2_id, v_room_co_1,  CURRENT_DATE - 1, 3, 'missed');

-- Sesiones para las asignaciones completadas de ayer
INSERT INTO cleaning_sessions (assignment_id, arrived_at, completed_at, arrival_lat, arrival_lng)
SELECT id,
  (CURRENT_DATE - 1 + TIME '08:05:00')::timestamptz,
  (CURRENT_DATE - 1 + TIME '09:45:00')::timestamptz,
  19.3800, -99.1590
FROM cleaning_assignments
WHERE scheduled_date = CURRENT_DATE - 1 AND cleaner_id = v_cleaner1_id AND status = 'completed';

INSERT INTO cleaning_sessions (assignment_id, arrived_at, completed_at, arrival_lat, arrival_lng)
SELECT id,
  (CURRENT_DATE - 1 + TIME '10:10:00')::timestamptz,
  (CURRENT_DATE - 1 + TIME '11:50:00')::timestamptz,
  19.3910, -99.1680
FROM cleaning_assignments
WHERE scheduled_date = CURRENT_DATE - 1 AND cleaner_id = v_cleaner2_id AND status = 'completed';


-- ── Complaints ────────────────────────────────────────────────────────────────
INSERT INTO complaints (building_id, complainant_id, accused_id, room_id, category, description, is_anonymous, status, escalation_count) VALUES
  (v_building1_id, v_tenant1_id, v_tenant2_id, v_room_a201,
   'noise', 'Música muy fuerte después de las 11pm de forma recurrente.', TRUE, 'open', 0),
  (v_building3_id, v_tenant4_id, NULL, v_room_co_2,
   'cleanliness', 'Áreas comunes del pasillo siempre sucias.', FALSE, 'under_review', 1);


-- ── Guest Accesses ────────────────────────────────────────────────────────────
INSERT INTO guest_accesses (tenant_id, room_id, guest_name, purpose, valid_from, valid_until, is_approved) VALUES
  (v_tenant1_id, v_room_a101, 'Laura Pérez', 'Visita familiar fin de semana',
   NOW(), NOW() + INTERVAL '2 days', TRUE),
  (v_tenant4_id, v_room_co_1, 'Uber Eats', 'Entrega de comida',
   NOW(), NOW() + INTERVAL '30 minutes', TRUE);


-- ── Notifications ──────────────────────────────────────────────────────────────
INSERT INTO notifications (type, channel, title, body, metadata) VALUES
  ('payment_reminder', 'push',
   'Recordatorio de pago',
   'Tu pago vence en 3 días. Realízalo para evitar bloqueo.',
   jsonb_build_object('lease_id', v_lease2::text)),
  ('incident_update', 'push',
   'Actualización de incidente',
   'Tu reporte de contacto eléctrico tiene una actualización.',
   jsonb_build_object('incident_id', v_incident2::text));

INSERT INTO notification_recipients (notification_id, user_id, status)
SELECT n.id, v_tenant2_id, 'sent'
FROM notifications n WHERE n.type = 'payment_reminder' LIMIT 1;

INSERT INTO notification_recipients (notification_id, user_id, status)
SELECT n.id, v_tenant3_id, 'delivered'
FROM notifications n WHERE n.type = 'incident_update' LIMIT 1;


RAISE NOTICE '✓ Seed data insertado correctamente.';
RAISE NOTICE '';
RAISE NOTICE '══════════════════════════════════════════';
RAISE NOTICE 'CREDENCIALES DEMO — contraseña: Maya2024!';
RAISE NOTICE '──────────────────────────────────────────';
RAISE NOTICE '  Admin:    admin@maya.com';
RAISE NOTICE '  Tenants:  carlos@demo.maya.app';
RAISE NOTICE '            maria@demo.maya.app';
RAISE NOTICE '            roberto@demo.maya.app  (cuenta bloqueada)';
RAISE NOTICE '            ana@demo.maya.app';
RAISE NOTICE '  Cleaning: lucia@demo.maya.app';
RAISE NOTICE '            pedro@demo.maya.app';
RAISE NOTICE '  Security: jorge@demo.maya.app';
RAISE NOTICE '══════════════════════════════════════════';
RAISE NOTICE 'Edificios: Álamos (4), Del Valle (3), Coyoacán (3)';
RAISE NOTICE 'Asignaciones de limpieza: 5 para HOY + historial de ayer';

END $$;
