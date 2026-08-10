/**
 * Date helpers. Everything the app stores is a *local calendar day* string
 * (`YYYY-MM-DD`), never a UTC timestamp — a coffee bought at 11pm in Bangkok
 * belongs to that day, not to tomorrow in UTC.
 */

export function todayISO(d: Date = new Date()): string {
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse `YYYY-MM-DD` as local midnight (not UTC — `new Date(str)` is UTC). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth() + months, 1);
  return out;
}

export function isoMonthStart(d: Date): string {
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function daysBetween(a: Date, b: Date): number {
  const ms = fromISODate(toISODate(b)).getTime() - fromISODate(toISODate(a)).getTime();
  return Math.round(ms / 86_400_000);
}

export function startOfMonthISO(d: Date = new Date()): string {
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Average days in a month — used to normalise daily rates to monthly. */
export const DAYS_PER_MONTH = 30.44;

/** Days left in the current calendar month, including today. */
export function daysLeftInMonth(d: Date = new Date()): number {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return last - d.getDate() + 1;
}

/** Days until the next payday (1–31), wrapping to next month. */
export function daysUntilPayday(payday: number, d: Date = new Date()): number {
  const lastDayThisMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const target = Math.min(payday, lastDayThisMonth);
  if (target >= d.getDate()) return target - d.getDate();
  const lastDayNextMonth = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate();
  const nextTarget = Math.min(payday, lastDayNextMonth);
  const next = new Date(d.getFullYear(), d.getMonth() + 1, nextTarget);
  return daysBetween(d, next);
}
