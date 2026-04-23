-- ============================================================
-- Maya — seed-data.sql
-- Inserta datos demo: edificios, habitaciones, contratos,
-- pagos, incidentes, tickets, asignaciones de limpieza, etc.
--
-- ⚠️  Corre seed-users.mjs PRIMERO para crear los auth users.
--     Este script asume que los user_profiles ya existen
--     con los UUIDs fijos (ba…, bb…, bc…, admin).
--
-- Idempotente: limpia los datos demo antes de reinsertar.
-- Los usuarios NO se tocan — solo los datos de negocio.
-- ============================================================

DO $$
DECLARE
  -- UUIDs de usuarios (creados por seed-users.mjs, deben coincidir)
  v_admin_id    UUID := '72c1b269-c2aa-4bc2-817f-c5c6012638c0';
  v_tenant1_id  UUID := 'ba000001-0000-4000-8000-000000000001';
  v_tenant2_id  UUID := 'ba000002-0000-4000-8000-000000000002';
  v_tenant3_id  UUID := 'ba000003-0000-4000-8000-000000000003';
  v_tenant4_id  UUID := 'ba000004-0000-4000-8000-000000000004';
  v_cleaner1_id UUID := 'bb000001-0000-4000-8000-000000000001';
  v_cleaner2_id UUID := 'bb000002-0000-4000-8000-000000000002';

  -- UUIDs fijos para entidades de negocio
  v_building1_id UUID := 'bd000001-0000-4000-8000-000000000001';
  v_building2_id UUID := 'bd000002-0000-4000-8000-000000000002';
  v_building3_id UUID := 'bd000003-0000-4000-8000-000000000003';

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

  v_lease1 UUID := 'bf000001-0000-4000-8000-000000000001';
  v_lease2 UUID := 'bf000002-0000-4000-8000-000000000002';
  v_lease3 UUID := 'bf000003-0000-4000-8000-000000000003';
  v_lease4 UUID := 'bf000004-0000-4000-8000-000000000004';

  v_incident1 UUID := 'c0000001-0000-4000-8000-000000000001';
  v_incident2 UUID := 'c0000002-0000-4000-8000-000000000002';
  v_incident3 UUID := 'c0000003-0000-4000-8000-000000000003';

  v_ticket1 UUID := 'c1000001-0000-4000-8000-000000000001';
  v_ticket2 UUID := 'c1000002-0000-4000-8000-000000000002';
  v_ticket3 UUID := 'c1000003-0000-4000-8000-000000000003';

BEGIN

-- ── Limpieza de datos de negocio (no toca auth ni user_profiles) ─────────────
DELETE FROM ticket_items;
DELETE FROM tickets;
DELETE FROM incident_updates;
DO $inner$ BEGIN
  DELETE FROM incident_photos;
EXCEPTION WHEN undefined_table THEN NULL;
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


-- ── Buildings ─────────────────────────────────────────────────────────────────
INSERT INTO buildings (id, name, address, city) VALUES
  (v_building1_id, 'Edificio Álamos',    'Calle Álamos 45, Col. Narvarte',      'Ciudad de México'),
  (v_building2_id, 'Edificio Del Valle', 'Av. Insurgentes 120, Col. Del Valle', 'Ciudad de México'),
  (v_building3_id, 'Edificio Coyoacán',  'Calle Malintzin 8, Col. Del Carmen',  'Ciudad de México');


-- ── Rooms ─────────────────────────────────────────────────────────────────────
INSERT INTO rooms (id, building_id, room_number, section, status, monthly_rate) VALUES
  (v_room_a101,  v_building1_id, '101', 'Planta Baja', 'occupied',    5500.00),
  (v_room_a102,  v_building1_id, '102', 'Planta Baja', 'vacant',      5500.00),
  (v_room_a201,  v_building1_id, '201', 'Piso 2',      'occupied',    6000.00),
  (v_room_a202,  v_building1_id, '202', 'Piso 2',      'incoming',    6000.00),
  (v_room_dv_a1, v_building2_id, 'A1',  NULL,          'occupied',    6500.00),
  (v_room_dv_a2, v_building2_id, 'A2',  NULL,          'vacant',      6500.00),
  (v_room_dv_a3, v_building2_id, 'A3',  NULL,          'maintenance', 6500.00),
  (v_room_co_1,  v_building3_id, '1',  'Casa Principal', 'occupied',  7000.00),
  (v_room_co_2,  v_building3_id, '2',  'Casa Principal', 'occupied',  7000.00),
  (v_room_co_3,  v_building3_id, '3',  'Estudio',        'vacant',    5800.00);


-- ── Leases ────────────────────────────────────────────────────────────────────
INSERT INTO leases (id, room_id, tenant_id, start_date, end_date, monthly_rate,
                    payment_day, deposit_amount, deposit_paid, status, access_code_encrypted) VALUES
  (v_lease1, v_room_a101,  v_tenant1_id,
   CURRENT_DATE - INTERVAL '4 months',  CURRENT_DATE + INTERVAL '8 months',
   5500.00, 1,  5500.00, TRUE,  'active', 'DEMO1234'),
  (v_lease2, v_room_a201,  v_tenant2_id,
   CURRENT_DATE - INTERVAL '3 months',  CURRENT_DATE + INTERVAL '9 months',
   6000.00, 5,  6000.00, TRUE,  'active', 'DEMO5678'),
  (v_lease3, v_room_dv_a1, v_tenant3_id,
   CURRENT_DATE - INTERVAL '11 months', CURRENT_DATE + INTERVAL '1 month',
   6500.00, 10, 6500.00, TRUE,  'active', 'DEMO9012'),
  (v_lease4, v_room_co_1,  v_tenant4_id,
   CURRENT_DATE - INTERVAL '2 months',  NULL,
   7000.00, 1,  7000.00, FALSE, 'active', 'DEMO3456');


-- ── Payments ──────────────────────────────────────────────────────────────────
INSERT INTO payments (lease_id, amount, due_date, status) VALUES
  (v_lease1, 5500.00, DATE_TRUNC('month', CURRENT_DATE),                         'paid'),
  (v_lease2, 6000.00, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '4 days',     'pending'),
  (v_lease3, 6500.00, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '9 days',     'overdue'),
  (v_lease4, 7000.00, DATE_TRUNC('month', CURRENT_DATE),                         'paid');

INSERT INTO payments (lease_id, amount, due_date, paid_at, status) VALUES
  (v_lease1, 5500.00,
   DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month',
   DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '2 hours', 'paid'),
  (v_lease2, 6000.00,
   DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '4 days',
   DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '5 days' + INTERVAL '14 hours', 'paid'),
  (v_lease3, 6500.00,
   DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '9 days',
   NULL, 'overdue'),
  (v_lease4, 7000.00,
   DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month',
   DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' + INTERVAL '1 day' + INTERVAL '9 hours', 'paid');


-- ── Incidents ─────────────────────────────────────────────────────────────────
INSERT INTO incidents (id, room_id, reported_by, assigned_to, title, description,
                       category, priority, status, created_at) VALUES
  (v_incident1, v_room_a101, v_tenant1_id, NULL,
   'Fuga en el baño',
   'Hay una fuga de agua debajo del lavabo que está mojando el piso.',
   'plumbing', 'high', 'open', NOW() - INTERVAL '20 days'),
  (v_incident2, v_room_dv_a1, v_tenant3_id, v_admin_id,
   'Contacto eléctrico dañado',
   'El contacto de la pared norte no funciona, hace chispas al conectar algo.',
   'electrical', 'urgent', 'in_progress', NOW() - INTERVAL '22 days'),
  (v_incident3, v_room_co_1, v_tenant4_id, NULL,
   'Refrigerador no enfría',
   'El refrigerador de la cocina dejó de enfriar desde ayer.',
   'appliance', 'medium', 'open', NOW() - INTERVAL '19 days');

INSERT INTO incident_updates (incident_id, author_id, note, status_changed_to, created_at) VALUES
  (v_incident2, v_admin_id,
   'Se asignó electricista para revisión mañana.', 'in_progress',
   NOW() - INTERVAL '21 days');


-- ── Tickets ───────────────────────────────────────────────────────────────────
INSERT INTO tickets (id, room_id, created_by, assigned_to, type, title, description,
                     status, priority, due_date, created_at) VALUES
  (v_ticket1, v_room_a102, v_admin_id, v_cleaner1_id, 'cleaning',
   'Limpieza profunda antes de ingreso',
   'El cuarto 102 necesita limpieza profunda para nuevo inquilino.',
   'open', 'high', CURRENT_DATE + INTERVAL '7 days', NOW() - INTERVAL '20 days'),
  (v_ticket2, v_room_dv_a3, v_admin_id, v_cleaner2_id, 'maintenance',
   'Reparar puerta del closet',
   'La puerta corrediza del closet se salió del riel.',
   'assigned', 'medium', CURRENT_DATE + INTERVAL '3 days', NOW() - INTERVAL '21 days'),
  (v_ticket3, v_room_co_2, v_admin_id, v_cleaner1_id, 'cleaning',
   'Limpieza semanal habitación 2',
   'Limpieza estándar semanal.',
   'in_progress', 'low', CURRENT_DATE + INTERVAL '1 day', NOW() - INTERVAL '22 days');


-- ── Cleaning Assignments ──────────────────────────────────────────────────────
-- HOY: 5 asignaciones con diferentes estados para que la app muestre variedad
INSERT INTO cleaning_assignments (cleaner_id, room_id, scheduled_date, time_block, status) VALUES
  (v_cleaner1_id, v_room_a101,  CURRENT_DATE, 1, 'confirmed'),
  (v_cleaner1_id, v_room_a201,  CURRENT_DATE, 2, 'scheduled'),
  (v_cleaner1_id, v_room_co_2,  CURRENT_DATE, 3, 'in_progress'),
  (v_cleaner2_id, v_room_dv_a1, CURRENT_DATE, 1, 'scheduled'),
  (v_cleaner2_id, v_room_co_1,  CURRENT_DATE, 2, 'scheduled');

-- AYER: historial completado + una perdida
INSERT INTO cleaning_assignments (cleaner_id, room_id, scheduled_date, time_block, status) VALUES
  (v_cleaner1_id, v_room_a101,  CURRENT_DATE - 1, 1, 'completed'),
  (v_cleaner2_id, v_room_dv_a1, CURRENT_DATE - 1, 2, 'completed'),
  (v_cleaner2_id, v_room_co_1,  CURRENT_DATE - 1, 3, 'missed');

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
INSERT INTO complaints (building_id, complainant_id, accused_id, room_id,
                        category, description, is_anonymous, status, escalation_count) VALUES
  (v_building1_id, v_tenant1_id, v_tenant2_id, v_room_a201,
   'noise', 'Música muy fuerte después de las 11pm de forma recurrente.',
   TRUE, 'open', 0),
  (v_building3_id, v_tenant4_id, NULL, v_room_co_2,
   'cleanliness', 'Áreas comunes del pasillo siempre sucias.',
   FALSE, 'under_review', 1);


-- ── Guest Accesses ────────────────────────────────────────────────────────────
INSERT INTO guest_accesses (tenant_id, room_id, guest_name, purpose,
                            valid_from, valid_until, is_approved) VALUES
  (v_tenant1_id, v_room_a101, 'Laura Pérez', 'Visita familiar fin de semana',
   NOW(), NOW() + INTERVAL '2 days', TRUE),
  (v_tenant4_id, v_room_co_1, 'Uber Eats', 'Entrega de comida',
   NOW(), NOW() + INTERVAL '30 minutes', TRUE);


-- ── Notifications ─────────────────────────────────────────────────────────────
INSERT INTO notifications (type, channel, title, body, metadata) VALUES
  ('payment_reminder', 'push',
   'Recordatorio de pago', 'Tu pago vence en 3 días. Realízalo para evitar bloqueo.',
   jsonb_build_object('lease_id', v_lease2::text)),
  ('incident_update', 'push',
   'Actualización de incidente', 'Tu reporte de contacto eléctrico tiene una actualización.',
   jsonb_build_object('incident_id', v_incident2::text));

INSERT INTO notification_recipients (notification_id, user_id, status)
SELECT n.id, v_tenant2_id, 'sent'
FROM notifications n WHERE n.type = 'payment_reminder' LIMIT 1;

INSERT INTO notification_recipients (notification_id, user_id, status)
SELECT n.id, v_tenant3_id, 'delivered'
FROM notifications n WHERE n.type = 'incident_update' LIMIT 1;


RAISE NOTICE '✅ seed-data.sql completado.';
RAISE NOTICE '   3 edificios | 10 habitaciones | 4 contratos | 4 inquilinos';
RAISE NOTICE '   5 asignaciones HOY + historial ayer';

END $$;
