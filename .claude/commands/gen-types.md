# Skill: /gen-types

Sincroniza `packages/types/src/index.ts` con el estado actual del schema de Supabase.

## Cuándo usar
- Después de aplicar una migración SQL que agrega/modifica tablas, columnas, o enums
- Cuando el frontend o api-client da errores de tipo que no matchean la DB
- Al inicio de una sesión si no es claro si los tipos están al día

## Lo que hace este skill

### Paso 1 — Leer el estado actual
Lee en paralelo:
- `packages/types/src/index.ts` — tipos TypeScript actuales
- `supabase/migrations/` — todas las migraciones SQL (para ver el schema completo)
- `supabase/seed.sql` — para entender datos de referencia y enums usados

### Paso 2 — Identificar gaps
Compara las tablas/enums del SQL con los tipos TypeScript existentes y lista:
- Tablas sin interfaz TypeScript correspondiente
- Columnas faltantes en interfaces existentes
- Enums en SQL que no tienen su equivalente TS
- Tipos que existen en TS pero ya no en el schema (candidatos a eliminar)

### Paso 3 — Generar tipos

Para **cada tabla** del schema genera una interfaz TypeScript siguiendo estas convenciones:

```typescript
// Convención de naming
// tabla: user_profiles → interfaz: UserProfile (singular, PascalCase)
// tabla: cleaning_assignments → interfaz: CleaningAssignment

export interface UserProfile {
  id: string;                    // UUID → string
  created_at: string;            // timestamptz → string (ISO 8601)
  email: string;
  role: UserRole;                // FK a enum → usar el tipo enum
  is_locked: boolean;
  // ... resto de columnas
}

// Columnas nullable → tipo | null
building_id: string | null;

// Enums SQL → TS enum o union type
export type UserRole = 'admin' | 'tenant' | 'cleaning' | 'security';
// O si el enum ya existe como SQL enum, usar const enum:
export enum LeaseStatus {
  Active = 'active',
  Terminated = 'terminated',
  Pending = 'pending',
}
```

**Tipos de columna SQL → TypeScript:**
| SQL | TypeScript |
|-----|-----------|
| `uuid` | `string` |
| `text`, `varchar` | `string` |
| `integer`, `numeric`, `bigint` | `number` |
| `boolean` | `boolean` |
| `timestamptz`, `timestamp` | `string` |
| `jsonb`, `json` | `Record<string, unknown>` o tipo específico si se conoce |
| `text[]` | `string[]` |

### Paso 4 — Actualizar el archivo

Edita `packages/types/src/index.ts`:
- Agrega interfaces/enums faltantes
- Actualiza interfaces con columnas nuevas (sin eliminar columnas existentes a menos que sean obsoletas confirmadas)
- Mantiene el orden: enums primero, luego interfaces por dominio (Users, Buildings, Rooms, Leases, Payments, etc.)
- Agrega comentario `// Last synced: YYYY-MM-DD` al inicio del archivo

### Paso 5 — Verificar compilación

```bash
cd /ruta/del/proyecto && pnpm type-check
```

Si hay errores de tipo en `packages/api-client` o apps que usan los tipos, listarlos para resolución manual.

### Paso 6 — Reportar

Devuelve un resumen de:
- ✅ Tipos agregados (lista)
- ✅ Tipos actualizados (lista con qué cambió)
- ⚠️  Tipos en TS sin tabla correspondiente en DB (para revisión manual)
- ❌ Errores de compilación encontrados (si hay)

## Notas importantes

- **No eliminar tipos existentes** sin confirmación explícita — podrían estar usados en código que aún no revisamos.
- Los tipos `*_encrypted` en la DB (e.g., `access_code_encrypted`) siempre son `string` en TS — nunca exponer el valor decriptado en el tipo.
- La tabla `complaints_safe` es una **vista**, no una tabla — generar interfaz `ComplaintSafe` basada en sus columnas visibles.
- Columnas calculadas o de vistas pueden no estar en las migraciones; leerlas del seed o de queries previas si están disponibles en el contexto.
