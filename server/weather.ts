import { cities } from "../src/data/catalog.ts";
import { attractionsIn } from "../src/data/attractions.ts";
import { baseCatalog } from "../src/data/destination-catalog.ts";
import { validEventDate } from "../shared/events.ts";
import type { CityId } from "../shared/cities.ts";
import type { WeatherDay, WeatherQuery, WeatherResult } from "../shared/weather.ts";
import { HotelApiError } from "./hotels.ts";

const DAY = 86400000, dayIso = (time: number) => new Date(time).toISOString().slice(0,10);
const number = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) ? v : null;
type Meteo = { daily?: Record<string, (string | number | null)[]>; hourly?: Record<string, (string | number | null)[]> };
export function validateWeatherQuery(value: unknown): WeatherQuery {
  const q = value as WeatherQuery;
  if (!q || !Array.isArray(q.cities) || !q.cities.length || q.cities.length > 20 || new Set(q.cities).size !== q.cities.length
    || !q.cities.every(city => baseCatalog[city]?.status === "published") || !validEventDate(q.start) || !validEventDate(q.end)
    || q.start > q.end || Date.parse(q.end) - Date.parse(q.start) >= 28 * DAY)
    throw new HotelApiError(400, "INVALID_WEATHER_QUERY", "Проверьте города и срок: погода доступна для 1–20 баз и поездки до 28 дней.");
  return { cities: [...q.cities], start: q.start, end: q.end };
}
export function weatherPoint(city: CityId) {
  const outdoor = cities[city].interest === "nature" ? attractionsIn(city).filter(place => ["Природа", "Горы"].includes(place.category)).sort((a,b) => b.minutes - a.minutes)[0] : undefined;
  const point = outdoor?.point ?? cities[city].point;
  return { city, label: outdoor ? outdoor.name + " · примерная точка" : cities[city].name + " · район базы", longitude: point[0], latitude: point[1], timezone: baseCatalog[city].timezone };
}
export function normalizeMeteo(data: Meteo, city: CityId, kind: "forecast" | "historical", updatedAt: string): WeatherDay[] {
  const daily = data?.daily;
  if (!Array.isArray(daily?.time)) throw new Error("Нет дневных данных");
  return daily.time.flatMap((date, i) => {
    if (!validEventDate(date)) return [];
    const visibility = (data.hourly?.time ?? []).flatMap((hour,j) => typeof hour === "string" && hour.startsWith(date) && Number(hour.slice(11,13)) >= 9 && Number(hour.slice(11,13)) <= 18
      && number(data.hourly?.visibility?.[j]) !== null ? [Number(data.hourly!.visibility![j]) / 1000] : []);
    const high = number(daily.temperature_2m_max?.[i]), low = number(daily.temperature_2m_min?.[i]);
    const rainMm = number(daily.precipitation_sum?.[i]), windKmh = number(daily.wind_speed_10m_max?.[i]);
    if (high !== null && (high < -90 || high > 65) || low !== null && (low < -90 || low > 65) || high !== null && low !== null && low > high
      || rainMm !== null && (rainMm < 0 || rainMm > 2000) || windKmh !== null && (windKmh < 0 || windKmh > 500)) return [];
    const chance = number(daily.precipitation_probability_max?.[i]);
    return [{ city, date, kind: high === null && rainMm === null && windKmh === null ? "unknown" as const : kind,
      high, low, rainMm, windKmh, visibilityKm: visibility.length ? visibility.reduce((a,b) => a+b,0) / visibility.length : null,
      rainChance: chance !== null && chance >= 0 && chance <= 100 ? chance : null, samples: 1, updatedAt }];
  });
}
/** Three complete reference years; a ±7 day window smooths individual historical days. */
export function seasonalDay(history: WeatherDay[], city: CityId, date: string, updatedAt: string): WeatherDay {
  const reference = Date.parse("2000-" + date.slice(5));
  const samples = history.filter(day => {
    const gap = Math.abs(Date.parse("2000-" + day.date.slice(5)) - reference) / DAY;
    return Math.min(gap, 366 - gap) <= 7 && day.high !== null && day.rainMm !== null && day.windKmh !== null;
  });
  const average = (key: "high" | "low" | "rainMm" | "windKmh") => {
    const values = samples.flatMap(day => day[key] === null ? [] : [day[key]!]);
    return values.length ? Math.round(values.reduce((a,b) => a+b,0) / values.length * 10) / 10 : null;
  };
  const years = [...new Set(samples.map(day => day.date.slice(0,4)))].sort();
  return { city, date, kind: samples.length >= 15 && years.length >= 2 ? "seasonal" : "unknown", high: average("high"), low: average("low"), rainMm: average("rainMm"), windKmh: average("windKmh"), visibilityKm: null,
    rainChance: samples.length ? Math.round(samples.filter(day => day.rainMm! >= 1).length / samples.length * 100) : null,
    samples: samples.length, years: years.join(", "), updatedAt };
}
export function createWeatherSearch(fetcher: typeof fetch = fetch, clock = () => new Date()) {
  const cache = new Map<string, { data: Meteo[]; at: string; expires: number }>();
  const pending = new Map<string, Promise<{ data: Meteo[]; at: string; expires: number }>>();
  async function batch(url: URL, ttl: number) {
    const key = url.toString(), hit = cache.get(key);
    if (hit && hit.expires > clock().getTime()) return hit;
    if (pending.has(key)) return pending.get(key)!;
    const request = (async () => {
      const response = await fetcher(url, { signal: AbortSignal.timeout(20000), redirect: "error", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Open-Meteo не ответил");
      const reader = response.body?.getReader(); if (!reader) throw new Error("Пустой ответ");
      const chunks: Uint8Array[] = []; let size = 0;
      try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 3000000) throw new Error("Слишком большой ответ"); chunks.push(part.value); } }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const body = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
      const entry = { data: (Array.isArray(body) ? body : [body]) as Meteo[], at: clock().toISOString(), expires: clock().getTime() + ttl };
      cache.delete(key); cache.set(key, entry); if (cache.size > 96) cache.delete(cache.keys().next().value!);
      return entry;
    })().finally(() => pending.delete(key));
    pending.set(key, request); return request;
  }
  return async (value: unknown, signal?: AbortSignal): Promise<WeatherResult> => {
    const query = validateWeatherQuery(value), updatedAt = clock().toISOString(), points = query.cities.map(weatherPoint);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: points[0].timezone }).format(clock());
    const lastForecast = dayIso(Date.parse(today) + 15 * DAY), year = Number(today.slice(0,4));
    const dates = Array.from({ length: (Date.parse(query.end) - Date.parse(query.start)) / DAY + 1 }, (_,i) => dayIso(Date.parse(query.start) + i * DAY));
    const days: WeatherDay[] = [], warnings = new Set<string>();
    // Five bases per batch; sequential batches bound parallel work and let cancellation stop later calls.
    for (let offset = 0; offset < points.length; offset += 5) {
      signal?.throwIfAborted();
      const group = points.slice(offset, offset + 5), forecast = new Map<CityId, WeatherDay[]>(), history = new Map<CityId, WeatherDay[]>(), actual = new Map<CityId, WeatherDay[]>();
      const jobs = [
        { needed: dates.some(date => date >= today && date <= lastForecast), host: "https://api.open-meteo.com/v1/forecast", ttl: 3600000, kind: "forecast" as const },
        { needed: dates.some(date => date > lastForecast), host: "https://archive-api.open-meteo.com/v1/archive", ttl: 7 * DAY, kind: "historical" as const },
        { needed: dates.some(date => date < dayIso(Date.parse(today) - 7 * DAY)), host: "https://archive-api.open-meteo.com/v1/archive", ttl: 7 * DAY, kind: "past" as const },
      ];
      await Promise.all(jobs.filter(job => job.needed).map(async job => {
        const url = new URL(job.host);
        url.search = new URLSearchParams({ latitude: group.map(p => p.latitude).join(","), longitude: group.map(p => p.longitude).join(","), timezone: group.map(p => p.timezone).join(","),
          daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max" + (job.kind === "forecast" ? ",precipitation_probability_max" : ""),
          ...(job.kind === "forecast" ? { forecast_days: "16", hourly: "visibility" } : job.kind === "historical" ? { start_date: `${year-3}-01-01`, end_date: `${year-1}-12-31`, models: "era5" }
            : { start_date: query.start, end_date: [query.end, dayIso(Date.parse(today) - 7 * DAY)].sort()[0], models: "era5" }),
        }).toString();
        try {
          const entry = await batch(url, job.ttl); signal?.throwIfAborted();
          if (entry.data.length !== group.length) throw new Error("Неполный список точек");
          group.forEach((p,i) => (job.kind === "forecast" ? forecast : job.kind === "past" ? actual : history).set(p.city, normalizeMeteo(entry.data[i], p.city, job.kind === "forecast" ? "forecast" : "historical", entry.at)));
        } catch (error) { signal?.throwIfAborted(); warnings.add(`${job.kind === "forecast" ? "Прогноз" : "Историческая выборка"} Open-Meteo недоступен для части баз. Отсутствие данных не означает хорошую погоду.`); }
      }));
      signal?.throwIfAborted();
      for (const p of group) for (const date of dates) {
        const exact = forecast.get(p.city)?.find(day => day.date === date) ?? actual.get(p.city)?.find(day => day.date === date);
        days.push(exact ?? (date > lastForecast ? seasonalDay(history.get(p.city) ?? [], p.city, date, history.get(p.city)?.[0]?.updatedAt ?? updatedAt)
          : { city: p.city, date, kind: "unknown", high: null, low: null, rainMm: null, windKmh: null, visibilityKm: null, rainChance: null, samples: 0, updatedAt }));
      }
    }
    return { source: "open_meteo", query, days, updatedAt, points, warnings: [...warnings] };
  };
}
