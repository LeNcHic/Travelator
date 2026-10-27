import type { CityId, RoutePlan, TripInput } from "../src/types.ts";
import { cities, hotelsIn, ticketsBetween } from "../src/data/catalog.ts";
import { allocateDaysForTransfers, citySequences, hotelStays, minimumDays, rankRoutePlans, schedule, ticketFromTrainQuote, transferDays } from "../src/lib/planner.ts";
import { isInput } from "../src/lib/storage.ts";
import { addDays, displayDate } from "../src/lib/format.ts";
import { validHotelQuote, validTrainQuote, trainQuoteKey, type FlyaiQuery, type FlyaiResult, type FlyaiTrainQuote } from "../shared/flyai.ts";
import type { LiveRouteProgress, LiveRouteResult } from "../shared/live-routes.ts";
import { validateFlyaiQuery } from "./flyai.ts";
import { HotelApiError } from "./hotels.ts";
import { chinaStartDate } from "../src/lib/journey.ts";
import { availableTripDays, calendarTransferGap, hasExactDates, isAutomaticTrip } from "../src/lib/trip-timing.ts";

export const LIVE_SEARCH_LIMIT = 32;
type Options = { signal?: AbortSignal; onProgress?: (progress: LiveRouteProgress) => void };
type Template = { ids: CityId[]; transfers: number[]; days: number[] };
class SearchLimit extends Error {}

export function validateLiveInput(value: unknown, now = new Date()): TripInput {
  if (!isInput(value)) throw new HotelApiError(400, "INVALID_TRIP", "Проверьте города, длительность и условия поездки.");
  if (!hasExactDates(value)) throw new HotelApiError(400, "DATES_REQUIRED", "Укажите даты поездки для поиска реальных предложений.");
  if (value.transport === "air") throw new HotelApiError(400, "TRAINS_ONLY", "Подбор FlyAI сейчас использует поезда. Выберите поезда или смешанный транспорт.");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (value.startDate < today) throw new HotelApiError(400, "PAST_TRIP", "Для реального поиска выберите будущую дату начала поездки.");
  try {
    if (value.journey?.minStops === 1) validateFlyaiQuery({ kind: "hotel", city: value.start, checkIn: chinaStartDate(value), checkOut: addDays(chinaStartDate(value), 1) }, now);
    else validateFlyaiQuery({ kind: "train", from: value.start, to: value.end, date: addDays(chinaStartDate(value), minimumDays(value.start, value)) }, now);
  } catch { throw new HotelApiError(400, "TRAIN_WINDOW", "Поезда доступны на ближайшие 15 дней по времени Китая. Выберите более близкую дату начала: учитывайте дни в первом городе до переезда."); }
  // Copy only the supported input fields; credentials and client limits are ignored.
  return { ...(value.country ? { country: value.country } : {}), start: value.start, end: value.end, startDate: value.startDate, days: value.days, budget: value.budget,
    interests: [...value.interests], required: [...value.required], seaEnd: value.seaEnd, seaDays: value.seaDays,
    transport: value.transport, pace: value.pace, priority: value.priority, cityOrder: value.cityOrder,
    ...(value.maxTrainMinutes ? { maxTrainMinutes: value.maxTrainMinutes } : {}),
    ...(value.journey ? { journey: { ...(value.journey.planningMode ? { planningMode: value.journey.planningMode, flexibleDates: Boolean(value.journey.flexibleDates) } : {}), origin: value.journey.origin, daysByInterest: { ...value.journey.daysByInterest },
      minStops: value.journey.minStops, maxStops: value.journey.maxStops, requiredPlaces: [...value.journey.requiredPlaces] } } : {}) };
}

function templatesFor(input: TripInput): Template[] {
  const templates: Template[] = [];
  for (const ids of citySequences(input)) {
    const minimum = ids.reduce((sum, city) => sum + minimumDays(city, input), 0);
    function visit(transfers: number[], used: number) {
      const remaining = ids.length - 1 - transfers.length;
      if (minimum + used + (input.journey ? 0 : remaining) > availableTripDays(input)) return;
      if (!remaining) {
        const days = allocateDaysForTransfers(ids, transfers, input);
        if (days) templates.push({ ids, transfers, days });
        return;
      }
      // The provider accepts journeys up to 72 hours: up to four calendar days.
      for (let length = 1; length <= (isAutomaticTrip(input) ? 1 : 4); length++) visit([...transfers, length], used + calendarTransferGap(length, input));
    }
    visit([], 0);
  }
  return templates.sort((a, b) => a.transfers.reduce((x, y) => x + y, 0) - b.transfers.reduce((x, y) => x + y, 0)
    || a.transfers.join().localeCompare(b.transfers.join()) || a.ids.join().localeCompare(b.ids.join()));
}

function trainFrontier(quotes: FlyaiTrainQuote[]): FlyaiTrainQuote[] {
  const ordered = [...quotes].sort((a, b) => a.amount - b.amount || a.minutes - b.minutes || trainQuoteKey(a).localeCompare(trainQuoteKey(b)));
  let bestMinutes = Infinity;
  return ordered.filter(q => { if (q.minutes >= bestMinutes) return false; bestMinutes = q.minutes; return true; });
}

export function createLiveRouteSearch(search: (query: FlyaiQuery) => Promise<FlyaiResult>, clock = () => new Date(),
  limits = { requests: LIVE_SEARCH_LIMIT, candidates: 10000, milliseconds: 180000 }) {
  let running = false;
  return async (value: unknown, options: Options = {}): Promise<LiveRouteResult> => {
    const input = validateLiveInput(value, clock());
    if (running) throw new HotelApiError(409, "ROUTE_SEARCH_BUSY", "Подбор уже выполняется. Дождитесь завершения или отмены текущего поиска.");
    running = true;
    try {
      const started = clock().getTime();
      const cache = new Map<string, FlyaiResult | null>();
      const warnings = new Set<string>();
      const candidates: RoutePlan[] = [];
      let requests = 0, completedTemplates = 0, visited = 0, partial = false;
      const templates = templatesFor(input);
      const check = () => {
        options.signal?.throwIfAborted();
        if (clock().getTime() - started >= limits.milliseconds || candidates.length >= limits.candidates) throw new SearchLimit();
      };
      const progress = (message: string) => options.onProgress?.({ requests, maxRequests: limits.requests, message });
      const query = async (q: FlyaiQuery): Promise<FlyaiResult | null> => {
        check();
        const key = JSON.stringify(q);
        if (cache.has(key)) return cache.get(key)!;
        try { validateFlyaiQuery(q, clock()); }
        catch {
          partial = true; warnings.add("Часть дат выходит за доступное окно поиска. Для поездов это ближайшие 15 дней по времени Китая.");
          cache.set(key, null); return null;
        }
        if (requests >= limits.requests) throw new SearchLimit();
        requests++;
        progress(q.kind === "train" ? `Ищем поезда: ${cities[q.from].name} → ${cities[q.to].name}, ${displayDate(q.date)}`
          : `Ищем гостиницы: ${cities[q.city].name}, ${displayDate(q.checkIn)} — ${displayDate(q.checkOut)}`);
        let result: FlyaiResult;
        try { result = await search(q); }
        catch (error) {
          options.signal?.throwIfAborted();
          partial = true;
          warnings.add(q.kind === "train" ? `Не удалось проверить поезда ${cities[q.from].name} → ${cities[q.to].name} на ${displayDate(q.date)}.`
            : `Не удалось проверить гостиницы в ${cities[q.city].name} на ${displayDate(q.checkIn)}.`);
          cache.set(key, null); return null;
        }
        options.signal?.throwIfAborted();
        if (result.access !== "personal_key") throw new HotelApiError(503, "PERSONAL_KEY_REQUIRED", "Для автоматического расчёта нужен личный ключ FlyAI с полными ценами. Проверьте настройку сервера.");
        if (result.limited) { partial = true; warnings.add("Часть цен скрыта или неполна. В расчёт вошли только полные цены и расписания."); }
        cache.set(key, result); return result;
      };
      progress("Подбираем порядок городов и календарь поездки…");
      try {
        for (const template of templates) {
          check(); visited++;
          const { ids, transfers, days } = template;
          const legs: FlyaiTrainQuote[][] = [];
          let offset = 0;
          for (let leg = 0; leg < transfers.length; leg++) {
            const date = addDays(chinaStartDate(input), offset + days[leg]);
            const result = await query({ kind: "train", from: ids[leg], to: ids[leg + 1], date });
            const quotes = (result?.offers ?? []).flatMap(offer => validTrainQuote(offer.trainQuote)
              && offer.trainQuote.from === ids[leg] && offer.trainQuote.to === ids[leg + 1]
              && offer.trainQuote.departure.slice(0, 10) === date
              && (input.maxTrainMinutes === undefined || offer.trainQuote.minutes <= input.maxTrainMinutes)
              && transferDays(ticketFromTrainQuote(offer.trainQuote)) === transfers[leg] ? [offer.trainQuote] : []);
            const frontier = trainFrontier(quotes);
            if (!frontier.length) break;
            legs.push(frontier);
            offset += days[leg] + calendarTransferGap(transfers[leg], input);
          }
          if (legs.length !== transfers.length) continue;
          const plan: RoutePlan = { id: "balance", ...(input.journey ? { calendarMode: "shared" as const } : {}), cities: ids, days,
            tickets: ids.slice(1).map((to, i) => ticketsBetween(ids[i], to).find(t => t.mode === "train")!.id),
            hotels: ids.map(city => hotelsIn(city)[0].id),
            trainQuotes: Object.fromEntries(legs.map((options, i) => [ids[i], options[0]])), hotelQuotes: {} };
          for (const stay of hotelStays(plan, input)) {
            if (stay.nights === 0) continue;
            const result = await query({ kind: "hotel", city: stay.city, checkIn: stay.checkIn, checkOut: stay.checkOut });
            const cheapest = (result?.offers ?? []).flatMap(offer => validHotelQuote(offer.hotelQuote)
              && offer.hotelQuote.city === stay.city && offer.hotelQuote.checkIn === stay.checkIn && offer.hotelQuote.checkOut === stay.checkOut ? [offer.hotelQuote] : [])
              .sort((a, b) => a.nightly - b.nightly || a.hotelId.localeCompare(b.hotelId))[0];
            if (!cheapest) break;
            plan.hotelQuotes![stay.city] = cheapest;
          }
          if (Object.keys(plan.hotelQuotes!).length !== hotelStays(plan, input).filter(stay => stay.nights > 0).length) continue;
          completedTemplates++;
          function combine(leg: number, selected: FlyaiTrainQuote[]) {
            check();
            if (leg < legs.length) { for (const quote of legs[leg]) combine(leg + 1, [...selected, quote]); return; }
            const candidate = { ...plan, trainQuotes: Object.fromEntries(selected.map((quote, i) => [ids[i], quote])) };
            // No catalogue price or timetable participates in a completed candidate.
            if (schedule(candidate, input).slice(0, -1).every(row => row.trainQuote)) candidates.push(candidate);
          }
          combine(0, []);
        }
      } catch (error) {
        if (!(error instanceof SearchLimit)) throw error;
        partial = true;
        warnings.add(`Достигнут предел одного поиска: до ${limits.requests} обращений, ${Math.round(limits.milliseconds / 60000)} минут или ${limits.candidates.toLocaleString("ru-RU")} сочетаний. Показаны лучшие найденные варианты; можно обновить предложения или сократить число остановок.`);
      }
      options.signal?.throwIfAborted();
      const ranked = rankRoutePlans(candidates, input);
      if (!candidates.length) ranked.errors = [templates.length
        ? "Полный маршрут с ценами гостиниц и расписанием всех поездов не найден. Проверьте доступность дат, попробуйте другой порядок городов или сократите число остановок. Тестовые предложения не подставлялись."
        : "Не хватает дней для обязательных остановок и переездов на поездах. Увеличьте длительность или уберите остановку."];
      progress("Сравниваем стоимость и время найденных маршрутов…");
      return { source: "flyai", input, ...ranked, warnings: [...warnings].slice(0, 8), searchedAt: clock().toISOString(), partial,
        stats: { requests, templates: visited, completedTemplates, candidates: candidates.length } };
    } finally { running = false; }
  };
}
