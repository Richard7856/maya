# DECISIONS.md

Registro de decisiones técnicas no-obvias del proyecto Maya.
Cada entrada responde: qué se decidió, por qué, qué se descartó, y qué riesgos tiene.

---

## [2025-05] Monorepo pnpm workspaces + Turborepo

**Context:** El proyecto tiene 3 apps (web, mobile-tenant, mobile-cleaning) y 4 packages compartidos (types, utils, api-client, ui-mobile). Necesitábamos orquestación de builds y compartir código entre apps.

**Decision:** pnpm workspaces para gestión de dependencias + Turborepo para pipeline de builds con caché.

**Alternatives considered:**
- Nx: más potente pero mayor overhead de configuración y curva de aprendizaje.
- Yarn workspaces: sin ventaja clara sobre pnpm; pnpm es más eficiente en disco.
- Repos separados: descartado — el código compartido (types, api-client) hace inviable el desarrollo en paralelo sin publicar paquetes.

**Risks/Limitations:** Turborepo requiere que los scripts estén bien definidos en cada `package.json`; si faltan, el pipeline falla silenciosamente.

**Improvement opportunities:** Agregar `turbo prune` para Docker builds de producción (solo incluye las dependencias del app que se despliega).

---

## [2025-05] Backend FastAPI como proyecto Python standalone (fuera del workspace pnpm)

**Context:** El backend es Python/FastAPI; el workspace de pnpm solo entiende Node/TypeScript.

**Decision:** `backend/` vive fuera de `pnpm-workspace.yaml`. Tiene su propio `requirements.txt`, `.venv`, y se levanta con uvicorn de forma independiente.

**Alternatives considered:**
- Incluirlo en el workspace con un script `package.json` que llame a uvicorn: agrega complejidad sin beneficio real; mezcla ecosistemas.
- Dockerizar desde el inicio: válido para prod, pero añade fricción en desarrollo local.

**Risks/Limitations:** `pnpm dev` (turbo) no levanta el backend. El desarrollador debe levantar uvicorn manualmente o vía `docker compose up`.

**Improvement opportunities:** Agregar `backend/` al `turbo.json` como tarea externa con un script wrapper, para tener un único `pnpm dev` que levante todo.

---

## [2025-05] Modelo de seguridad de dos capas (RLS + FastAPI guards)

**Context:** Supabase ofrece RLS a nivel DB. FastAPI puede usar la anon key (respeta RLS) o la service_role key (la bypasea).

**Decision:** FastAPI usa **service_role key** y aplica control de acceso en Python vía role guards (`require_admin`, `require_tenant`, etc.). El frontend/mobile puede hacer queries directas a Supabase con la anon key + RLS para lectura simple.

**Alternatives considered:**
- FastAPI con anon key: RLS maneja todo. Más simple, pero pierde flexibilidad para lógica de negocio compleja (e.g., locking de cuentas, encriptación de campos).
- Solo FastAPI sin RLS: deja la DB desprotegida si alguien obtiene acceso directo a Supabase.

**Risks/Limitations:** Si un router de FastAPI olvida aplicar el role guard, expone datos sin restricción. La service_role key **nunca** debe llegar al cliente.

**Improvement opportunities:** Agregar tests de integración que verifiquen que cada endpoint rechaza el rol incorrecto (no solo que acepta el correcto).

---

## [2025-05] Encriptación de `access_code` con Fernet (AES-128-CBC + HMAC)

**Context:** Los códigos de acceso a las habitaciones se almacenan en `leases.access_code_encrypted`. Son datos sensibles — si la DB se compromete, los códigos no deben ser legibles.

**Decision:** Fernet (librería `cryptography` de Python). Clave derivada con PBKDF2-SHA256 desde `APP_SECRET_KEY`, 480,000 iteraciones, salt estático `b"maya-access-code-v1"`.

**Alternatives considered:**
- `pgcrypto` (cifrado en DB): mantiene la lógica en Postgres, pero acopla el esquema de encriptación a la DB; más difícil de rotar la clave.
- Encriptación simétrica sin HMAC: vulnerable a bit-flipping; Fernet incluye autenticación del ciphertext.
- Vault / KMS externo: correcto para escala enterprise, overkill para MVP.

**Risks/Limitations:** Cambiar `APP_SECRET_KEY` o el salt invalida **todo** el ciphertext existente. La clave se re-deriva en cada llamada (sin caché) — hay un costo de CPU por request que involucre access codes.

**Improvement opportunities:** Cachear la clave derivada al arranque del servidor (es determinista; no cambia en runtime). Agregar versioning al ciphertext para facilitar rotación de clave.

---

## [2025-05] Helper de room-scoping local por router (no utilitario compartido)

**Context:** Los tenants solo deben ver/crear recursos de su propia habitación. La habitación se obtiene consultando `leases` por `tenant_id` activo.

**Decision:** Cada router que necesita room-scoping implementa su propio `_get_tenant_room_id()` helper privado.

**Alternatives considered:**
- Utilitario compartido en `app/utils/` o como `Depends()`: más DRY, pero crea acoplamiento entre routers. Si el helper cambia (e.g., soporte multi-lease), todos los routers se ven afectados a la vez.
- Denormalizar `room_id` en `user_profiles`: más rápido, pero introduce estado que puede desincronizarse con `leases`.

**Risks/Limitations:** Código duplicado. Si la lógica de "cómo obtener la habitación activa" cambia, hay que actualizar N routers.

**Improvement opportunities:** Cuando haya 3+ routers usando el mismo helper sin variaciones, promover a `Depends()` compartido en `dependencies/`.

---

## [2025-05] `dependency_overrides` para tests (no `mock.patch`)

**Context:** FastAPI resuelve dependencias (`Depends()`) en su propio contenedor DI. `mock.patch` parchea el módulo Python pero no intercepta el sistema de DI de FastAPI.

**Decision:** Todos los tests usan `app.dependency_overrides[dep_fn] = lambda: mock_value` para inyectar mocks.

**Alternatives considered:**
- `unittest.mock.patch`: los tests pasan pero sin ejercer el código real de autenticación — falsos positivos.
- Inyección manual en cada test: verboso y propenso a olvidar limpiar overrides entre tests.

**Risks/Limitations:** Los `dependency_overrides` son globales en el objeto `app`. Hay que limpiarlos en teardown (`app.dependency_overrides.clear()`) o usar el fixture `autouse` de conftest.

**Improvement opportunities:** Ninguna — este es el patrón oficial de FastAPI para testing.

---

## [2025-05] Rutas literales registradas antes que rutas paramétricas

**Context:** FastAPI hace matching de rutas en orden de registro. Si `GET /{user_id}` se registra antes que `GET /me`, el string "me" se parsea como UUID y devuelve 422.

**Decision:** En cada router, los segmentos literales (`/me`, `/mine`, `/webhook/stripe`) siempre se registran **antes** que `/{id}` en el mismo archivo.

**Alternatives considered:**
- Sub-routers separados: overkill para 1-2 rutas literales.
- Prefijos distintos: cambia la API pública.

**Risks/Limitations:** Fácil de olvidar al agregar nuevas rutas. El error es silencioso (422, no 404), lo que dificulta el debug.

**Improvement opportunities:** Documentar el orden requerido con un comentario en cada router que tenga esta situación.

---

## [2025-05] Uploads vía presigned URLs (FastAPI nunca maneja binarios)

**Context:** Las fotos de incidentes, documentos de onboarding, etc. necesitan almacenarse. FastAPI podría recibir multipart/form-data y reenviar a Supabase Storage.

**Decision:** FastAPI expone `POST /api/v1/storage/presign` que devuelve una URL firmada de Supabase Storage. El cliente hace PUT directo a esa URL.

**Alternatives considered:**
- FastAPI como proxy de uploads: más simple para el cliente, pero el binario pasa por el servidor API (memoria, latencia, costos de red innecesarios).
- Upload directo desde cliente con anon key: expone la lógica de qué bucket/path puede usar cada rol.

**Risks/Limitations:** El cliente necesita dos requests (obtener URL + PUT). Las presigned URLs tienen TTL; si expiran antes de que el usuario suba, falla silenciosamente.

**Improvement opportunities:** Retornar el TTL en la respuesta para que el cliente pueda manejar la expiración.

---

## [2025-05] n8n para automatización (no cron jobs en FastAPI)

**Context:** Necesitamos: recordatorios de pago (día 5, 10), lock de cuentas (día 11), notificaciones WhatsApp + push post-pago.

**Decision:** n8n maneja todos los workflows de automatización. FastAPI triggeriza n8n vía webhook (`POST http://n8n:5678/webhook/{workflow_name}`) con `X-Maya-Webhook-Secret`. n8n corre en Docker en la misma red.

**Alternatives considered:**
- Celery + Redis: más potente para colas de tareas, pero añade dos servicios más (worker + broker) y mayor complejidad operacional.
- APScheduler en FastAPI: simple, pero los jobs corren en el mismo proceso que la API; un job bloqueante afecta la latencia de la API.
- GitHub Actions / cron externo: no tiene acceso a la DB interna.

**Risks/Limitations:** n8n es un SPOF para automatización. Si está caído, los workflows no se ejecutan. No hay retry automático desde FastAPI si el webhook falla.

**Improvement opportunities:** Agregar retry con backoff en `integrations/n8n.py`. Loggear en una tabla `workflow_triggers` para auditoría.

---

## [2025-05] Stripe PaymentIntents en MXN (centavos)

**Context:** Los tenants mexicanos pagan renta en MXN. Stripe requiere montos en la unidad más pequeña de la moneda.

**Decision:** Todos los montos internos se almacenan en **centavos MXN** (integer). La conversión a pesos para display ocurre en el frontend (`amount / 100`).

**Alternatives considered:**
- Almacenar en pesos con decimal: riesgo de errores de punto flotante en cálculos.
- Convertir a centavos solo al llamar Stripe: doble conversión, propenso a bugs.

**Risks/Limitations:** Fácil confundir centavos con pesos al leer la DB. Documentar en el schema con un comentario en la columna.

**Improvement opportunities:** Agregar un tipo `MXNCentavos` en `packages/types` para hacer la unidad explícita en TypeScript.
