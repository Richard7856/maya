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

---

## [2026-04-14] Marketplace Operativo — Catálogo + Carrito + Requisición

**Context:** Los administradores necesitan gestionar proveedores, artículos de reparación y generar órdenes de compra ligadas a tickets de mantenimiento. Era la prioridad antes que los flujos de pago (sin credenciales Stripe activas).

**Decision:** Marketplace implementado en dos fases entregadas en la misma sesión:
- **Fase 1** — Tablas `providers`, `items`, `item_prices` con historial de precios y alerta automática de variación >15%. CRUD completo en web dashboard y pantalla de proveedores en mobile cleaning.
- **Fase 2** — Tabla `ticket_items` como carrito ligado a tickets. Endpoints `GET/POST/DELETE /tickets/{id}/items` y `GET /tickets/{id}/requisition`. La requisición agrupa artículos por proveedor al precio más bajo registrado y devuelve totales por grupo + items sin precio.
- **Fase 3 (evidencia)** — Campo `receipt_url` en `item_prices`. Al registrar un precio, el admin puede adjuntar foto del ticket de caja. Upload directo a bucket `receipts` de Supabase Storage via presigned URL.

**Alternatives considered:**
- Módulo de compras separado (purchase orders independientes de tickets): más flexible, pero añade una entidad más sin valor inmediato. Los tickets ya son el registro de trabajo; el carrito sobre tickets es más natural para el flujo operativo.
- Almacenar `suggested_provider_id` en `ticket_items` al agregar artículo: descartado porque congela el proveedor en el momento de agregar. La requisición calcula el mejor precio en tiempo real con la tabla `item_prices`, así siempre refleja precios actuales.
- Zona como FK a tabla `zones`: descartado. Zona es un label geográfico informal ("Roma Norte", "Interlomas"), no una entidad del sistema. Texto libre con búsqueda `ilike` es suficiente.

**Risks/Limitations:**
- La alerta de variación compara contra el último precio del **mismo proveedor**. Si un artículo solo tiene un registro, no hay alerta aunque el precio sea inusual.
- La requisición no considera stock ni cantidades mínimas — es una lista de compra, no un sistema de inventario.
- `receipt_url` apunta al bucket `receipts` que debe crearse manualmente en Supabase Dashboard (no hay migración automática de buckets).

**Improvement opportunities:**
- Fase 4: botón "Enviar requisición por WhatsApp" que triggerize un workflow n8n con el listado por proveedor.
- Fase 5: clasificación automática de artículos por foto usando vision AI al subir el comprobante.
- Inventario: agregar tabla `stock_movements` para rastrear entradas/salidas de materiales por edificio.

---

## [2026-04-14] Estado del proyecto y próximos pasos (Roadmap sesión siguiente)

**Context:** Al cierre de la sesión 2026-04-14, el sistema está en este estado:

```
Backend (FastAPI)      ██████████ 100% — todos los routers funcionando
Web dashboard          █████████░  90% — faltan 2 formularios + sección complaints
Mobile tenant          █████████░  90% — payments.tsx usa datos demo, resto API real
Mobile cleaning        ██████████ 100% — tasks, session, providers conectados a API
Marketplace            ██████████ 100% — catálogo + carrito + requisición + evidencia
```

**Qué falta para la versión final — en orden de prioridad:**

### 🔴 Alta (bloquea uso diario real)

**1. Mobile tenant — Payments screen** (`apps/mobile-tenant/app/(tabs)/payments.tsx`)
- Actualmente usa `DEMO_PAYMENTS` hardcodeado
- Conectar a `paymentsApi.list()` para mostrar pagos reales
- Mostrar status con colores (pagado/pendiente/vencido)
- El botón "Pagar" queda pendiente hasta tener credenciales Stripe
- Archivos: `apps/mobile-tenant/app/(tabs)/payments.tsx`, `packages/api-client/src/payments.ts`

**2. Web — Formulario "Nuevo contrato"** (`apps/web/src/app/(dashboard)/leases/page.tsx`)
- Admin no puede onboardear tenants sin ir directo al DB
- Campos: `room_id`, `tenant_id`, `start_date`, `end_date`, `monthly_rate`, `payment_day`, `deposit_amount`, `access_code`
- API ya existe: `leasesApi.create(body)` en `packages/api-client/src/leases.ts`
- Necesita selects de rooms disponibles + users con rol tenant

**3. Web — Formulario "Nuevo ticket"** (`apps/web/src/app/(dashboard)/tickets/page.tsx`)
- Admin no puede crear work orders desde la UI
- Campos: `room_id`, `type` (cleaning/maintenance), `title`, `description`, `priority`, `assigned_to`, `due_date`
- API ya existe: `ticketsApi.create(body)` en `packages/api-client/src/tickets.ts`
- Ver componente `TicketGrid` en `apps/web/src/components/tickets/`

### 🟡 Media (feature diferenciador para primer cliente)

**4. Web — Sección Complaints** (nueva ruta `/complaints`)
- Vista de quejas anónimas usando la view `complaints_safe` de Supabase
- Solo lectura para admin + cambio de status (open → investigating → resolved)
- No hay router en backend — agregar `GET /complaints` y `PATCH /complaints/{id}/status`
- Sidebar ya tiene espacio para agregar el link

**5. Push notifications** (ambas apps mobile)
- Instalar `expo-notifications` en `apps/mobile-tenant` y `apps/mobile-cleaning`
- Al hacer login exitoso: `usersApi.updateMe({ expo_push_token: token })`
- El backend ya tiene el campo `expo_push_token` en `user_profiles`
- n8n WF-03 ya consume el token para notificaciones post-pago

### 🟢 Baja / deferred

**6. Stripe PaymentSheet** — bloqueado por credenciales. Cuando estén disponibles:
- Instalar `@stripe/stripe-react-native` en `apps/mobile-tenant`
- Reemplazar botón "Pagar" demo con flujo real en `payments.tsx`
- El backend `POST /payments/{id}/pay` ya genera el PaymentIntent

**7. Secciones web adicionales** — Onboarding Applications, Access Events, Guest Accesses, Moveout Requests. Tablas existen en DB, sin UI ni routers backend.

**Decision:** Secuencia recomendada para la próxima sesión:
1. Payments mobile (#1) — ~1h
2. Nuevo contrato web (#2) — ~1.5h
3. Nuevo ticket web (#3) — ~1h
4. Complaints web (#4) — ~45min
5. Push notifications (#5) — ~1h

**Risks/Limitations:** El task #2 (nuevo contrato) requiere mostrar solo rooms con status `vacant` en el select — filtrar por `status = 'vacant'` en `buildingsApi` o agregar un endpoint `GET /rooms?status=vacant`. Verificar antes de implementar qué endpoint conviene extender.

**Improvement opportunities:** Con estos 5 tasks completos, el sistema está listo para el primer cliente real en modo piloto (sin Stripe, pagos manuales confirmados por admin).

---

## [2026-04-22] Supabase Web Locks API stub para Expo Web

**Context:** En Expo Web con hot-reload, el mecanismo `navigatorLock` de `@supabase/supabase-js` usa la Web Locks API del navegador. Al hacer hot-reload, el nuevo módulo roba el lock antes de que el anterior lo libere, lanzando: `"Lock 'lock:sb-...' was released because another request stole it"`. El crash borra la sesión en desarrollo.

**Decision:** En `Platform.OS === "web"`, se inyecta un stub `lock` en las opciones de `createClient`:
```ts
const webLock = Platform.OS === "web"
  ? async (_name, _timeout, fn) => fn()  // bypasea Web Locks API
  : undefined;
```
Aplicado en `apps/mobile-tenant/lib/supabase.ts` y `apps/mobile-cleaning/lib/supabase.ts`.

**Alternatives considered:**
- Deshabilitar hot-reload: inaceptable en desarrollo.
- `persistSession: false` en web: funciona pero pierde la sesión entre recargas.
- Downgrade de `@supabase/supabase-js`: rompe otras APIs.

**Risks/Limitations:** El stub no tiene concurrency control entre pestañas en web. En producción nativa esto no aplica (el código nativo usa AsyncStorage, no Web Locks).

**Improvement opportunities:** Solo afecta Expo Web (preview/desarrollo). En builds nativos de producción el `Platform.OS` nunca es "web", por lo que el stub es dead code en prod.

---

## [2026-04-22] Formularios New Lease y New Ticket en web dashboard

**Context:** El admin no podía crear contratos ni tickets desde la UI — debía ir directamente a Supabase Dashboard o la CLI.

**Decision:** Dos modales `NewLeaseDialog` y `NewTicketDialog` implementados como Client Components en `apps/web/src/components/leases/` y `apps/web/src/components/tickets/`. Ambos hacen lazy-load de los selects (rooms, tenants, staff) al abrir el modal para evitar requests innecesarios.

**Alternatives considered:**
- Páginas separadas `/leases/new` y `/tickets/new`: más espacio de pantalla, pero innecesario para formularios de 6-8 campos. Los modales mantienen el contexto del listado.
- Inline forms en la tabla: complica el layout y el manejo de estado.

**Risks/Limitations:**
- `NewLeaseDialog` filtra rooms con `status = 'vacant'` usando el nuevo endpoint `GET /buildings/rooms?status=vacant`. Si un room queda en estado incorrecto en DB, no aparece en el select.
- Error 409 manejado explícitamente (room con contrato activo ya existente).

**Improvement opportunities:** Agregar validación de fechas (end_date > start_date), rango válido de payment_day (1-28).

---

## [2026-04-22] Endpoint global GET /buildings/rooms

**Context:** Los formularios de admin (new lease, new ticket) necesitan un select de todas las habitaciones de todos los edificios, con JOIN al nombre del edificio para que el admin pueda identificar cuál es cuál.

**Decision:** Nuevo endpoint `GET /buildings/rooms` registrado en `buildings.py` **antes** que `GET /buildings/{building_id}` para evitar que FastAPI parsee "rooms" como UUID. Acepta query params `?status=` y `?building_id=` para filtrar. Solo accesible para admins.

**Alternatives considered:**
- Endpoint en un router separado `rooms.py`: más correcto en términos de REST puro, pero añade un archivo y un router mount para un solo endpoint.
- Cargar habitaciones desde el endpoint de building detail: requiere conocer el `building_id` de antemano, no sirve para selects globales.

**Risks/Limitations:** El endpoint devuelve todas las habitaciones — en un sistema con muchos edificios puede ser costoso. Sin paginación por ahora.

**Improvement opportunities:** Agregar paginación o búsqueda por texto cuando escale a 50+ habitaciones.

---

## [2026-04-22] Sección Complaints en web dashboard

**Context:** La tabla `complaints` existe en DB con una view `complaints_safe` que oculta `tenant_id` cuando `is_anonymous = TRUE`. No había UI ni router de backend.

**Decision:**
- Backend: nuevo router `complaints.py` con `GET /complaints` (usa `complaints_safe` view) y `PATCH /complaints/{id}/status`. Solo admin.
- Web: página `/complaints` con KPIs, filtros y cards con transiciones de status inline.
- El campo `tenant_id` nunca se expone en la UI — todo va por la view.

**Alternatives considered:**
- Leer directo desde frontend con Supabase anon key + RLS: la view `complaints_safe` ya tiene RLS correctamente configurada para este caso, pero mantener consistencia con el patrón FastAPI es más predecible.

**Risks/Limitations:** La view `complaints_safe` debe existir en la DB. Si se recrea el schema desde cero, la view debe incluirse en las migraciones.

**Improvement opportunities:** Agregar formulario para que admin cree quejas manualmente (e.g., quejas recibidas por teléfono).

---

## [2026-04-22] Push notifications con expo-notifications

**Context:** El backend ya tenía el campo `expo_push_token` en `user_profiles` y n8n WF-03 ya enviaba notificaciones con ese token. Solo faltaba registrarlo desde las apps mobile.

**Decision:** Hook `usePushNotifications(enabled: boolean)` implementado en ambas apps. Se registra en `AuthProvider` con `usePushNotifications(!!session)`. El hook sube el token con `usersApi.updateMe({ expo_push_token })` en fire-and-forget (nunca lanza, nunca bloquea el login).

**Alternatives considered:**
- Registrar el token en un `useEffect` de cada pantalla: duplica código.
- Registrar en el momento del login: el token puede cambiar entre sesiones; es mejor mantenerlo sincronizado mientras haya sesión activa.

**Risks/Limitations:**
- En simulador `Device.isDevice = false`, el hook retorna null sin registrar token — correcto, los simuladores no pueden recibir push.
- En Expo Web el permiso de notificaciones no está disponible en todos los navegadores.

**Improvement opportunities:** Manejar el caso en que el usuario rechaza el permiso la primera vez y vuelve a dar permiso después — re-registrar en `onAuthStateChange` con el nuevo token.

---

## [2026-04-22] Sidebar responsivo — drawer en mobile, estático en desktop

**Context:** El web dashboard tenía el sidebar fijo `w-56` sin ningún comportamiento mobile. En pantallas < 768px el contenido principal quedaba aplastado o ilegible.

**Decision:** Se introduce `DashboardShell` como Client Component que gestiona el estado `mobileOpen`. El layout.tsx (Server Component) delega el rendering del shell a este componente para no convertirse en cliente.

Comportamiento:
- **Desktop (≥ md)**: sidebar estático, igual que antes. `md:static md:translate-x-0` anula el posicionamiento fixed.
- **Mobile (< md)**: top bar fijo con botón hamburguesa + logo. Sidebar oculto (`-translate-x-full`), entra con `translate-x-0` + transition al abrir. Backdrop semitransparente cierra el drawer al hacer tap fuera. Navegar a cualquier sección cierra el drawer automáticamente (`onClick={onClose}` en cada `<Link>`).

**Alternatives considered:**
- Usar una librería de drawer (shadcn/ui Sheet, Radix Dialog): añade una dependencia para algo que Tailwind resuelve con 3 clases.
- Convertir layout.tsx en Client Component y manejar el estado ahí: contamina el Server Component chain — Next.js no puede hacer streaming de los hijos si el layout es cliente.
- CSS `@media` sin JS (sidebar siempre visible pero colapsado a íconos): más complejo de implementar y peor UX en mobile.

**Risks/Limitations:** El top bar tiene `h-14` fijo, y `<main>` tiene `pt-20` en mobile para compensar. Si el top bar cambia de altura, hay que actualizar el padding.

**Improvement opportunities:** Recordar el estado open/closed en `localStorage` para usuarios que prefieren sidebar abierto siempre en tablets.

---

## [2026-04-22] Estado del proyecto al cierre — roadmap sesión siguiente

**Context:** Al cierre de la sesión 2026-04-22, el sistema está en este estado:

```
Backend (FastAPI)      ██████████ 100% — todos los routers, incluyendo /complaints
Web dashboard          ██████████ 100% — COMPLETO: formularios, complaints, responsive
Mobile tenant          █████████░  90% — payments.tsx aún usa datos demo (sin Stripe)
Mobile cleaning        ██████████ 100% — tasks, session, providers conectados a API
Marketplace            ██████████ 100% — catálogo + carrito + requisición + evidencia
Push notifications     ██████████ 100% — hooks implementados, token sube al login
```

**Lo único que queda para versión final:**

### 🔴 Stripe PaymentSheet (bloqueado por credenciales)
Cuando estén disponibles las credenciales Stripe:
1. Instalar `@stripe/stripe-react-native` en `apps/mobile-tenant`
2. En `payments.tsx`: conectar `paymentsApi.list()` (lista real de pagos)
3. Botón "Pagar": llamar `paymentsApi.createIntent(id)` → recibir `client_secret` → abrir `PaymentSheet`
4. El backend `POST /payments/{id}/pay` ya genera el PaymentIntent — listo para usar
5. Webhook `POST /api/v1/payments/webhook/stripe` ya maneja `payment_intent.succeeded`

### 🟢 Opcionales / mejoras post-MVP
- Secciones web: Onboarding Applications, Access Events, Guest Accesses, Moveout Requests (tablas en DB, sin UI ni routers)
- Búsqueda por texto en todas las secciones del dashboard
- Real-time updates con Supabase Realtime (subscriptions)
- `turbo prune` para Docker builds de producción

**El sistema está listo para piloto con el primer cliente real** usando pagos manuales (admin confirma en dashboard) mientras llegan las credenciales Stripe.

---

## [2026-04-23] Seed idempotente con contraseñas conocidas y fechas relativas

**Context:** El seed original usaba `gen_random_uuid()` para los IDs de usuarios demo y `crypt(md5(random_uuid), ...)` como contraseña — imposible de conocer. Adicionalmente, las asignaciones de limpieza estaban hardcodeadas a fechas del pasado, así que la app de limpieza nunca mostraba tareas al abrir.

**Decision:**
- UUIDs fijos y deterministas para todos los usuarios demo (prefijos `ba…`, `bb…`, etc.)
- Contraseña única `Maya2024!` para todas las cuentas demo
- `DELETE` al inicio del bloque para limpiar usuarios demo previos (solo los `@demo.maya.app`)
- Fechas relativas: asignaciones de limpieza usan `CURRENT_DATE` (hoy) y `CURRENT_DATE - 1` (ayer)
- Fechas de pagos y contratos usan intervalos relativos (`CURRENT_DATE - INTERVAL '3 months'`)

**Alternatives considered:**
- Documentar las contraseñas generadas en la primera corrida: requiere guardar estado externo; frágil.
- Un script `reset-demo-passwords.sh` que llame a la Supabase CLI: más correcto para producción, pero agrega dependencia.

**Risks/Limitations:** Si ya hay datos con los UUIDs fijos en la DB, el DELETE al inicio borra esos datos. El admin (`72c1b269-…`) NO se borra para preservar la sesión de producción.

**Improvement opportunities:** Separar seed en `seed_schema.sql` (estructural) y `seed_demo.sql` (datos), para que CI pueda correr solo el de schema.

---

## [2026-04-23] Reporte de desperfectos desde app de limpieza

**Context:** Personal de limpieza descubre daños (desperfectos) durante su ronda — llave rota, ventana atascada, fuga, etc. — y no tenía forma de reportarlo sin hablar con el admin por WhatsApp. El admin luego tenía que crear el ticket manualmente.

**Decision:** Nueva tab "Reportar" (`apps/mobile-cleaning/app/(tabs)/report.tsx`) con:
1. Picker de habitación (llama `GET /buildings/rooms` — extendido para permitir cleaning staff)
2. Captura de foto con `expo-image-picker` (cámara o galería)
3. Upload via presigned URL (`POST /storage/presign` → PUT al bucket `incidents`)
4. Creación de ticket de tipo `maintenance` via `POST /tickets` (extendido para cleaning staff)

El ticket aparece inmediatamente en el web dashboard con la foto incrustada en el sheet de detalle.

**Alternatives considered:**
- Botón dentro de la pantalla de sesión: limita el reporte a cuando hay una sesión activa; los desperfectos se pueden encontrar antes de iniciar.
- Crear un nuevo endpoint `/tickets/report-damage`: innecesario — `POST /tickets` ya tiene toda la semántica, solo faltaba abrir el guard.
- Upload directo con Supabase JS client: más simple en código, pero requiere configurar RLS de Storage por rol. La presigned URL mantiene la auth en el backend.

**Risks/Limitations:**
- El bucket `incidents` debe existir en Supabase Storage con acceso público (crearlo en Dashboard → Storage → New bucket → marcar "Public").
- Cleaning staff solo puede crear tickets de tipo `maintenance`. El tipo `cleaning` sigue siendo exclusivo de admin para evitar auto-asignaciones.
- `atob()` para decodificar base64 está disponible como polyfill global en Expo/React Native — funciona en ambas plataformas.

**Improvement opportunities:**
- Mostrar los tickets recientes del usuario en la misma pantalla para evitar duplicados.
- Permitir múltiples fotos (array `evidence_urls`).
- Notificar al admin vía push cuando llega un nuevo reporte de desperfecto.
