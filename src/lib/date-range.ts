import { isCalendarDate } from "./travel-calendar";

export function editableDate(value: string): string {
  return isCalendarDate(value) ? value.split("-").reverse().join(".") : value;
}
export function parseEditableDate(value: string): string {
  const parts = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  const date = parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : value.trim();
  return isCalendarDate(date) ? date : "";
}
export function dateRangeDays(start: string, end: string): number | null {
  if (!isCalendarDate(start) || !isCalendarDate(end) || end < start) return null;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}
export function rangeError(start: string, end: string, today: string): string {
  const days = dateRangeDays(start, end);
  if (days === null) return "Выберите начало и конец поездки.";
  if (start < today) return "Выберите сегодняшнюю или будущую дату.";
  return days < 5 || days > 28 ? "Для первой версии выберите поездку от 5 до 28 дней." : "";
}
export const moscowToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function shiftMonth(date: string, delta: number): string {
  const source = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  source.setUTCMonth(source.getUTCMonth() + delta);
  return source.toISOString().slice(0, 10);
}
export function monthCells(month: string): (string | null)[] {
  const first = new Date(`${month.slice(0, 7)}-01T12:00:00Z`), lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`)];
}
