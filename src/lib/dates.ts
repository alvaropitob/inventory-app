export const BUSINESS_TIME_ZONE = "America/Bogota";

export function getDateKeyInBusinessTimeZone(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const getPart = (type: "year" | "month" | "day") => parts.find(part => part.type === type)?.value || "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

export function getYearMonthInBusinessTimeZone(value: Date = new Date()): string {
  return getDateKeyInBusinessTimeZone(value).slice(0, 7);
}

export function getYearInBusinessTimeZone(value: Date = new Date()): number {
  return Number(getDateKeyInBusinessTimeZone(value).slice(0, 4));
}

export function getDaysUntilDateKey(dateKey: string, today: Date = new Date()): number {
  const targetDay = Date.parse(`${dateKey}T00:00:00Z`);
  const currentDay = Date.parse(`${getDateKeyInBusinessTimeZone(today)}T00:00:00Z`);
  return Math.round((targetDay - currentDay) / 86_400_000);
}

export function isValidDateKey(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const timestamp = Date.parse(`${dateKey}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === dateKey;
}

export function formatDateKeyInBusinessTimeZone(dateKey?: string | null): string {
  if (!dateKey || !isValidDateKey(dateKey.slice(0, 10))) return "N/A";
  return new Date(`${dateKey.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", {
    timeZone: BUSINESS_TIME_ZONE,
  });
}
