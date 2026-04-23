/**
 * supabase/seed-users.mjs
 *
 * Crea las cuentas demo de Maya vía Supabase Admin API.
 * Usar el Admin API (no inserts SQL directos) garantiza que GoTrue
 * configure todos los campos internos correctamente y el login funcione.
 *
 * Los UUIDs son fijos y coinciden con los que usa seed.sql para leases,
 * incidents, tickets, etc. — así todo el dataset queda coherente.
 *
 * Uso (desde la raíz del proyecto):
 *   node supabase/seed-users.mjs
 */

const SUPABASE_URL    = "https://ddqhsfsmwgfanjlagefh.supabase.co";
const SERVICE_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcWhzZnNtd2dmYW5qbGFnZWZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM5ODM4MiwiZXhwIjoyMDkwOTc0MzgyfQ.b5snt7g7hd5mdX9SO9Sw1dFqtz6eJXqkRrYW6cr6OAY";
const PASSWORD        = "Maya2024!";
const ADMIN_ID        = "72c1b269-c2aa-4bc2-817f-c5c6012638c0";

// Usuarios demo con UUIDs fijos — deben coincidir con seed.sql
const DEMO_USERS = [
  { id: ADMIN_ID,
    email: "admin@maya.com",           role: "admin",    first_name: "Admin",   last_name: "Maya",      phone: "+5215512345678", rfc: null,             is_locked: false },
  { id: "ba000001-0000-4000-8000-000000000001",
    email: "carlos@demo.maya.app",     role: "tenant",   first_name: "Carlos",  last_name: "López",     phone: "+5215598765432", rfc: "LOPC950215XYZ",  is_locked: false },
  { id: "ba000002-0000-4000-8000-000000000002",
    email: "maria@demo.maya.app",      role: "tenant",   first_name: "María",   last_name: "Hernández", phone: "+5215587654321", rfc: "HERM880401ABC",  is_locked: false },
  { id: "ba000003-0000-4000-8000-000000000003",
    email: "roberto@demo.maya.app",    role: "tenant",   first_name: "Roberto", last_name: "García",    phone: "+5215576543210", rfc: "GARR900615DEF",  is_locked: true  },
  { id: "ba000004-0000-4000-8000-000000000004",
    email: "ana@demo.maya.app",        role: "tenant",   first_name: "Ana",     last_name: "Martínez",  phone: "+5215565432109", rfc: "MARA920830GHI",  is_locked: false },
  { id: "bb000001-0000-4000-8000-000000000001",
    email: "lucia@demo.maya.app",      role: "cleaning", first_name: "Lucía",   last_name: "Ramírez",   phone: "+5215554321098", rfc: null,             is_locked: false },
  { id: "bb000002-0000-4000-8000-000000000002",
    email: "pedro@demo.maya.app",      role: "cleaning", first_name: "Pedro",   last_name: "Sánchez",   phone: "+5215543210987", rfc: null,             is_locked: false },
  { id: "bc000001-0000-4000-8000-000000000001",
    email: "jorge@demo.maya.app",      role: "security", first_name: "Jorge",   last_name: "Torres",    phone: "+5215532109876", rfc: null,             is_locked: false },
];

const authHeaders = {
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "apikey": SERVICE_KEY,
  "Content-Type": "application/json",
};
const restHeaders = {
  ...authHeaders,
  "Prefer": "resolution=merge-duplicates",
};

// Fetch con timeout de 15s para no colgar si Supabase no responde
async function fetchWithTimeout(url, options = {}, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function deleteUserById(id) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  // 404 es OK (no existía), cualquier otra cosa es error real
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    console.warn(`  ⚠️  No se pudo borrar ${id}: ${body}`);
  }
}

async function createAuthUser(id, email) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      id,           // UUID fijo — GoTrue admin API acepta este campo
      email,
      password: PASSWORD,
      email_confirm: true,    // confirma el email automáticamente
    }),
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function upsertProfile(user) {
  const payload = {
    id:         user.id,
    role:       user.role,
    first_name: user.first_name,
    last_name:  user.last_name,
    phone:      user.phone,
    rfc:        user.rfc ?? null,
    is_active:  true,
    is_locked:  user.is_locked,
  };

  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    method: "POST",
    headers: restHeaders,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Profile insert failed (${res.status}): ${body}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀  Maya — creando usuarios demo\n");
  console.log(`   URL:      ${SUPABASE_URL}`);
  console.log(`   Password: ${PASSWORD}\n`);

  let ok = 0, failed = 0;

  for (const user of DEMO_USERS) {
    process.stdout.write(`   ${user.email.padEnd(32)}`);
    try {
      // 1. Borrar si ya existe (para re-ejecutar limpiamente)
      await deleteUserById(user.id);

      // 2. Crear en auth.users via Admin API
      await createAuthUser(user.id, user.email);

      // 3. Insertar user_profile via REST API
      await upsertProfile(user);

      console.log(`✅  ${user.id}`);
      ok++;
    } catch (err) {
      console.log(`❌  ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  if (failed === 0) {
    console.log(`✅  ${ok} usuarios creados correctamente.`);
    console.log(`\n📋  Credenciales demo:`);
    console.log(`     Contraseña: ${PASSWORD}`);
    console.log(`     Tenants:  carlos / maria / roberto (bloqueado) / ana`);
    console.log(`     Cleaning: lucia / pedro`);
    console.log(`     Admin:    admin@maya.com`);
    console.log(`\n▶️   Ahora corre el resto del seed en Supabase SQL Editor:`);
    console.log(`     supabase/seed-data.sql  (edificios, contratos, tickets, etc.)`);
  } else {
    console.log(`⚠️   ${ok} OK, ${failed} errores. Revisa los mensajes arriba.`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
