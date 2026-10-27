export const money = (value: number) =>
  `¥ ${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}`;
export const plural = (n: number, forms: [string, string, string]) =>
  n % 10 === 1 && n % 100 !== 11
    ? forms[0]
    : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)
      ? forms[1]
      : forms[2];
export const daysText = (n: number) =>
  `${n} ${plural(n, ["день", "дня", "дней"])}`;
export const nightsText = (n: number) =>
  `${n} ${plural(n, ["ночь", "ночи", "ночей"])}`;
export const duration = (minutes: number) =>
  minutes < 60
    ? `${minutes} мин`
    : `${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ""}`;
export const clockTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addDays(date: string, count: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + count);
  return isoDate(d);
}
export const displayDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
