-- ============================================================
-- Maya — Migración 002: Marketplace Operativo
--
-- Añade el catálogo de proveedores y artículos, historial de
-- precios con alerta automática de variación >15%, y la tabla
-- de requisiciones que enlaza tickets con artículos.
--
-- Aplica en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Providers ────────────────────────────────────────────────
-- Un proveedor puede estar asociado a una zona general (texto libre,
-- ej. "Roma", "Interlomas") y opcionalmente a un edificio específico.
-- Separamos zona de building_id porque un proveedor puede cubrir
-- una zona sin estar limitado a un solo edificio.
CREATE TABLE IF NOT EXISTS providers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL
                CHECK (category IN (
                  'plumbing', 'electrical', 'cleaning', 'maintenance',
                  'security', 'appliances', 'telecom', 'other'
                )),
  phone         TEXT,
  whatsapp      TEXT,
  zone          TEXT,           -- zona libre: 'Roma', 'Interlomas', NULL = todas
  building_id   UUID REFERENCES buildings(id) ON DELETE SET NULL,
  photo_url     TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Items ─────────────────────────────────────────────────────
-- Catálogo de artículos/materiales/servicios que se pueden requerir
-- en tickets e incidentes. Cada artículo tiene un proveedor principal
-- pero puede tener precios registrados con múltiples proveedores.
CREATE TABLE IF NOT EXISTS items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  description         TEXT,
  photo_url           TEXT,
  unit                TEXT NOT NULL DEFAULT 'pieza'
                      CHECK (unit IN ('pieza', 'm²', 'litro', 'hora', 'servicio', 'kg', 'rollo', 'caja')),
  category            TEXT NOT NULL
                      CHECK (category IN (
                        'plumbing', 'electrical', 'cleaning', 'maintenance',
                        'security', 'appliances', 'telecom', 'other'
                      )),
  primary_provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Item Prices ───────────────────────────────────────────────
-- Historial de precios por artículo + proveedor.
-- La lógica de alerta >15% se maneja en el backend al insertar.
-- Se guarda siempre aunque el precio no cambie para tener historial
-- completo de compras.
CREATE TABLE IF NOT EXISTS item_prices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  price        NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  recorded_by  UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes        TEXT,
  -- flag que el backend activa automáticamente al detectar variación >15%
  price_alert  BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Ticket Items ──────────────────────────────────────────────
-- Carrito de artículos asociado a un ticket (Fase 2).
-- Se crea aquí ya para no requerir otra migración.
-- qty y estimated_price se capturan al momento de agregar al ticket.
CREATE TABLE IF NOT EXISTS ticket_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty             NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (qty > 0),
  estimated_price NUMERIC(10, 2),   -- precio del catálogo al momento de agregar
  added_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT
);

-- ── Índices para búsquedas comunes ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_providers_category   ON providers(category);
CREATE INDEX IF NOT EXISTS idx_providers_zone        ON providers(zone);
CREATE INDEX IF NOT EXISTS idx_providers_building    ON providers(building_id);
CREATE INDEX IF NOT EXISTS idx_items_category        ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_provider        ON items(primary_provider_id);
CREATE INDEX IF NOT EXISTS idx_item_prices_item      ON item_prices(item_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_prices_provider  ON item_prices(provider_id);
CREATE INDEX IF NOT EXISTS idx_ticket_items_ticket   ON ticket_items(ticket_id);

-- ── updated_at trigger (reutiliza patrón del schema inicial) ─
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
