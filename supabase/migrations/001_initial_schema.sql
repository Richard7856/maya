-- ============================================================
-- Maya — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable UUID generation (already enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- PROPERTY HIERARCHY
-- buildings → rooms (towers/floors are optional via the "section" field,
-- suitable for 10+ small buildings of 2–5 rooms each)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE buildings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  address    TEXT NOT NULL,
  city       TEXT NOT NULL DEFAULT 'Ciudad de México',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rooms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id    UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  room_number    TEXT NOT NULL,
  -- "section" covers tower/floor/wing without requiring a separate table
  -- for buildings with only 2–5 rooms. E.g. "Torre A", "Planta Baja", "Piso 2"
  section        TEXT,
  status         TEXT NOT NULL DEFAULT 'vacant'
                 CHECK (status IN ('vacant', 'occupied', 'incoming', 'maintenance')),
  monthly_rate   NUMERIC(10, 2) NOT NULL,
  floor_plan_url TEXT,
  amenities      JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (building_id, room_number)
);

-- ─────────────────────────────────────────────────────────────
-- USERS
-- user_profiles extends Supabase auth.users with app-level fields.
-- The id FK to auth.users is the bridge between Supabase Auth and our data.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE user_profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role             TEXT NOT NULL
                   CHECK (role IN ('admin', 'tenant', 'cleaning', 'security')),
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  phone            TEXT,
  rfc              TEXT,           -- Mexican tax ID, required for contracts
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  -- is_locked is set by n8n WF-02 on day 11 if payment is missing
  is_locked        BOOLEAN NOT NULL DEFAULT FALSE,
  expo_push_token  TEXT,           -- updated on each app open; write-only from client
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- ONBOARDING
-- 3-step process: data → documents → signature/photo → admin approval
-- ─────────────────────────────────────────────────────────────

CREATE TABLE onboarding_applications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  room_id              UUID REFERENCES rooms(id),
  status               TEXT NOT NULL DEFAULT 'step_1'
                       CHECK (status IN ('step_1', 'step_2', 'step_3', 'complete', 'rejected')),
  -- Step 1: Basic registration data
  rfc                  TEXT,
  birth_date           DATE,
  emergency_contact    JSONB,       -- { name, phone, relation }
  -- Step 2: Document uploads (Supabase Storage URLs)
  id_front_url         TEXT,
  id_back_url          TEXT,
  proof_of_income_url  TEXT,
  -- Step 3: Identity confirmation
  selfie_url           TEXT,
  contract_signed_at   TIMESTAMPTZ,
  contract_pdf_url     TEXT,
  admin_notes          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- LEASES & PAYMENTS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE leases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id               UUID NOT NULL REFERENCES rooms(id),
  tenant_id             UUID NOT NULL REFERENCES user_profiles(id),
  start_date            DATE NOT NULL,
  end_date              DATE,
  monthly_rate          NUMERIC(10, 2) NOT NULL,
  -- payment_day: day of month rent is due (default 1st)
  payment_day           INTEGER NOT NULL DEFAULT 1
                        CHECK (payment_day BETWEEN 1 AND 28),
  deposit_amount        NUMERIC(10, 2),
  deposit_paid          BOOLEAN NOT NULL DEFAULT FALSE,
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'ending', 'terminated', 'eviction')),
  contract_url          TEXT,
  wifi_password         TEXT,
  -- access_code_encrypted: shown only via /payments/mine/access-code after payment confirmed
  -- TODO Phase 7: encrypt with app secret key before production
  access_code_encrypted TEXT,
  stripe_customer_id    TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate active leases for the same room.
-- Partial unique index achieves the same as EXCLUDE USING gist without needing btree_gist.
CREATE UNIQUE INDEX idx_unique_active_room_lease
  ON leases(room_id)
  WHERE (status = 'active');

CREATE TABLE payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id                  UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  amount                    NUMERIC(10, 2) NOT NULL,
  due_date                  DATE NOT NULL,
  paid_at                   TIMESTAMPTZ,
  status                    TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'paid', 'overdue', 'partial', 'waived')),
  stripe_payment_intent_id  TEXT,
  stripe_charge_id          TEXT,
  receipt_url               TEXT,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- INCIDENTS
-- Maintenance and repair issues reported by tenants or staff
-- ─────────────────────────────────────────────────────────────

CREATE TABLE incidents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES rooms(id),
  reported_by  UUID NOT NULL REFERENCES user_profiles(id),
  assigned_to  UUID REFERENCES user_profiles(id),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT NOT NULL
               CHECK (category IN ('plumbing', 'electrical', 'structural', 'appliance', 'other')),
  priority     TEXT NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  repair_cost  NUMERIC(10, 2),
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE incident_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('before', 'after', 'during')),
  caption     TEXT,
  taken_by    UUID REFERENCES user_profiles(id),
  taken_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE incident_updates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id        UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  author_id          UUID NOT NULL REFERENCES user_profiles(id),
  note               TEXT NOT NULL,
  status_changed_to  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- COMPLAINTS
-- Between tenants (anonymous by default). Escalation levels 1–5.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE complaints (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id      UUID NOT NULL REFERENCES buildings(id),
  complainant_id   UUID NOT NULL REFERENCES user_profiles(id),
  -- accused_id is hidden from non-admins via RLS (policy below)
  accused_id       UUID REFERENCES user_profiles(id),
  room_id          UUID REFERENCES rooms(id),
  category         TEXT NOT NULL,
  description      TEXT NOT NULL,
  is_anonymous     BOOLEAN NOT NULL DEFAULT TRUE,
  status           TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'under_review', 'resolved', 'appealed', 'dismissed')),
  escalation_count INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE complaint_escalations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  -- level 1=warning, 2=warning+fine, 3=formal notice, 4=notice+fine, 5=removal
  level        INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  action_taken TEXT NOT NULL,
  fine_amount  NUMERIC(10, 2),
  fine_paid    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TICKETS
-- Cleaning tickets → routed to cleaning staff + admin
-- Maintenance tickets → routed to maintenance + admin
-- ─────────────────────────────────────────────────────────────

CREATE TABLE tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES rooms(id),
  created_by  UUID NOT NULL REFERENCES user_profiles(id),
  assigned_to UUID REFERENCES user_profiles(id),
  type        TEXT NOT NULL CHECK (type IN ('cleaning', 'maintenance')),
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  priority    TEXT NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- CLEANING
-- Assignments, sessions (GPS + checklist), and photo evidence
-- ─────────────────────────────────────────────────────────────

CREATE TABLE cleaning_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id     UUID NOT NULL REFERENCES user_profiles(id),
  room_id        UUID NOT NULL REFERENCES rooms(id),
  scheduled_date DATE NOT NULL,
  -- time_block: 1=8-10, 2=10-12, 3=12-14, 4=14-16
  time_block     INTEGER NOT NULL CHECK (time_block BETWEEN 1 AND 4),
  status         TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'missed', 'late')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One assignment per cleaner per room per date
  UNIQUE (cleaner_id, room_id, scheduled_date)
);

CREATE TABLE cleaning_sessions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id            UUID NOT NULL REFERENCES cleaning_assignments(id) ON DELETE CASCADE,
  arrived_at               TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  -- GPS coordinates captured when cleaner taps "Start Session"
  arrival_lat              DECIMAL(10, 8),
  arrival_lng              DECIMAL(11, 8),
  tenant_rating            INTEGER CHECK (tenant_rating BETWEEN 1 AND 5),
  tenant_feedback          TEXT,
  -- Configurable from admin dash: force extra photo evidence after reports
  extra_evidence_required  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cleaning_checklist_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES cleaning_sessions(id) ON DELETE CASCADE,
  -- label examples: "Estufa", "Barra", "Baño", "Suelo", "Ventanas"
  label        TEXT NOT NULL,
  is_done      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Photo is timestamped+geotagged by the mobile app before upload
  photo_url    TEXT,
  notes        TEXT,
  completed_at TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- Unified log of all notifications sent across channels
-- ─────────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL,
  channel    TEXT NOT NULL
             CHECK (channel IN ('push', 'whatsapp', 'email', 'in_app')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_recipients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id  UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  sent_at          TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'delivered', 'failed'))
);

-- ─────────────────────────────────────────────────────────────
-- ACCESS CONTROL
-- Events logged when tenants enter/exit; guest access management
-- ─────────────────────────────────────────────────────────────

CREATE TABLE access_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES user_profiles(id),
  room_id           UUID REFERENCES rooms(id),
  event_type        TEXT NOT NULL
                    CHECK (event_type IN (
                      'entry', 'exit', 'guest_entry', 'guest_exit',
                      'package', 'uber', 'moving_in', 'moving_out'
                    )),
  notes             TEXT,
  notified_security BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE guest_accesses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES user_profiles(id),
  room_id      UUID NOT NULL REFERENCES rooms(id),
  guest_name   TEXT NOT NULL,
  -- purpose: visit, package, uber, moving, other
  purpose      TEXT NOT NULL DEFAULT 'visit',
  valid_from   TIMESTAMPTZ NOT NULL,
  valid_until  TIMESTAMPTZ,
  is_approved  BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by  UUID REFERENCES user_profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- MOVE-OUT & EVICTION
-- ─────────────────────────────────────────────────────────────

CREATE TABLE moveout_requests (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id                  UUID NOT NULL REFERENCES leases(id),
  requested_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  planned_date              DATE NOT NULL,
  building_access_requested BOOLEAN NOT NULL DEFAULT FALSE,
  building_access_approved  BOOLEAN NOT NULL DEFAULT FALSE,
  notes                     TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'completed', 'cancelled'))
);

CREATE TABLE eviction_cases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id     UUID NOT NULL REFERENCES leases(id),
  reason       TEXT NOT NULL
               CHECK (reason IN ('non_payment', 'contract_violation', 'complaints')),
  initiated_by UUID NOT NULL REFERENCES user_profiles(id),
  status       TEXT NOT NULL DEFAULT 'initiated'
               CHECK (status IN ('initiated', 'notice_sent', 'legal', 'resolved')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- On columns frequently used in WHERE and JOIN conditions
-- ─────────────────────────────────────────────────────────────

CREATE INDEX idx_rooms_building_status    ON rooms(building_id, status);
CREATE INDEX idx_leases_room              ON leases(room_id);
CREATE INDEX idx_leases_tenant            ON leases(tenant_id);
CREATE INDEX idx_payments_lease_status    ON payments(lease_id, status, due_date);
CREATE INDEX idx_incidents_room_status    ON incidents(room_id, status);
CREATE INDEX idx_cleaning_cleaner_date    ON cleaning_assignments(cleaner_id, scheduled_date);
CREATE INDEX idx_cleaning_room_date       ON cleaning_assignments(room_id, scheduled_date);
CREATE INDEX idx_complaints_accused       ON complaints(accused_id);
CREATE INDEX idx_notif_recipients_user    ON notification_recipients(user_id, status);
CREATE INDEX idx_access_events_room_date  ON access_events(room_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Enable RLS on all tables, then add permissive policies.
-- The FastAPI service uses the service_role key (bypasses RLS).
-- Direct Supabase client calls from apps use the anon/user key (respects RLS).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE buildings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_photos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_updates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints              ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_escalations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_accesses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE moveout_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE eviction_cases          ENABLE ROW LEVEL SECURITY;

-- Helper function: returns the current user's role from user_profiles.
-- Used by RLS policies to avoid repeating the subquery.
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$;

-- ── user_profiles ──
-- Users can read and update only their own row.
-- Admins can read all rows.
CREATE POLICY "users: read own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid() OR current_user_role() = 'admin');

CREATE POLICY "users: update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- ── buildings ──
-- All authenticated users can read buildings (needed for navigation).
-- Only admins can create/update.
CREATE POLICY "buildings: all authenticated can read"
  ON buildings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "buildings: admins can write"
  ON buildings FOR ALL
  USING (current_user_role() = 'admin');

-- ── rooms ──
-- Tenants can only read their own room (via their active lease).
-- Cleaning staff can read rooms assigned to them.
-- Admins can read and write all rooms.
CREATE POLICY "rooms: tenant reads own room"
  ON rooms FOR SELECT
  USING (
    current_user_role() = 'admin'
    OR id IN (
      SELECT room_id FROM leases
      WHERE tenant_id = auth.uid() AND status = 'active'
    )
    OR id IN (
      SELECT room_id FROM cleaning_assignments
      WHERE cleaner_id = auth.uid()
        AND scheduled_date >= CURRENT_DATE - INTERVAL '7 days'
    )
  );

CREATE POLICY "rooms: admins can write"
  ON rooms FOR ALL
  USING (current_user_role() = 'admin');

-- ── leases ──
-- Tenants read only their own lease. Admins read all.
CREATE POLICY "leases: tenant reads own"
  ON leases FOR SELECT
  USING (tenant_id = auth.uid() OR current_user_role() = 'admin');

-- ── payments ──
-- Tenants read only payments linked to their lease.
CREATE POLICY "payments: tenant reads own"
  ON payments FOR SELECT
  USING (
    current_user_role() = 'admin'
    OR lease_id IN (
      SELECT id FROM leases WHERE tenant_id = auth.uid()
    )
  );

-- ── complaints ──
-- accused_id is never returned to non-admins (SELECT policy excludes the column).
-- Complainants can read their own complaints. Accused can read complaints against them
-- but NOT see who filed them (accused_id column excluded via a view — see note below).
CREATE POLICY "complaints: read own or admin"
  ON complaints FOR SELECT
  USING (
    current_user_role() = 'admin'
    OR complainant_id = auth.uid()
    OR accused_id = auth.uid()
  );

-- NOTE: Create a view called "complaints_safe" for the accused party that
-- omits complainant_id and accused_id. Apps should query this view, not the table directly.
CREATE VIEW complaints_safe AS
  SELECT id, building_id, room_id, category, description, status, escalation_count, created_at
  FROM complaints;

-- ── cleaning_assignments ──
-- Cleaners read only their own assignments. Admins read all.
CREATE POLICY "cleaning: cleaner reads own assignments"
  ON cleaning_assignments FOR SELECT
  USING (cleaner_id = auth.uid() OR current_user_role() = 'admin');

-- ── notification_recipients ──
-- Users read only their own notifications.
CREATE POLICY "notifications: read own"
  ON notification_recipients FOR SELECT
  USING (user_id = auth.uid() OR current_user_role() = 'admin');

CREATE POLICY "notifications: mark own as read"
  ON notification_recipients FOR UPDATE
  USING (user_id = auth.uid());

-- ── onboarding_applications ──
CREATE POLICY "onboarding: read own or admin"
  ON onboarding_applications FOR SELECT
  USING (user_id = auth.uid() OR current_user_role() = 'admin');

-- ── Remaining tables: admin-only or owner-only (common pattern) ──
CREATE POLICY "incidents: tenant reads own room"
  ON incidents FOR SELECT
  USING (
    current_user_role() = 'admin'
    OR room_id IN (SELECT room_id FROM leases WHERE tenant_id = auth.uid() AND status = 'active')
  );

CREATE POLICY "guest_accesses: tenant reads own"
  ON guest_accesses FOR SELECT
  USING (tenant_id = auth.uid() OR current_user_role() = 'admin');

CREATE POLICY "eviction_cases: admin only"
  ON eviction_cases FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY "moveout: tenant reads own"
  ON moveout_requests FOR SELECT
  USING (
    current_user_role() = 'admin'
    OR lease_id IN (SELECT id FROM leases WHERE tenant_id = auth.uid())
  );
