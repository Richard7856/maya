# Skill: /new-router

Crea un nuevo router FastAPI en Maya siguiendo exactamente los patrones del proyecto.

## Uso
```
/new-router <nombre> <roles-permitidos>
```
Ejemplos:
- `/new-router notifications admin,tenant`
- `/new-router guest-access admin,security`

## Lo que hace este skill

1. **Lee** `backend/app/routers/tickets.py` como referencia de patrón (tiene la estructura más completa: role guards, sparse PATCH, role-aware filtering, 409 handling).

2. **Crea** `backend/app/routers/<nombre>.py` con:
   - Imports estándar del proyecto (FastAPI, Annotated, Depends, HTTPException, etc.)
   - Comentario de propósito al inicio del archivo
   - Router con prefix `/api/v1/<nombre>` y tag `<nombre>`
   - Endpoints CRUD base: GET (list), GET (by id), POST (create), PATCH (update), DELETE (soft-delete si aplica)
   - Inyección de `current_user` y `supabase` via `Annotated[..., Depends(...)]`
   - Role guard apropiado según los roles permitidos indicados
   - Role-aware filtering: si `tenant` es un rol permitido, filtrar por el usuario actual automáticamente
   - Rutas literales ANTES que rutas paramétricas (`/me`, `/mine` antes de `/{id}`)
   - Sparse PATCH: `{k: v for k, v in body.model_dump().items() if v is not None}`
   - 409 para conflictos de unicidad (catch de error de DB y re-raise como HTTPException 409)
   - Manejo explícito de 404 cuando el recurso no existe

3. **Modifica** `backend/app/main.py`:
   - Agrega el import del nuevo router
   - Registra el router con `app.include_router()`
   - Mantiene el orden alfabético de imports

4. **Crea** `packages/api-client/src/<nombre>.ts` con:
   - Import de `apiClient` desde `./index`
   - Función por cada endpoint (get<Nombre>s, get<Nombre>ById, create<Nombre>, update<Nombre>, delete<Nombre>)
   - Todas retornan `.then((r) => r.data)` — callers reciben el payload directo
   - Tipos inferidos desde `@maya/types` si están disponibles

5. **Actualiza** `packages/api-client/src/index.ts`:
   - Agrega export del nuevo módulo

6. **Agrega entrada en `DECISIONS.md`** si hubo alguna decisión no-obvia durante la creación (e.g., por qué cierto endpoint no sigue el patrón estándar).

## Checklist de validación post-creación
- [ ] Rutas literales antes que `/{id}` en el router
- [ ] Role guard correcto aplicado (admin-only, o guards específicos)
- [ ] Filtering por usuario para roles no-admin
- [ ] Import y `include_router` en `main.py`
- [ ] Export en `packages/api-client/src/index.ts`
- [ ] Sin errores de Python: `cd backend && python -c "from app.main import app; print('OK')"`

## Referencia de patrones clave

```python
# Guard admin-only (cuando el user no se usa en el handler)
_admin: Annotated[UserProfile, Depends(require_admin)]

# Guard con acceso al user
current_user: Annotated[UserProfile, Depends(get_current_user)]

# Role-aware filtering
if current_user.role != "admin":
    query = query.eq("user_id", str(current_user.id))

# Sparse PATCH
updates = {k: v for k, v in body.model_dump().items() if v is not None}
if not updates:
    raise HTTPException(status_code=422, detail="No fields to update")

# 409 para conflictos
except Exception as e:
    if "duplicate" in str(e).lower() or "unique" in str(e).lower():
        raise HTTPException(status_code=409, detail="Resource already exists")
    raise
```
