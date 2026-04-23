-- ============================================================
-- fix-broken-auth-users.sql  (v3)
--
-- Los 7 usuarios demo quedaron en estado roto en auth.users.
-- GoTrue Admin API no puede tocarlos (devuelve 500 en todo).
-- La única solución es borrarlos directamente vía SQL.
--
-- El problema en cascada:
--   auth.users → (trigger) → user_profiles → leases (FK)
-- Por eso hay que limpiar los datos de negocio primero,
-- luego los usuarios, y luego correr seed-data.sql de nuevo.
--
-- PASOS COMPLETOS:
--   1. Corre este script en SQL Editor  → "Done. Run seed-users.mjs"
--   2. node supabase/seed-users.mjs     → 8 usuarios ✅
--   3. Corre seed-data.sql en SQL Editor → datos de negocio restaurados
-- ============================================================

DO $$
DECLARE
  v_ids TEXT[] := ARRAY[
    'ba000001-0000-4000-8000-000000000001',
    'ba000002-0000-4000-8000-000000000002',
    'ba000003-0000-4000-8000-000000000003',
    'ba000004-0000-4000-8000-000000000004',
    'bb000001-0000-4000-8000-000000000001',
    'bb000002-0000-4000-8000-000000000002',
    'bc000001-0000-4000-8000-000000000001'
  ];
  deleted_auth INT;
BEGIN

  -- ── PASO 1: limpiar datos de negocio que referencian a estos usuarios ────────
  -- Orden leaf → root para respetar FKs

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

  -- ── PASO 2: limpiar tablas internas de auth para estos 7 UUIDs ──────────────

  DELETE FROM auth.audit_log_entries
    WHERE payload->>'user_id' = ANY(v_ids);

  DELETE FROM auth.refresh_tokens
    WHERE user_id = ANY(v_ids);          -- varchar

  DELETE FROM auth.sessions
    WHERE user_id::text = ANY(v_ids);    -- uuid → text

  DELETE FROM auth.mfa_factors
    WHERE user_id::text = ANY(v_ids);

  DELETE FROM auth.identities
    WHERE user_id::text = ANY(v_ids);

  -- ── PASO 3: borrar user_profiles (ya sin referencias de negocio) ─────────────
  DELETE FROM public.user_profiles
    WHERE id::text = ANY(v_ids);

  -- ── PASO 4: borrar los usuarios rotos de auth ────────────────────────────────
  DELETE FROM auth.users
    WHERE id::text = ANY(v_ids);
  GET DIAGNOSTICS deleted_auth = ROW_COUNT;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Done. % auth users deleted.', deleted_auth;
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos pasos:';
  RAISE NOTICE '  1. node supabase/seed-users.mjs        (recrea los 7 usuarios + user_profiles)';
  RAISE NOTICE '  2. seed-data.sql en SQL Editor          (restaura edificios, contratos, tickets…)';

END $$;
