import { cities, cityIds, ticketsBetween } from "../src/data/catalog.ts";
import type { CityId } from "../src/types.ts";
import { addDays } from "../src/lib/format.ts";
import { chinaDateTime, validTrainQuote, type RailgoTrainQuote } from "../shared/flyai.ts";
import { SHORT_TRAIN_MINUTES, type RailgoQuery, type RailgoResult } from "../shared/railgo.ts";
import { HotelApiError } from "./hotels.ts";
import stationDirectory from "../shared/rail-stations.json";

const stationCodes: Partial<Record<CityId, string>> = { ...Object.fromEntries(Object.entries(stationDirectory.records).map(([id,record]) => [id,record.code])), sha: "SHH", bei: "BJP", zjj: "DIQ", gui: "GLZ", san: "SEQ", han: "HZH", qin: "QDK", xmn: "XMS", bha: "BHZ", che: "CDW", xan: "XAY", hua: "HKH" };
// Same-city searches also return remote suburban stops. Keep stations serving our bases.
const stationNames: Partial<Record<CityId, string[]>> = {
  ...Object.fromEntries(Object.entries(stationDirectory.records).map(([id,record]) => [id,record.stations])),
  qin: ["青岛", "青岛北", "青岛西"], xmn: ["厦门", "厦门北"], bha: ["北海"],
  che: ["成都", "成都东", "成都西", "成都南"], xan: ["西安", "西安北", "西安东"], hua: ["黄山", "黄山北"],
  sha: ["上海", "上海虹桥", "上海南", "上海西"], han: ["杭州", "杭州东", "杭州南", "杭州西"],
  bei: ["北京", "北京南", "北京西", "北京北", "北京朝阳", "北京丰台", "清河"],
  gui: ["桂林", "桂林北", "桂林西"], zjj: ["张家界", "张家界西"], san: ["三亚", "亚龙湾"],
};
const endpoint = "https://data.railgo.zenglingkun.cn/api/train/sts_query";
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown, max = 250) => typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : "";
const time = (v: unknown): v is string => typeof v === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
const day = (v: unknown): v is number => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 7;

export function validateRailgoQuery(value: unknown, now = new Date()): RailgoQuery {
  const q = object(value), date = q.date;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now);
  const stamp = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
  if (!cityIds.includes(q.from as CityId) || !cityIds.includes(q.to as CityId) || q.from === q.to
    || !Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== date
    || date! < today || stamp >= Date.parse(today) + 180 * 86400000) {
    throw new HotelApiError(400, "INVALID_RAILGO_QUERY", "Проверьте города и дату поезда: поиск доступен в пределах ближайших 180 дней, если расписание опубликовано.");
  }
  return { from: q.from as CityId, to: q.to as CityId, date: date as string };
}

/** Skip clearly remote pairs; actual eligibility always comes from the timetable. */
export function couldHaveShortTrain(from: CityId, to: CityId): boolean {
  const [a, b] = [cities[from].point, cities[to].point];
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return from !== to && 12742 * Math.asin(Math.min(1, Math.sqrt(h))) <= 750;
}

export function normalizeRailgo(raw: unknown, query: RailgoQuery, now = new Date()): RailgoResult {
  if (!Array.isArray(raw) || raw.length > 3000) throw new HotelApiError(502, "RAILGO_BAD_RESPONSE", "RailGo вернул неподдерживаемый формат расписания.");
  const trains: RailgoTrainQuote[] = [];
  const amount = ticketsBetween(query.from, query.to).find(t => t.mode === "train")?.price;
  for (const value of raw) {
    const row = object(value);
    if (!Array.isArray(row.timetable) || !Array.isArray(row.rundays) || !amount) continue;
    const timetable = row.timetable.map(object);
    const fromIndex = timetable.findIndex(stop => stop.stationTelecode === row.fromStationTelecode && stop.depart === row.fromDepart);
    const toIndex = timetable.findIndex((stop, index) => index > fromIndex && stop.stationTelecode === row.toStationTelecode && stop.arrive === row.toArrive);
    if (fromIndex < 0 || toIndex < 0) continue;
    const from = timetable[fromIndex], to = timetable[toIndex];
    if (!stationNames[query.from]?.includes(String(from.station)) || !stationNames[query.to]?.includes(String(to.station))) continue;
    if (!day(from.day) || !day(to.day) || !time(from.depart) || !time(to.arrive) || to.day < from.day) continue;
    // Operating days refer to departure from the train's original starting station.
    const originDate = addDays(query.date, -from.day).replaceAll("-", "");
    if (!row.rundays.includes(originDate)) continue;
    const arrivalDate = addDays(query.date, to.day - from.day);
    const departure = `${query.date} ${from.depart}:00`, arrival = `${arrivalDate} ${to.arrive}:00`;
    const dep = chinaDateTime(departure), arr = chinaDateTime(arrival);
    if (dep === null || arr === null) continue;
    const minutes = (arr - dep) / 60000;
    const quote: RailgoTrainQuote = { source: "railgo", from: query.from, to: query.to, trainNumber: text(row.number, 40),
      fromStation: text(from.station), toStation: text(to.station), seatClass: "Класс и наличие мест не указаны",
      departure, arrival, minutes, amount, currency: "CNY", priceBasis: "catalogue_estimate", searchedAt: now.toISOString() };
    if (minutes <= SHORT_TRAIN_MINUTES && validTrainQuote(quote)) trains.push(quote);
  }
  const unique = [...new Map(trains.map(t => [JSON.stringify([t.trainNumber, t.departure, t.fromStation, t.toStation]), t])).values()];
  unique.sort((a, b) => a.minutes - b.minutes || a.departure.localeCompare(b.departure) || a.trainNumber.localeCompare(b.trainNumber));
  return { source: "railgo", query, searchedAt: now.toISOString(), maxMinutes: 120, trains: unique };
}

async function readRailgo(query: RailgoQuery): Promise<unknown> {
  if (!stationCodes[query.from] || !stationCodes[query.to]) throw new HotelApiError(503, "UNMAPPED_STATION", "Для этого нового направления ещё не проверены станции RailGo. Используйте предварительную оценку переезда.");
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ from: stationCodes[query.from]!, to: stationCodes[query.to]!, date: query.date.replaceAll("-", ""), city: "true" }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "error", headers: { Accept: "application/json" } });
    if (!response.ok || !response.body) throw new Error("Unavailable");
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 8 * 1024 * 1024) throw new Error("Too large");
        chunks.push(part.value);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { throw new HotelApiError(502, "RAILGO_UNAVAILABLE", "Сервис расписаний RailGo сейчас недоступен. Это не означает, что поездов нет. Повторите поиск позже."); }
}

export function createRailgoSearch(run = readRailgo, clock = () => new Date()) {
  const cache = new Map<string, { until: number; result: RailgoResult }>();
  const pending = new Map<string, Promise<RailgoResult>>();
  return async (value: unknown): Promise<RailgoResult> => {
    const query = validateRailgoQuery(value, clock()), key = JSON.stringify(query);
    for (const [k, entry] of cache) if (entry.until <= clock().getTime()) cache.delete(k);
    const hit = cache.get(key);
    if (hit) return hit.result;
    if (pending.has(key)) return pending.get(key)!;
    if (pending.size >= 2) throw new HotelApiError(429, "RAILGO_BUSY", "Дождитесь завершения поиска поездов.");
    const promise = run(query).then(raw => {
      const result = normalizeRailgo(raw, query, clock());
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { until: clock().getTime() + 10 * 60000, result });
      return result;
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}
