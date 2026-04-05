// Core domain enums — mirrors the CHECK constraints in the database schema.
// Always keep in sync with supabase/migrations/001_initial_schema.sql.

export type RoomStatus = "vacant" | "occupied" | "incoming" | "maintenance";

export type UserRole = "admin" | "tenant" | "cleaning" | "security";

export type OnboardingStatus =
  | "step_1"
  | "step_2"
  | "step_3"
  | "complete"
  | "rejected";

export type LeaseStatus = "active" | "ending" | "terminated" | "eviction";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "overdue"
  | "partial"
  | "waived";

// time_block: 1 = 8–10, 2 = 10–12, 3 = 12–14, 4 = 14–16
export type TimeBlock = 1 | 2 | 3 | 4;

export const TIME_BLOCK_LABELS: Record<TimeBlock, string> = {
  1: "8:00 – 10:00",
  2: "10:00 – 12:00",
  3: "12:00 – 14:00",
  4: "14:00 – 16:00",
};

export type CleaningAssignmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "missed"
  | "late";

export type IncidentCategory =
  | "plumbing"
  | "electrical"
  | "structural"
  | "appliance"
  | "other";

export type IncidentPriority = "low" | "medium" | "high" | "urgent";

export type IncidentStatus = "open" | "in_progress" | "resolved" | "closed";

export type IncidentPhotoType = "before" | "after" | "during";

export type ComplaintStatus =
  | "open"
  | "under_review"
  | "resolved"
  | "appealed"
  | "dismissed";

// Complaint escalation level:
// 1 = warning + rules reminder
// 2 = warning + fine generated
// 3 = formal notice
// 4 = formal notice + economic sanction
// 5 = removal process initiated
export type ComplaintEscalationLevel = 1 | 2 | 3 | 4 | 5;

export type TicketType = "cleaning" | "maintenance";

export type TicketStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed";

export type NotificationChannel = "push" | "whatsapp" | "email" | "in_app";

export type NotificationStatus = "pending" | "sent" | "delivered" | "failed";

export type AccessEventType =
  | "entry"
  | "exit"
  | "guest_entry"
  | "guest_exit"
  | "package"
  | "uber"
  | "moving_in"
  | "moving_out";

export type MoveoutStatus = "pending" | "approved" | "completed" | "cancelled";

export type EvictionReason =
  | "non_payment"
  | "contract_violation"
  | "complaints";

export type EvictionStatus = "initiated" | "notice_sent" | "legal" | "resolved";

// ─────────────────────────────────────────
// API response shapes (used by api-client package)
// ─────────────────────────────────────────

export interface ApiError {
  detail: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

// ─────────────────────────────────────────
// Domain DTOs — mirrors DB rows for safe client use.
// Do NOT include access_code_encrypted or accused_id here.
// Those are controlled server-side per RLS rules.
// ─────────────────────────────────────────

export interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
  created_at: string;
}

export interface Room {
  id: string;
  building_id: string;
  room_number: string;
  section: string | null;
  status: RoomStatus;
  monthly_rate: number;
  floor_plan_url: string | null;
  amenities: Record<string, unknown>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string | null;
  rfc: string | null;
  is_active: boolean;
  // expo_push_token is write-only from client, never read back
}

export interface Lease {
  id: string;
  room_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  monthly_rate: number;
  payment_day: number;
  status: LeaseStatus;
  contract_url: string | null;
  wifi_password: string | null;
  // access_code: returned only by /payments/mine/access-code when paid
}

export interface Payment {
  id: string;
  lease_id: string;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  receipt_url: string | null;
}

export interface CleaningAssignment {
  id: string;
  cleaner_id: string;
  room_id: string;
  scheduled_date: string;
  time_block: TimeBlock;
  status: CleaningAssignmentStatus;
}

export interface CleaningSession {
  id: string;
  assignment_id: string;
  arrived_at: string | null;
  completed_at: string | null;
  arrival_lat: number | null;
  arrival_lng: number | null;
  tenant_rating: number | null;
  tenant_feedback: string | null;
  extra_evidence_required: boolean;
}

export interface CleaningChecklistItem {
  id: string;
  session_id: string;
  label: string;
  is_done: boolean;
  photo_url: string | null;
  notes: string | null;
  completed_at: string | null;
}

export interface Incident {
  id: string;
  room_id: string;
  reported_by: string;
  assigned_to: string | null;
  title: string;
  description: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  repair_cost: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Complaint {
  id: string;
  building_id: string;
  complainant_id: string;
  // accused_id intentionally omitted — server filters per RLS
  category: string;
  description: string;
  is_anonymous: boolean;
  status: ComplaintStatus;
  escalation_count: number;
  created_at: string;
}

export interface Ticket {
  id: string;
  room_id: string;
  created_by: string;
  assigned_to: string | null;
  type: TicketType;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: IncidentPriority;
  due_date: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  sent_at: string | null;
  read_at: string | null;
  status: NotificationStatus;
}
