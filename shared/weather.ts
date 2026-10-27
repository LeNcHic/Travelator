import type { CityId } from "./cities";
export type WeatherKind = "forecast" | "seasonal" | "historical" | "unknown";
export interface WeatherQuery { cities: CityId[]; start: string; end: string }
export interface WeatherDay {
  city: CityId; date: string; kind: WeatherKind;
  high: number | null; low: number | null; rainMm: number | null; windKmh: number | null;
  visibilityKm: number | null; rainChance: number | null;
  samples: number; years?: string; updatedAt: string;
}
export interface WeatherResult {
  source: "open_meteo"; query: WeatherQuery; days: WeatherDay[]; updatedAt: string; warnings: string[];
  points: { city: CityId; label: string; longitude: number; latitude: number; timezone: string }[];
}
export const weatherKindLabel: Record<WeatherKind, string> = { forecast: "Прогноз", seasonal: "Сезонный ориентир", historical: "Исторические данные", unknown: "Нет данных" };
export function isFreshWeather(day: WeatherDay, now = Date.now()) {
  const age = now - Date.parse(day.updatedAt), ttl = day.kind === "forecast" ? 3 * 3600000 : 7 * 86400000;
  return Number.isFinite(age) && age >= -300000 && age <= ttl;
}
/** Transparent planning heuristics, not a calibrated probability or a swimming/safety recommendation. */
export function weatherSuitability(day: WeatherDay, interest: "city" | "nature" | "sea", indoorShare = 0) {
  if (day.kind === "unknown" || day.high === null || day.rainMm === null || day.windKmh === null) return null;
  const heat = interest === "sea" ? day.high < 23 ? (23 - day.high) * 6 : day.high > 34 ? (day.high - 34) * 5 : 0
    : day.high < 8 ? (8 - day.high) * 4 : day.high > 28 ? (day.high - 28) * 5 : 0;
  const rain = Math.min(65, day.rainMm * (interest === "city" ? 2 : 4));
  const wind = Math.max(0, day.windKmh - (interest === "sea" ? 18 : 25)) * (interest === "sea" ? 2 : 1);
  const visibility = interest === "nature" && day.visibilityKm !== null ? Math.max(0, 8 - day.visibilityKm) * 5 : 0;
  const outdoors = Math.max(0, Math.min(100, 100 - heat - rain - wind - visibility));
  return interest === "city" ? outdoors * (1 - Math.min(.7, indoorShare)) + 70 * Math.min(.7, indoorShare)
    : interest === "nature" && day.visibilityKm === null ? Math.min(60, outdoors) : outdoors;
}
