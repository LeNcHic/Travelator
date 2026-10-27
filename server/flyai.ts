import { spawn } from "node:child_process";
import { mkdtemp, open, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { cities, cityIds } from "../src/data/catalog.ts";
import type { CityId } from "../src/types.ts";
import type { FlyaiQuery, FlyaiOffer, FlyaiResult } from "../shared/flyai.ts";
import { chinaDateTime, parseFlyaiPrice, trainSeatLabel, validHotelQuote, validTrainQuote } from "../shared/flyai.ts";
import { HotelApiError } from "./hotels.ts";

type ObjectData = Record<string, unknown>;
const object = (v: unknown): ObjectData => v && typeof v === "object" && !Array.isArray(v) ? v as ObjectData : {};
const string = (v: unknown, limit = 250) => typeof v === "string" ? v.slice(0, limit).trim() : "";
const badQuery = () => new HotelApiError(400, "INVALID_FLYAI_QUERY", "Проверьте города и будущие даты поездки. Для поездов доступен поиск на ближайшие 15 дней.");

export function validateFlyaiQuery(value: unknown, now = new Date()): FlyaiQuery {
  const v = object(value);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const start = Date.parse(`${today}T00:00:00Z`);
  const date = (d: unknown, maxDays: number) => {
    if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const time = Date.parse(`${d}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === d && time >= start && time < start + maxDays * 86400000;
  };
  const city = (c: unknown): c is CityId => cityIds.some(id => id === c);
  if (v.kind === "hotel" && city(v.city) && date(v.checkIn, 365) && date(v.checkOut, 394)) {
    const nights = (Date.parse(v.checkOut as string) - Date.parse(v.checkIn as string)) / 86400000;
    if (nights > 0 && nights <= 28) return { kind: "hotel", city: v.city, checkIn: v.checkIn as string, checkOut: v.checkOut as string };
  }
  if (v.kind === "train" && city(v.from) && city(v.to) && v.from !== v.to && date(v.date, 15)) {
    return { kind: "train", from: v.from, to: v.to, date: v.date as string };
  }
  throw badQuery();
}

export function flyaiArgs(query: FlyaiQuery): string[] {
  const basePlaces: Partial<Record<CityId, string>> = {
    sha: "人民广场", bei: "王府井", han: "西湖", zjj: "张家界火车站", gui: "桂林站", san: "三亚湾",
    qin: "五四广场", xmn: "中山路步行街", bha: "北海老街", che: "天府广场", xan: "西安钟楼", hua: "屯溪老街",
  };
  return query.kind === "hotel"
    ? ["search-hotel", "--dest-name", cities[query.city].cn, "--poi-name", basePlaces[query.city] ?? cities[query.city].cn + "市中心", "--hotel-types", "hotel", "--check-in-date", query.checkIn, "--check-out-date", query.checkOut, "--sort", "distance_asc"]
    : ["search-train", "--origin", cities[query.from].cn, "--destination", cities[query.to].cn, "--dep-date", query.date, "--journey-type", "1", "--sort-type", "4"];
}

export function safeFlyaiUrl(value: unknown): string | null {
  try {
    const url = new URL(string(value, 2048));
    if (url.protocol !== "https:" || url.hostname !== "router.feizhu.com" || url.username || url.password || url.port) return null;
    if (url.pathname.startsWith("/ws/")) return url.href;
    if (url.pathname !== "/multi/webview") return null;
    const nested = new URL(url.searchParams.get("url") || "");
    if (nested.protocol !== "https:" || nested.host !== "router.feizhu.com" || nested.username || nested.password || !nested.pathname.startsWith("/ws/")) return null;
    return nested.href;
  } catch { return null; }
}

export function normalizeFlyai(raw: unknown, query: FlyaiQuery, now = new Date(), authenticated = false): FlyaiResult {
  const root = object(raw);
  const items = object(root.data).itemList;
  if (root.status !== 0 || !Array.isArray(items)) throw new HotelApiError(502, "FLYAI_BAD_RESPONSE", "FlyAI не вернул корректную выдачу. Повторите поиск позже.");
  const offers: FlyaiOffer[] = [];
  for (const [index, item] of items.slice(0, 20).entries()) {
    const v = object(item);
    // Retain the provider's label verbatim, including masked digits.
    const priceLabel = string(v.price, 40) || "Не указана";
    if (query.kind === "hotel") {
      const name = string(v.name);
      if (!name) continue;
      const nightly = parseFlyaiPrice(priceLabel);
      const lat = typeof v.latitude === "string" && v.latitude.trim() || typeof v.latitude === "number" ? Number(v.latitude) : NaN;
      const lon = typeof v.longitude === "string" && v.longitude.trim() || typeof v.longitude === "number" ? Number(v.longitude) : NaN;
      let distanceKm: number | undefined;
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        const [baseLon, baseLat] = cities[query.city].point, radians = Math.PI / 180;
        const a = Math.sin((lat - baseLat) * radians / 2) ** 2
          + Math.cos(baseLat * radians) * Math.cos(lat * radians) * Math.sin((lon - baseLon) * radians / 2) ** 2;
        distanceKm = Math.round(6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) * 10) / 10;
      }
      const quote = {
        source: "flyai", hotelId: string(v.shId), city: query.city, name, address: string(v.address),
        checkIn: query.checkIn, checkOut: query.checkOut, currency: "CNY", nightly,
        priceBasis: "nightly_search_estimate", searchedAt: now.toISOString(),
        ...(distanceKm === undefined ? {} : { distanceKm }),
      };
      offers.push({ id: `${string(v.shId) || "hotel"}:${index}`, name, description: string(v.address), priceLabel, url: safeFlyaiUrl(v.detailUrl),
        ...(authenticated && validHotelQuote(quote) ? { hotelQuote: quote } : {}) });
    } else {
      const journeys = Array.isArray(v.journeys) ? v.journeys : [];
      const segments = object(journeys[0]).segments;
      if (journeys.length !== 1 || !Array.isArray(segments) || segments.length !== 1) continue;
      const segment = object(segments[0]);
      const departure = string(segment.depDateTime, 19), arrival = string(segment.arrDateTime, 19);
      const name = string(segment.marketingTransportNo);
      const minutes = Number(v.totalDuration);
      if (string(segment.depCityName).replace(/市$/, "") !== cities[query.from].cn || string(segment.arrCityName).replace(/市$/, "") !== cities[query.to].cn) continue;
      const departureTime = chinaDateTime(departure), arrivalTime = chinaDateTime(arrival);
      if (!name || !departure.startsWith(query.date + " ") || departureTime === null || arrivalTime === null
        || !Number.isInteger(minutes) || minutes <= 0 || minutes > 4320 || arrivalTime - departureTime !== minutes * 60000) continue;
      const fromStation = string(segment.depStationName), toStation = string(segment.arrStationName);
      const seatClass = string(segment.seatClassName, 100);
      const quote = { source: "flyai" as const, from: query.from, to: query.to, trainNumber: name,
        fromStation, toStation, seatClass, departure, arrival, minutes,
        amount: parseFlyaiPrice(priceLabel), currency: "CNY", priceBasis: "passenger_search_estimate", searchedAt: now.toISOString() };
      offers.push({ id: `${name}:${index}`, name,
        description: `${fromStation} → ${toStation}${seatClass ? ` · ${trainSeatLabel(seatClass)}` : ""}`,
        priceLabel, url: safeFlyaiUrl(v.jumpUrl), departure, arrival, minutes,
        ...(authenticated && validTrainQuote(quote) ? { trainQuote: quote } : {}) });
    }
  }
  if (items.length && !offers.length) throw new HotelApiError(502, "FLYAI_BAD_RESPONSE", "Формат выдачи FlyAI изменился или даты не совпали. Повторите поиск позже.");
  return { source: "flyai", query, searchedAt: now.toISOString(), access: authenticated ? "personal_key" : "trial",
    limited: !authenticated || offers.some(offer => parseFlyaiPrice(offer.priceLabel) === null), offers };
}

export async function runFlyaiCommand(args: string[], apiKey?: string): Promise<unknown> {
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve("@fly-ai/flyai-cli/package.json")), "dist/flyai-bundle.cjs");
  const env = { ...process.env };
  delete env.FLYAI_API_KEY;
  delete env.FLYAI_SIGN_SECRET;
  // Ignore SDK debug overrides: never send the key to an alternate endpoint.
  delete env.DEBUG_FLYAI_MCP_URL;
  delete env.DEBUG_FLYAI_API_KEY;
  if (apiKey?.trim()) env.FLYAI_API_KEY = apiKey.trim();
  return readCliJson(cli, args, env);
}

export async function readCliJson(cli: string, args: string[], env: NodeJS.ProcessEnv): Promise<unknown> {
  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), "travelator-flyai-"));
    const outputPath = join(directory, "result.json");
    const output = await open(outputPath, "wx", 0o600);
    const errorPath = join(directory, "error.txt");
    const diagnostics = await open(errorPath, "wx", 0o600);
    let succeeded = false;
    try {
      // CLI 1.0.16 calls process.exit immediately after console.log. A pipe can
      // lose its tail; file-backed stdout is synchronous and preserves the JSON.
      succeeded = await new Promise<boolean>((resolve, reject) => {
        const child = spawn(process.execPath, [cli, ...args], { timeout: 35000, env, windowsHide: true, stdio: ["ignore", output.fd, diagnostics.fd] });
        child.once("error", reject);
        child.once("close", (code, signal) => resolve(code === 0 && !signal));
      });
    } finally { await Promise.all([output.close(), diagnostics.close()]); }
    if (!succeeded) {
      // Inspect only known provider status markers; raw diagnostics may contain secrets.
      if ((await stat(errorPath)).size <= 16000) {
        const errorText = await readFile(errorPath, "utf8");
        if (/MCP HTTP 451\b|Abnormal access behavior detected by risk control/i.test(errorText))
          throw new HotelApiError(503, "FLYAI_ACCESS_RESTRICTED", "FlyAI временно ограничил доступ по своей системе защиты. Онлайн-проверка остановлена. Попробуйте позже или уточните доступ в поддержке FlyAI. Предварительный маршрут доступен.");
        if (/MCP HTTP 429\b/.test(errorText))
          throw new HotelApiError(429, "FLYAI_RATE_LIMIT", "FlyAI ограничил частоту запросов. Онлайн-проверка остановлена; повторите её позже. Предварительные варианты доступны.");
      }
      throw new Error("CLI failed");
    }
    if ((await stat(outputPath)).size > 1024 * 1024) throw new Error("Response too large");
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch (error) {
    if (error instanceof HotelApiError) throw error;
    throw new HotelApiError(502, "FLYAI_UNAVAILABLE", "FlyAI сейчас не отвечает или ограничил доступ. Попробуйте позже. Тестовый каталог остаётся доступен.");
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

export function createFlyaiSearch(run = runFlyaiCommand, clock = () => new Date(), apiKey?: string) {
  const cache = new Map<string, { expires: number; value: FlyaiResult }>();
  const pending = new Map<string, Promise<FlyaiResult>>();
  return async (value: unknown) => {
    const query = validateFlyaiQuery(value, clock());
    const key = JSON.stringify(query);
    const now = clock().getTime();
    for (const [k, entry] of cache) if (entry.expires <= now) cache.delete(k);
    if (cache.has(key)) return cache.get(key)!.value;
    if (pending.has(key)) return pending.get(key)!;
    if (pending.size >= 2) throw new HotelApiError(429, "FLYAI_BUSY", "Уже выполняется поиск. Повторите через несколько секунд.");
    const promise = run(flyaiArgs(query), apiKey).then(raw => {
      const result = normalizeFlyai(raw, query, clock(), Boolean(apiKey?.trim()));
      if (cache.size >= 30) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: clock().getTime() + 120000, value: result });
      return result;
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}
