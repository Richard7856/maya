import type { TimeBlock } from "@maya/types";

// ─────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────

/** Returns true if today's date is on or after the given day of the month.
 *  Used to determine whether the app-lock threshold (day 11) has been crossed. */
export function isDayOfMonthReached(dayOfMonth: number): boolean {
  return new Date().getDate() >= dayOfMonth;
}

/** Format ISO date string to "DD/MM/YYYY" for display in Mexican locale. */
export function formatDateMX(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Returns the number of days until a due date. Negative = overdue. */
export function daysUntil(isoDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(isoDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────
// Cleaning time block helpers
// ─────────────────────────────────────────

const TIME_BLOCK_START_HOURS: Record<TimeBlock, number> = {
  1: 8,
  2: 10,
  3: 12,
  4: 14,
};

/** Returns the wall-clock label for a time block, e.g. "8:00 – 10:00". */
export function timeBlockLabel(block: TimeBlock): string {
  const start = TIME_BLOCK_START_HOURS[block];
  return `${start}:00 – ${start + 2}:00`;
}

/** Returns a Date for when a time block starts on a given date (YYYY-MM-DD). */
export function timeBlockStartDate(date: string, block: TimeBlock): Date {
  const d = new Date(date);
  d.setHours(TIME_BLOCK_START_HOURS[block], 0, 0, 0);
  return d;
}

// ─────────────────────────────────────────
// Currency
// ─────────────────────────────────────────

/** Format a number as Mexican Pesos, e.g. "$4,500.00 MXN". */
export function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

// ─────────────────────────────────────────
// String helpers
// ─────────────────────────────────────────

/** Returns "Nombre Apellido" from a profile object. */
export function fullName(profile: {
  first_name: string;
  last_name: string;
}): string {
  return `${profile.first_name} ${profile.last_name}`.trim();
}
