-- ============================================================
-- fix-broken-auth-users.sql
--
-- Los 7 usuarios demo (ba…, bb…, bc…) quedaron en estado roto
-- en auth.users después de intentos de seed fallidos.
-- GoTrue no puede leerlos ni borrarlos vía Admin API (devuelve 500).
--
-- CÓMO USAR:
--   1. Supabase Dashboard → SQL Editor
--   2. Pega este script completo y ejecuta
--   3. Deberías ver "7 broken auth users deleted"
--   4. Después corre: node supabase/seed-users.mjs
--
-- SEGURO: no toca al admin (72c1b269-...) ni los datos de negocio.
-- Solo borra entradas rotas de auth.* para los 7 UUIDs demo.
-- ============================================================

-- Usamos texto plano en todas las comparaciones para evitar errores
-- de tipo entre columnas uuid y varchar según la versión de GoTrue.

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
  deleted_count INT;
BEGIN
  -- 1. Limpiar tablas dependientes (leaf → root)
  --    Todas las comparaciones en ::text para compatibilidad con varchar y uuid

  -- audit_log_entries guarda user_id como campo JSON
  DELETE FROM auth.audit_log_entries
    WHERE payload->>'user_id' = ANY(v_ids);

  -- refresh_tokens.user_id es varchar en Supabase hosted
  DELETE FROM auth.refresh_tokens
    WHERE user_id = ANY(v_ids);

  -- sessions.user_id es uuid → casteamos el array
  DELETE FROM auth.sessions
    WHERE user_id::text = ANY(v_ids);

  -- mfa_factors.user_id es uuid → casteamos
  DELETE FROM auth.mfa_factors
    WHERE user_id::text = ANY(v_ids);

  -- identities.user_id es uuid → casteamos
  DELETE FROM auth.identities
    WHERE user_id::text = ANY(v_ids);

  -- 2. Borrar los usuarios rotos de la tabla principal
  DELETE FROM auth.users
    WHERE id::text = ANY(v_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- 3. Limpiar user_profiles para que seed-users.mjs los recree limpios
  DELETE FROM public.user_profiles
    WHERE id::text = ANY(v_ids);

  RAISE NOTICE '✅ % broken auth users deleted. Now run: node supabase/seed-users.mjs', deleted_count;
END $$;
