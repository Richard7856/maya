-- Migration 004: ticket evidence photo URL
-- Adds an optional evidence_url column to tickets so cleaning staff can attach
-- a photo when reporting damage (desperfectos) from the mobile app.
-- The photo is uploaded to Supabase Storage and the public URL is stored here.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS evidence_url TEXT;

COMMENT ON COLUMN tickets.evidence_url IS
  'Public URL of an evidence photo uploaded to Supabase Storage (bucket: incidents). '
  'Set by cleaning staff when reporting damage via the mobile app.';
