import type { LiveRouteEvent, LiveRouteProgress, LiveRouteResult } from "../../shared/live-routes";
import { isAutomaticTrip } from "./trip-timing";
import { tripKey } from "../../shared/trip-key";
import { isInput, isPlan } from "./storage";
import { hotelStays, schedule, totals } from "./planner";
import type { TripInput } from "../types";

export function validateLiveResult(result: LiveRouteResult, input: TripInput): boolean {
  if (!["flyai", "railgo"].includes(result?.source) || !isInput(input) || !isInput(result.input) || tripKey(result.input) !== tripKey(input)
    || !Array.isArray(result.plans) || (isAutomaticTrip(input) ? result.plans.length > 3 : ![0, 3].includes(result.plans.length))
    || new Set(result.plans.map(plan => plan?.id)).size !== result.plans.length || !Array.isArray(result.errors)
    || !result.errors.every(e => typeof e === "string") || !Array.isArray(result.warnings)
    || !result.warnings.every(e => typeof e === "string") || !Number.isFinite(Date.parse(result.searchedAt))
    || typeof result.partial !== "boolean" || !result.stats
    || !["requests", "templates", "completedTemplates", "candidates"].every(key => {
      const n = result.stats[key as keyof LiveRouteResult["stats"]]; return Number.isInteger(n) && n >= 0;
    })) return false;
  return result.plans.every(plan => {
    if (!isPlan(plan, input)) return false;
    const t = totals(plan, input);
    const transportValid = result.source === "flyai" ? t.liveTrains === plan.tickets.length
      : schedule(plan, input).every(row => !row.ticket || row.trainQuote?.source === "railgo" && row.trainQuote.minutes <= 120 || !row.trainQuote && row.ticket.mode === "air");
    return t.liveHotels === hotelStays(plan, input).filter(stay => stay.nights > 0).length && transportValid && t.total <= input.budget;
  });
}

export async function searchLiveRoutes(input: TripInput, signal: AbortSignal,
  onProgress: (progress: LiveRouteProgress) => void): Promise<LiveRouteResult> {
  const response = await fetch("/api/routes/search", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input), signal: AbortSignal.any([signal, AbortSignal.timeout(240000)]) });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || "Подбор маршрута недоступен. Проверьте соединение с сервером.");
  }
  if (!response.body || !response.headers.get("content-type")?.includes("application/x-ndjson")) throw new Error("Сервер не поддерживает онлайн-подбор. Перезапустите приложение.");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = "", size = 0, result: LiveRouteResult | null = null;
  const consume = (line: string) => {
    if (!line.trim()) return;
    let event: LiveRouteEvent;
    try { event = JSON.parse(line) as LiveRouteEvent; }
    catch { throw new Error("Сервер вернул некорректный ответ. Повторите поиск."); }
    if (event.type === "progress") onProgress(event.progress);
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "result") {
      if (!validateLiveResult(event.result, input)) throw new Error("Сервер вернул неполный маршрут. Повторите поиск.");
      result = event.result;
    }
  };
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2 * 1024 * 1024) throw new Error("Ответ поиска слишком большой.");
      pending += decoder.decode(chunk.value, { stream: true });
      const lines = pending.split("\n"); pending = lines.pop()!;
      for (const line of lines) consume(line);
    }
    consume(pending + decoder.decode());
    if (!result) throw new Error("Поиск прерван до получения маршрутов. Повторите попытку.");
    return result;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
