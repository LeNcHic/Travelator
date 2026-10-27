import type { VerifiedEvent } from "../shared/events.ts";
import type { WeatherDay } from "../shared/weather.ts";
import { algorithmSettings } from "../src/lib/algorithm-settings.ts";
import { validFlightQuote, type FlightQuery, type FlightQuote, type FlightResult } from "../shared/flights.ts";
import type { CityId, RoutePlan, Ticket, TripInput } from "../src/types.ts";
import { cities, hotelsIn, ticketsBetween } from "../src/data/catalog.ts";
import { allocateDaysForTransfers, citySequences, hotelStays, rankRoutePlans, generateRoutes, schedule, ticketFromTrainQuote, ticketFromFlightQuote, transferDays } from "../src/lib/planner.ts";
import { isInput } from "../src/lib/storage.ts";
import { addDays, displayDate } from "../src/lib/format.ts";
import { chinaStartDate } from "../src/lib/journey.ts";
import { hasExactDates, isAutomaticTrip } from "../src/lib/trip-timing.ts";
import { validHotelQuote, type FlyaiQuery, type FlyaiResult, type RailgoTrainQuote } from "../shared/flyai.ts";
import type { RailgoQuery, RailgoResult } from "../shared/railgo.ts";
import type { LiveRouteProgress, LiveRouteResult } from "../shared/live-routes.ts";
import { validateFlyaiQuery } from "./flyai.ts";
import { couldHaveShortTrain } from "./railgo.ts";
import { HotelApiError } from "./hotels.ts";

export function validateRailgoTrip(value: unknown, now = new Date()): TripInput {
  if (!isInput(value)) throw new HotelApiError(400, "INVALID_TRIP", "Проверьте длительность, города и условия поездки.");
  if (!hasExactDates(value)) throw new HotelApiError(400, "DATES_REQUIRED", "Укажите даты поездки для поиска реальных предложений.");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now);
  if (value.startDate < today) throw new HotelApiError(400, "PAST_TRIP", "Для онлайн-подбора выберите будущую дату начала поездки.");
  validateFlyaiQuery({ kind: "hotel", city: value.start, checkIn: chinaStartDate(value), checkOut: addDays(chinaStartDate(value), 1) }, now);
  // Preserve the requested identity, but discard all unknown fields and credentials.
  const { start, end, startDate, days, budget, interests, required, seaEnd, seaDays, transport, pace, priority, cityOrder, journey, maxTrainMinutes } = value;
  return { ...(value.country ? { country: value.country } : {}), start, end, startDate, days, budget, interests: [...interests], required: [...required], seaEnd, seaDays, transport, pace, priority, cityOrder,
    ...(maxTrainMinutes === undefined ? {} : { maxTrainMinutes }),
    ...(journey ? { journey: { ...(journey.planningMode ? { planningMode: journey.planningMode, flexibleDates: Boolean(journey.flexibleDates) } : {}), origin: journey.origin, minStops: journey.minStops, maxStops: journey.maxStops,
      daysByInterest: { city: journey.daysByInterest.city, nature: journey.daysByInterest.nature, sea: journey.daysByInterest.sea }, requiredPlaces: [...journey.requiredPlaces] } } : {}) };
}

type Leg = { ticket: Ticket; quote?: RailgoTrainQuote; flightQuote?: FlightQuote };
class LimitReached extends Error {}

export function createRailgoRouteSearch(hotels: (query: FlyaiQuery) => Promise<FlyaiResult>, trains: (query: RailgoQuery) => Promise<RailgoResult>,
  clock = () => new Date(), limits = { requests: 32, candidates: 10000, milliseconds: 180000 }, flights?: (query: FlightQuery) => Promise<FlightResult>) {
  let activeLease: symbol | null = null;
  return async (value: unknown, options: { signal?: AbortSignal; onProgress?: (p: LiveRouteProgress) => void; events?: VerifiedEvent[]; weather?: WeatherDay[] } = {}): Promise<LiveRouteResult> => {
    const input = validateRailgoTrip(value, clock());
    options.signal?.throwIfAborted();
    if (activeLease) throw new HotelApiError(409, "ROUTE_SEARCH_BUSY", "Подбор уже выполняется. Дождитесь завершения или отмените поиск.");
    const lease = Symbol("route-search");
    activeLease = lease;
    // An upstream request may still be running after cancellation. Release only
    // this search's lease immediately; its eventual cleanup must not release a retry.
    const release = () => { if (activeLease === lease) activeLease = null; };
    options.signal?.addEventListener("abort", release, { once: true });
    try {
      const began = clock().getTime(), cache = new Map<string, FlyaiResult | RailgoResult | null>();
      const candidates: RoutePlan[] = [], warnings: string[] = [];
      let requests = 0, visited = 0, completedTemplates = 0, partial = false, trainFailures = 0, hotelFailures = 0, flightFailures = 0;
      const flightCache = new Map<string, FlightResult | null>();
      const check = () => {
        options.signal?.throwIfAborted();
        if (clock().getTime() - began >= limits.milliseconds || candidates.length >= limits.candidates) throw new LimitReached();
      };
      const progress = (message: string) => options.onProgress?.({ requests, maxRequests: limits.requests, message });
      async function query(q: FlyaiQuery | RailgoQuery): Promise<FlyaiResult | RailgoResult | null> {
        check();
        const key = JSON.stringify(q);
        if (cache.has(key)) return cache.get(key)!;
        if (requests >= limits.requests) throw new LimitReached();
        requests++;
        progress("kind" in q ? `Ищем гостиницы: ${cities[q.kind === "hotel" ? q.city : q.from].name}` : `Проверяем поезда до 2 часов: ${cities[q.from].name} → ${cities[q.to].name}, ${displayDate(q.date)}`);
        let result: FlyaiResult | RailgoResult;
        options.signal?.throwIfAborted();
        try { result = "kind" in q ? await hotels(q) : await trains(q); }
        catch (error) {
          options.signal?.throwIfAborted();
          if (error instanceof HotelApiError && ["FLYAI_ACCESS_RESTRICTED", "FLYAI_RATE_LIMIT"].includes(error.code)) throw error;
          partial = true;
          if ("kind" in q) hotelFailures++; else trainFailures++;
          cache.set(key, null); return null;
        }
        options.signal?.throwIfAborted();
        if (result.source === "flyai" && result.access !== "personal_key") throw new HotelApiError(503, "PERSONAL_KEY_REQUIRED", "Для цен гостиниц настройте личный ключ FlyAI на сервере. RailGo работает без ключа.");
        if (result.source === "flyai" && result.limited) partial = true;
        cache.set(key, result); return result;
      }
      async function queryFlights(q: FlightQuery): Promise<FlightResult | null> {
        check(); const key = JSON.stringify(q);
        if (flightCache.has(key)) return flightCache.get(key)!;
        if (requests >= limits.requests) throw new LimitReached();
        requests++; progress(`Ищем авиабилеты: ${cities[q.from].name} → ${cities[q.to].name}, ${displayDate(q.date)}`);
        options.signal?.throwIfAborted();
        try {
          const result = await flights!(q); options.signal?.throwIfAborted();
          if (result.access !== "personal_key") throw new HotelApiError(503, "PERSONAL_KEY_REQUIRED", "Для полных тарифов авиабилетов нужен личный ключ FlyAI.");
          if (result.limited) partial = true;
          flightCache.set(key, result); return result;
        } catch (error) {
          options.signal?.throwIfAborted();
          if (error instanceof HotelApiError && ["PERSONAL_KEY_REQUIRED", "FLYAI_ACCESS_RESTRICTED", "FLYAI_RATE_LIMIT"].includes(error.code)) throw error;
          partial = true; flightFailures++; flightCache.set(key, null); return null;
        }
      }
      const estimatedCost = (ids: CityId[]) => ids.slice(1).reduce((sum, to, i) => sum + Math.min(...ticketsBetween(ids[i], to)
        .filter(t => t.mode === "air" || t.minutes <= 120).map(t => t.price)), 0);
      let sequences = citySequences(input).sort((a, b) => estimatedCost(a) - estimatedCost(b) || a.length - b.length || a.join().localeCompare(b.join()));
      if (isAutomaticTrip(input)) {
        const groups = new Map<string, CityId[][]>();
        for (const sequence of sequences) { const key = [...sequence].sort().join(); groups.set(key, [...(groups.get(key) ?? []), sequence]); }
        const preferred = generateRoutes(input, options.events, options.weather).plans.map(plan => plan.cities);
        const preferredKeys = preferred.map(ids => [...ids].sort().join());
        for (const ids of preferred) {
          const key = [...ids].sort().join(), group = groups.get(key);
          if (group) groups.set(key, [ids, ...group.filter(sequence => sequence.join() !== ids.join())]);
        }
        const orderedGroups = [...groups.entries()].sort(([a], [b]) => {
          const index = (key: string) => preferredKeys.includes(key) ? preferredKeys.indexOf(key) : preferred.length;
          return index(a) - index(b);
        }).map(([, group]) => group);
        sequences = [];
        for (let round = 0; orderedGroups.some(group => group.length > round); round++)
          for (const group of orderedGroups) if (group[round]) sequences.push(group[round]);
      }
      // Reserve half the online budget for structurally independent fallbacks.
      // A missing short train must not starve all-air alternatives of their first request.
      const hasAirPath = (ids: CityId[]) => ids.slice(1).every((to,i) => ticketsBetween(ids[i],to).some(ticket => ticket.mode === "air" && ticket.price > 0 && ticket.minutes > 0));
      if (input.transport !== "train") {
        const primary = sequences.slice(0,3), backups: CityId[][] = [], sets = new Set(primary.map(ids => [...ids].sort().join()));
        for (const ids of sequences.filter(hasAirPath)) {
          const key = [...ids].sort().join();
          if (sets.has(key)) continue;
          sets.add(key); backups.push(ids); if (backups.length === 3) break;
        }
        sequences = flights ? [...primary, ...backups] : [...backups, ...primary];
      }
      sequences = sequences.slice(0, algorithmSettings.search.liveTemplates);
      progress("Подбираем города: короткие переезды на поезде, дальние — самолётом…");
      try {
        for (const ids of sequences) {
          check(); visited++;
          const days = allocateDaysForTransfers(ids, Array<number>(ids.length - 1).fill(1), input);
          if (!days) continue;
          const legs: Leg[][] = [];
          let offset = 0;
          for (let leg = 0; leg < ids.length - 1; leg++) {
            const from = ids[leg], to = ids[leg + 1], date = addDays(chinaStartDate(input), offset + days[leg]);
            let choices: Leg[] = [];
            if (input.transport !== "air" && couldHaveShortTrain(from, to)) {
              const result = await query({ from, to, date });
              if (result?.source === "railgo") {
                const quote = result.trains.find(q => q.from === from && q.to === to && q.departure.startsWith(date + " ")
                  && q.minutes <= 120 && transferDays(ticketFromTrainQuote(q)) === 1);
                if (quote) choices = [{ ticket: ticketFromTrainQuote(quote), quote }];
              }
            }
            if (!choices.length && input.transport !== "train") {
              const placeholders = ticketsBetween(from, to).filter(t => t.mode === "air" && transferDays(t) === 1);
              if (flights && placeholders.length) {
                const result = await queryFlights({ from, to, date });
                const quotes = (result?.offers ?? []).map(offer => offer.quote).filter(quote => validFlightQuote(quote)
                  && quote.from === from && quote.to === to && quote.departure.startsWith(date + " ") && quote.arrival.startsWith(date + " "));
                const cheapest = [...quotes].sort((a, b) => a.amount - b.amount || a.minutes - b.minutes)[0];
                const fastest = [...quotes].sort((a, b) => a.minutes - b.minutes || a.amount - b.amount)[0];
                choices = [...new Set([cheapest, fastest].filter((quote): quote is FlightQuote => Boolean(quote)))].map(flightQuote => ({ ticket: ticketFromFlightQuote(flightQuote), flightQuote }));
              } else if (!flights) choices = placeholders.map(ticket => ({ ticket }));
            }
            if (!choices.length) break;
            legs.push(choices); offset += days[leg] + Number(!input.journey);
          }
          if (legs.length !== ids.length - 1) continue;
          const plan: RoutePlan = { id: "balance", ...(input.journey ? { calendarMode: "shared" as const } : {}), cities: ids, days, tickets: legs.map((options, i) => options[0].quote || options[0].flightQuote
            ? ticketsBetween(ids[i], ids[i + 1]).find(t => t.mode === (options[0].flightQuote ? "air" : "train"))!.id : options[0].ticket.id),
            hotels: ids.map(city => hotelsIn(city)[0].id), trainQuotes: Object.fromEntries(legs.flatMap((options, i) => options[0].quote ? [[ids[i], options[0].quote]] : [])),
            ...(flights ? { flightQuotes: Object.fromEntries(legs.flatMap((options, i) => options[0].flightQuote ? [[ids[i], options[0].flightQuote]] : [])) } : {}), hotelQuotes: {} };
          for (const stay of hotelStays(plan, input)) {
            if (stay.nights === 0) continue;
            const result = await query({ kind: "hotel", city: stay.city, checkIn: stay.checkIn, checkOut: stay.checkOut });
            const quote = result?.source === "flyai" ? result.offers.flatMap(o => validHotelQuote(o.hotelQuote)
              && o.hotelQuote.city === stay.city && o.hotelQuote.checkIn === stay.checkIn && o.hotelQuote.checkOut === stay.checkOut
              && o.hotelQuote.distanceKm !== undefined && o.hotelQuote.distanceKm <= 25 ? [o.hotelQuote] : [])
              .sort((a, b) => a.nightly - b.nightly || a.hotelId.localeCompare(b.hotelId))[0] : undefined;
            if (!quote) break;
            plan.hotelQuotes![stay.city] = quote;
          }
          if (Object.keys(plan.hotelQuotes!).length !== hotelStays(plan, input).filter(stay => stay.nights > 0).length) continue;
          completedTemplates++;
          function combine(index: number, selected: Leg[]) {
            check();
            if (index < legs.length) { for (const choice of legs[index]) combine(index + 1, [...selected, choice]); return; }
            const candidate = { ...plan, tickets: selected.map((choice, i) => choice.quote || choice.flightQuote ? plan.tickets[i] : choice.ticket.id),
              ...(flights ? { flightQuotes: Object.fromEntries(selected.flatMap((choice, i) => choice.flightQuote ? [[ids[i], choice.flightQuote]] : [])) } : {}) };
            if (schedule(candidate, input).every(row => !row.ticket || row.trainQuote || row.ticket.mode === "air")) candidates.push(candidate);
          }
          combine(0, []);
        }
      } catch (error) {
        if (!(error instanceof LimitReached)) throw error;
        partial = true; warnings.push("Достигнут предел одного поиска. Показаны лучшие из проверенных маршрутов; можно обновить предложения.");
      }
      if (trainFailures) warnings.push("Часть расписаний RailGo проверить не удалось. Это не означает отсутствия поездов; на этих направлениях могут быть показаны только оценочные перелёты.");
      if (flightFailures) warnings.push("Часть авиабилетов проверить не удалось. Маршруты без подтверждённого тарифа исключены; предварительные варианты доступны отдельно.");
      if (hotelFailures) warnings.push("Часть гостиничных предложений сейчас недоступна. Неполные маршруты исключены.");
      options.signal?.throwIfAborted();
      const ranked = rankRoutePlans(candidates, input, options.events, options.weather);
      if (!candidates.length) ranked.errors = [input.transport === "train"
        ? "Маршрут только на поездах до 2 часов не найден. Разрешите самолёты или выберите близкие города, например Шанхай и Ханчжоу. Если сервис недоступен, повторите поиск."
        : "Не удалось собрать маршрут с гостиницами в пределах 25 км от центра каждой остановки на выбранные даты. Попробуйте обновить поиск, изменить даты или сократить число городов."];
      progress("Сравниваем оценку бюджета и время в дороге…");
      return { source: "railgo", input, ...ranked, warnings, partial, searchedAt: clock().toISOString(), stats: { requests, templates: visited, completedTemplates, candidates: candidates.length } };
    } finally {
      options.signal?.removeEventListener("abort", release);
      release();
    }
  };
}
