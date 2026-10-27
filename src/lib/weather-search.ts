import { validEventDate } from "../../shared/events";
import type { WeatherDay, WeatherQuery, WeatherResult } from "../../shared/weather";
export function validWeatherResult(value: unknown, query: WeatherQuery): value is WeatherResult {
  const result = value as WeatherResult;
  return result?.source === "open_meteo" && JSON.stringify(result.query) === JSON.stringify(query)
    && Array.isArray(result.days) && result.days.length === query.cities.length * ((Date.parse(query.end)-Date.parse(query.start))/86400000+1)
    && new Set(result.days.map(day => day.city+day.date)).size === result.days.length
    && result.days.every(day => query.cities.includes(day.city) && validEventDate(day.date) && day.date >= query.start && day.date <= query.end
      && ["forecast","seasonal","historical","unknown"].includes(day.kind)
      && [day.high,day.low,day.rainMm,day.windKmh,day.visibilityKm,day.rainChance].every(v => v === null || typeof v === "number" && Number.isFinite(v))
      && Number.isInteger(day.samples) && day.samples >= 0 && Number.isFinite(Date.parse(day.updatedAt)))
    && Array.isArray(result.points) && result.points.every(p => query.cities.includes(p.city) && typeof p.label === "string" && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && typeof p.timezone === "string")
    && Array.isArray(result.warnings) && result.warnings.every(w => typeof w === "string") && Number.isFinite(Date.parse(result.updatedAt));
}
export async function searchWeather(query: WeatherQuery, signal: AbortSignal): Promise<WeatherResult> {
  const response = await fetch("/api/weather/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query), signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message || "Погодный сервис сейчас недоступен.");
  if (!validWeatherResult(result,query)) throw new Error("Погода вернулась с неполными данными. Маршрут остаётся предварительным.");
  return result;
}
export const weatherCoverage = (days: WeatherDay[]) => ({ forecast: days.filter(d => d.kind === "forecast").length, seasonal: days.filter(d => d.kind === "seasonal").length, historical: days.filter(d => d.kind === "historical").length, unknown: days.filter(d => d.kind === "unknown").length });
