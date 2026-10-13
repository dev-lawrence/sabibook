// Dates are plain "YYYY-MM-DD" strings in the trader's LOCAL time zone.
// Never use toISOString() for these, it converts to UTC and shifts the day.

const pad = (n: number) => String(n).padStart(2, "0");

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses "YYYY-MM-DD" as a local date at noon, which dodges daylight saving edges. */
function fromISO(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Today's date on the trader's device. */
export function todayISO(): string {
  return toISO(new Date());
}

/** Moves a date forwards (positive) or backwards (negative) by whole days. */
export function shiftISO(date: string, days: number): string {
  const d = fromISO(date);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** "Today", "Yesterday", or "Mon 12 Oct". */
export function formatDayLabel(date: string): string {
  const today = todayISO();
  if (date === today) return "Today";
  if (date === shiftISO(today, -1)) return "Yesterday";
  const d = fromISO(date);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  return `${weekday} ${d.getDate()} ${month}`;
}
