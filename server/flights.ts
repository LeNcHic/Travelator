import { cityIds, cities } from "../src/data/catalog.ts";
import { chinaDateTime, parseFlyaiPrice } from "../shared/flyai.ts";
import { validFlightQuote, type FlightOffer, type FlightQuery, type FlightQuote, type FlightResult } from "../shared/flights.ts";
import { runFlyaiCommand, safeFlyaiUrl } from "./flyai.ts";
import { HotelApiError } from "./hotels.ts";

const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown, limit = 250) => typeof v === "string" ? v.trim().slice(0, limit) : "";
export function validateFlightQuery(value: unknown, now = new Date()): FlightQuery {
  const v = object(value), today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now);
  const time = typeof v.date === "string" ? Date.parse(`${v.date}T00:00:00Z`) : NaN;
  if (!cityIds.includes(v.from as never) || !cityIds.includes(v.to as never) || v.from === v.to
    || typeof v.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.date) || !Number.isFinite(time)
    || new Date(time).toISOString().slice(0, 10) !== v.date || v.date < today || time >= Date.parse(today) + 365 * 86400000)
    throw new HotelApiError(400, "INVALID_FLIGHT_QUERY", "Выберите разные города и будущую дату вылета в пределах года.");
  return { from: v.from as FlightQuery["from"], to: v.to as FlightQuery["to"], date: v.date };
}
export const flightArgs = (query: FlightQuery) => ["search-flight", "--origin", cities[query.from].cn, "--destination", cities[query.to].cn, "--dep-date", query.date, "--journey-type", "1", "--seat-class-name", "economy", "--sort-type", "3"];

export function normalizeFlights(raw: unknown, query: FlightQuery, now = new Date(), authenticated = false): FlightResult {
  const root = object(raw), items = object(root.data).itemList;
  if (root.status !== 0 || !Array.isArray(items)) throw new HotelApiError(502, "FLIGHTS_BAD_RESPONSE", "Не удалось разобрать выдачу авиабилетов. Повторите поиск позже.");
  const offers: FlightOffer[] = [];
  for (const value of items.slice(0, 20)) {
    const item = object(value), journeys = item.journeys;
    if (!Array.isArray(journeys) || journeys.length !== 1) continue;
    const segments = object(journeys[0]).segments;
    if (!Array.isArray(segments) || segments.length !== 1) continue;
    const segment = object(segments[0]);
    if (text(segment.transportType) !== "飞机" || text(segment.depCityName).replace(/市$/, "") !== cities[query.from].cn
      || text(segment.arrCityName).replace(/市$/, "") !== cities[query.to].cn) continue;
    const departure = text(segment.depDateTime, 19), arrival = text(segment.arrDateTime, 19);
    if (!departure.startsWith(query.date + " ")) continue;
    const cabin = ({ "经济舱": "economy", "商务舱": "business", "头等舱": "first" } as Record<string, FlightQuote["cabin"]>)[text(segment.seatClassName)] ?? null;
    const flightNumber = text(segment.marketingTransportNo, 10), amount = parseFlyaiPrice(text(item.ticketPrice, 40));
    const quote = { source: "flyai", from: query.from, to: query.to, flightNumber, airlineCode: flightNumber.slice(0, 2), fromAirport: text(segment.depStationCode, 3), toAirport: text(segment.arrStationCode, 3), cabin,
      departure, arrival, minutes: Number(item.totalDuration), amount, currency: "CNY", priceBasis: "passenger_search_fare", searchedAt: now.toISOString() };
    if (!authenticated || !validFlightQuote(quote) || chinaDateTime(arrival)! <= chinaDateTime(departure)!) continue;
    offers.push({ quote, url: safeFlyaiUrl(item.jumpUrl) });
  }
  if (items.length && !offers.length && authenticated) throw new HotelApiError(502, "FLIGHTS_NO_VALID_FARES", "В выдаче нет полных тарифов и корректных прямых рейсов. Маскированные цены в расчёт не добавляем.");
  return { source: "flyai", query, searchedAt: now.toISOString(), access: authenticated ? "personal_key" : "trial", limited: !authenticated || offers.length < items.length, offers };
}
export function createFlightSearch(run = runFlyaiCommand, clock = () => new Date(), apiKey?: string) {
  const cache = new Map<string, { expires: number; result: FlightResult }>(), pending = new Map<string, Promise<FlightResult>>();
  return async (value: unknown): Promise<FlightResult> => {
    const query = validateFlightQuery(value, clock()), key = JSON.stringify(query), now = clock().getTime();
    for (const [id, item] of cache) if (item.expires <= now) cache.delete(id);
    if (cache.has(key)) return cache.get(key)!.result;
    if (pending.has(key)) return pending.get(key)!;
    if (pending.size >= 2) throw new HotelApiError(429, "FLIGHTS_BUSY", "Уже ищем авиабилеты. Повторите через несколько секунд.");
    const promise = run(flightArgs(query), apiKey).then(raw => {
      const result = normalizeFlights(raw, query, clock(), Boolean(apiKey?.trim()));
      if (cache.size >= 30) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: clock().getTime() + 120000, result }); return result;
    }).finally(() => pending.delete(key));
    pending.set(key, promise); return promise;
  };
}
