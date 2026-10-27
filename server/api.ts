import { generateRoutes } from "../src/lib/planner.ts";
import { createOfficialEventSearch } from "./events.ts";
import { createWeatherSearch } from "./weather.ts";
import { cityIds } from "../src/data/catalog.ts";
import { addDays } from "../src/lib/format.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createHotelProviders, HotelApiError, validateSearch } from "./hotels.ts";

import { createFlightSearch } from "./flights.ts";
import { createFlyaiSearch } from "./flyai.ts";
import { createLiveRouteSearch, validateLiveInput } from "./live-routes.ts";
import { createRailgoSearch } from "./railgo.ts";
import { createRailgoRouteSearch, validateRailgoTrip } from "./railgo-routes.ts";

const LIMIT = 4096;

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (!req.headers["content-type"]?.startsWith("application/json")) {
    throw new HotelApiError(415, "JSON_REQUIRED", "Ожидается JSON-запрос.");
  }
  const body = await new Promise<Buffer>((resolve, reject) => {
    let size = 0;
    let failed = false;
    const chunks: Buffer[] = [];
    const fail = (error: HotelApiError) => { failed = true; chunks.length = 0; reject(error); };
    // Drain an oversized request without retaining it or destroying the socket
    // before the JSON error response can reach the client.
    req.on("data", (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > LIMIT) return fail(new HotelApiError(413, "REQUEST_TOO_LARGE", "Слишком большой запрос."));
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => { if (!failed) resolve(Buffer.concat(chunks)); });
    req.on("error", () => fail(new HotelApiError(400, "INCOMPLETE_REQUEST", "Запрос не получен полностью.")));
    req.on("aborted", () => fail(new HotelApiError(400, "INCOMPLETE_REQUEST", "Запрос прерван.")));
  });
  try { return JSON.parse(body.toString("utf8")); }
  catch { throw new HotelApiError(400, "INVALID_JSON", "Некорректный JSON-запрос."); }
}

export function createHotelApi(env: Record<string, string | undefined> = {}) {
  const providers = createHotelProviders(env);
  const flyaiSearch = createFlyaiSearch(undefined, undefined, env.FLYAI_API_KEY);
  const liveRoutes = createLiveRouteSearch(flyaiSearch);
  const railgoSearch = createRailgoSearch();
  const eventSearch = createOfficialEventSearch();
  const weatherSearch = createWeatherSearch();
  const flightSearch = createFlightSearch(undefined, undefined, env.FLYAI_API_KEY);
  const railgoRoutes = createRailgoRouteSearch(flyaiSearch, railgoSearch, undefined, undefined, flightSearch);
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url?.split("?")[0];
    if (!path?.startsWith("/api/")) return next();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const send = (status: number, body: unknown) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      if (path === "/api/hotels/providers" && req.method === "GET") {
        return send(200, { providers: Object.values(providers).map(provider => provider.status()) });
      }
      if (["/api/weather/search", "/api/hotels/search", "/api/flyai/search", "/api/flyai/routes", "/api/railgo/search", "/api/flights/search", "/api/events/search", "/api/routes/search"].includes(path) && req.method === "POST") {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) {
          throw new HotelApiError(403, "ORIGIN_DENIED", "Запрос разрешён только из приложения.");
        }
        const body = await readJson(req);
        if (path === "/api/weather/search") {
          const controller = new AbortController(), disconnect = () => controller.abort();
          res.once("close", disconnect);
          try { const result = await weatherSearch(body, controller.signal); if (!res.destroyed) return send(200, result); }
          finally { res.off("close", disconnect); }
          return;
        }
        if (path === "/api/flyai/routes" || path === "/api/routes/search") {
          const input = path === "/api/routes/search" ? validateRailgoTrip(body) : validateLiveInput(body);
          if (!env.FLYAI_API_KEY?.trim()) throw new HotelApiError(503, "PERSONAL_KEY_REQUIRED", "Для автоматического подбора настройте личный ключ FlyAI на сервере.");
          const controller = new AbortController();
          const disconnect = () => controller.abort();
          res.once("close", disconnect);
          if (res.destroyed) controller.abort();
          res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
          res.flushHeaders();
          const event = (value: unknown) => { if (!controller.signal.aborted) res.write(JSON.stringify(value) + "\n"); };
          try {
            event({ type: "progress", progress: { requests: 0, maxRequests: 32, message: "Проверяем официальную афишу на даты поездки…" } });
            const prospective = [...new Set(generateRoutes(input).plans.flatMap(plan => plan.cities))].slice(0,20);
            const [calendar, weather] = path === "/api/routes/search" ? await Promise.all([
              eventSearch({ cities: cityIds, start: input.startDate, end: addDays(input.startDate, input.days - 1) }, controller.signal).catch(() => null),
              prospective.length ? weatherSearch({ cities: prospective, start: input.startDate, end: addDays(input.startDate, input.days - 1) }, controller.signal).catch(() => null) : null,
            ]) : [null,null];
            controller.signal.throwIfAborted();
            const result = await (path === "/api/routes/search" ? railgoRoutes : liveRoutes)(input, { signal: controller.signal, events: calendar?.events, weather: weather?.days,
              onProgress: progress => event({ type: "progress", progress }) });
            event({ type: "result", result });
          } catch (error) {
            event({ type: "error", message: error instanceof HotelApiError ? error.message : "Подбор не завершился. Попробуйте повторить поиск." });
          } finally {
            res.off("close", disconnect);
            if (!controller.signal.aborted) res.end();
          }
          return;
        }
        if (path === "/api/flyai/search") return send(200, await flyaiSearch(body));
        if (path === "/api/events/search") return send(200, await eventSearch(body));
        if (path === "/api/flights/search") return send(200, await flightSearch(body));
        if (path === "/api/railgo/search") return send(200, await railgoSearch(body));
        const request = validateSearch(body);
        return send(200, await providers[request.provider].search(request));
      }
      if (["/api/weather/search", "/api/hotels/providers", "/api/hotels/search", "/api/flyai/search", "/api/flyai/routes", "/api/railgo/search", "/api/flights/search", "/api/events/search", "/api/routes/search"].includes(path)) {
        res.setHeader("Allow", path.endsWith("providers") ? "GET" : "POST");
        return send(405, { error: { code: "METHOD_NOT_ALLOWED", message: "Метод не поддерживается." } });
      }
      send(404, { error: { code: "NOT_FOUND", message: "Метод API не найден." } });
    } catch (error) {
      const safe = error instanceof HotelApiError ? error : new HotelApiError(500, "INTERNAL_ERROR", "Не удалось выполнить поиск. Попробуйте ещё раз.");
      send(safe.status, { error: { code: safe.code, message: safe.message } });
    }
  };
}
