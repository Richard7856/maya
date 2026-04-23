-- ============================================================
-- Maya — Migración 003: Evidencia de compra en precios
--
-- Agrega receipt_url a item_prices para que el staff pueda
-- adjuntar foto del ticket de caja al registrar un precio.
-- También crea el bucket 'receipts' en Supabase Storage.
--
-- Aplica en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Columna de evidencia: URL pública de la foto/ticket subida a Storage
ALTER TABLE item_prices
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Índice para facilitar búsquedas de registros CON evidencia
-- (útil para auditorías: "¿cuántos precios tienen comprobante?")
CREATE INDEX IF NOT EXISTS idx_item_prices_has_receipt
  ON item_prices(item_id)
  WHERE receipt_url IS NOT NULL;

-- NOTA: Crear el bucket 'receipts' en Supabase Dashboard:
-- Storage → New Bucket → Name: receipts → Public: NO (acceso solo via URL firmada)
-- O ejecutar via Storage API si tienes acceso.
