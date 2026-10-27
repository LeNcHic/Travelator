import type { VerifiedEvent } from "../../shared/events";
import type { WeatherDay } from "../../shared/weather";
import { conditionsEvaluator } from "./route-conditions";
import { validFlightQuote, airlineLabel, airportLabel, cabinLabel, type FlightQuote } from "../../shared/flights";
import {
  cities,
  cityIds,
  hotelsIn,
  hotelById,
  ticketById,
  ticketsBetween,
} from "../data/catalog";
import type {
  CityId,
  RoutePlan,
  Ticket,
  TripInput,
  TripPriority,
} from "../types";
import { addDays, isoDate, money, daysText } from "./format";
import { trainSeatLabel, validHotelQuote, validTrainQuote, type FlyaiHotelQuote, type TrainQuote } from "../../shared/flyai";
import { chinaStartDate, experienceAllocation, journeyErrors, journeySequences, restDays } from "./journey";
import { stayPenalty } from "./route-quality";
import { balanceScoreWeights, routeFit } from "./destination-fit";
import { selectDiverseRoutes } from "./route-diversity";
import { availableTripDays, calendarTransferGap, internationalDays, isAutomaticTrip, hasExactDates } from "./trip-timing";

export function defaultInput(): TripInput {
  return {
    country: "CN",
    start: "sha",
    end: "san",
    startDate: addDays(isoDate(new Date()), 1),
    days: 14,
    budget: 12000,
    interests: ["city", "nature", "sea"],
    required: [],
    seaEnd: true,
    seaDays: 4,
    transport: "mixed",
    pace: "balanced",
    priority: "balance",
    cityOrder: "auto",
  };
}

export function validateInput(input: TripInput): string[] {
  const errors: string[] = [];
  if (!cities[input.start] || !cities[input.end])
    errors.push("Выберите города начала и завершения.");
  if (!input.journey && input.start === input.end)
    errors.push("В первой версии город начала и завершения должны отличаться.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ||
    !Number.isFinite(Date.parse(input.startDate)) ||
    isoDate(new Date(`${input.startDate}T12:00:00`)) !== input.startDate
  )
    errors.push("Укажите корректную дату начала поездки.");
  if (!Number.isInteger(input.days) || input.days < (input.journey ? 5 : 7) || input.days > 28)
    errors.push(`Длительность поездки — от ${input.journey ? 5 : 7} до 28 дней.`);
  if (
    !Number.isFinite(input.budget) ||
    input.budget < 1000 ||
    input.budget > 100000
  )
    errors.push("Бюджет должен быть от ¥ 1 000 до ¥ 100 000.");
  if (input.interests.length === 0)
    errors.push("Выберите хотя бы один интерес.");
  if (!input.journey && input.seaEnd && cities[input.end]?.interest !== "sea")
    errors.push(
      "Чтобы завершить поездку у моря, выберите прибрежный город или отключите это условие.",
    );
  if (
    !input.journey && (input.seaEnd || input.interests.includes("sea")) &&
    (!Number.isInteger(input.seaDays) ||
      input.seaDays < 2 ||
      input.seaDays > 12)
  )
    errors.push("Для моря укажите от 2 до 12 дней.");
  if (!["value", "fast", "balance"].includes(input.priority))
    errors.push("Выберите приоритет поездки.");
  if (!["auto", "fixed"].includes(input.cityOrder))
    errors.push("Выберите порядок городов.");
  if (input.maxTrainMinutes !== undefined && input.maxTrainMinutes !== 120) errors.push("Для коротких переездов установлен предел 120 минут в поезде.");
  if (input.journey) errors.push(...journeyErrors(input));
  return errors;
}

export function suggestedCities(
  input: TripInput,
  variant: "fast" | "value",
): CityId[] {
  const middle = input.required.filter(
    (id) => id !== input.start && id !== input.end,
  );
  const all = () => [input.start, ...middle, input.end];
  if (
    input.interests.includes("city") &&
    !all().some((id) => cities[id].interest === "city")
  )
    middle.push(variant === "fast" ? "sha" : "bei");
  if (
    input.interests.includes("nature") &&
    !all().some((id) => cities[id].interest === "nature")
  )
    middle.push(variant === "fast" ? "zjj" : "gui");
  if (input.interests.includes("sea") && !all().some(id => cities[id].interest === "sea"))
    middle.push("san");
  return [input.start, ...new Set(middle), input.end];
}

export const travelMinutes = (ticket: Ticket) =>
  ticket.minutes + ticket.overhead;
export const transferDays = (ticket: Ticket) =>
  ticket.calendarDays ??
  Math.floor((ticket.departure + ticket.minutes + ticket.overhead / 2) / 1440) +
  1;
export const minimumDays = (city: CityId, input: TripInput) =>
  input.journey ? 1 :
  cities[city].interest === "sea" && (input.seaEnd || input.interests.includes("sea"))
    ? input.seaDays
    : 2;

export function allocateDays(
  ids: CityId[],
  ticketIds: string[],
  input: TripInput,
): number[] | null {
  return allocateDaysForTransfers(ids, ticketIds.map(id => transferDays(ticketById(id))), input);
}

export function allocateDaysForTransfers(ids: CityId[], transfers: number[], input: TripInput): number[] | null {
  if (input.journey) {
    const allocation = experienceAllocation(ids, input, availableTripDays(input) - transfers.reduce((a, b) => a + calendarTransferGap(b, input), 0));
    return allocation ? ids.map(city => allocation[city]!.length) : null;
  }
  const days = ids.map((id) => minimumDays(id, input));
  let left =
    input.days -
    transfers.reduce((sum, length) => sum + length, 0) -
    days.reduce((a, b) => a + b, 0);
  if (left < 0) return null;
  const land = ids
    .map((id, index) => (cities[id].interest !== "sea" ? index : -1))
    .filter((i) => i >= 0);
  const order =
    input.pace === "slow"
      ? [ids.length - 1, ids.length - 1, ...land]
      : input.pace === "active"
        ? ids.map((_, i) => i)
        : land;
  if (!order.length) order.push(0);
  for (let i = 0; left > 0; i++, left--) days[order[i % order.length]]++;
  return days;
}

export const priorityLabels: Record<TripPriority, string> = {
  value: "Дешевле",
  fast: "Быстрее",
  balance: "Баланс",
};

function permutations<T>(items: T[]): T[][] {
  if (!items.length) return [[]];
  return items.flatMap((item, i) =>
    permutations(items.filter((_, j) => i !== j)).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

// Only add cities needed to cover missing interests; no gratuitous detours.
export function citySequences(input: TripInput): CityId[][] {
  if (input.journey) return journeySequences(input);
  const required = [
    ...new Set(
      input.required.filter((id) => id !== input.start && id !== input.end),
    ),
  ];
  let groups: CityId[][] = [required];
  for (const interest of input.interests) {
    groups = groups.flatMap((middle) => {
      if (
        [input.start, ...middle, input.end].some(
          (id) => cities[id].interest === interest,
        )
      )
        return [middle];
      return cityIds
        .filter((id) => cities[id].interest === interest)
        .map((id) => [...middle, id]);
    });
  }
  return groups.flatMap((middle) =>
    permutations(middle)
      .filter(
        (order) =>
          input.cityOrder === "auto" ||
          order.filter((id) => required.includes(id)).join(",") ===
            required.join(","),
      )
      .map((order) => [input.start, ...order, input.end]),
  );
}

export const routeSignature = (plan: RoutePlan) =>
  JSON.stringify([plan.cities, plan.tickets, plan.hotels, plan.days, plan.trainQuotes, plan.hotelQuotes, plan.calendarMode, ...(plan.flightQuotes ? [plan.flightQuotes] : [])]);

export function generateRoutes(input: TripInput, events: VerifiedEvent[] = [], weather: WeatherDay[] = []): {
  plans: RoutePlan[];
  errors: string[];
} {
  const errors = validateInput(input);
  if (errors.length) return { plans: [], errors };
  type Candidate = {
    plan: RoutePlan;
    cost: number;
    minutes: number;
    key: string;
  };
  const candidates: Candidate[] = [];
  let minimumDuration = Infinity;
  for (const ids of citySequences(input)) {
    const automaticDays = isAutomaticTrip(input) ? allocateDays(ids, [], input) : undefined;
    const legs = ids
      .slice(1)
      .map((to, i) =>
        ticketsBetween(ids[i], to).filter(
          (t) => (input.transport === "mixed" || t.mode === input.transport)
            && (t.mode !== "train" || input.maxTrainMinutes === undefined || t.minutes <= input.maxTrainMinutes),
        ),
      );
    if (legs.some((options) => !options.length)) continue;
    const stayMinimum = Math.max(input.journey ? restDays(input) : 0, ids.reduce(
      (sum, id) => sum + minimumDays(id, input),
      0,
    ));
    const leastDays =
      stayMinimum +
      legs.reduce(
        (sum, options) => sum + Math.min(...options.map(ticket => calendarTransferGap(transferDays(ticket), input))),
        0,
      );
    minimumDuration = Math.min(minimumDuration, leastDays + internationalDays(input));
    if (leastDays > availableTripDays(input)) continue;
    // Cost and travel time are the objectives. More expensive hotels cannot improve
    // either, so use the cheapest room in each city; users can upgrade it later.
    const hotelIds = ids.map(
      (city) =>
        [...hotelsIn(city)].sort(
          (a, b) => a.nightly - b.nightly || a.id.localeCompare(b.id),
        )[0].id,
    );
    function visit(index: number, selected: string[], travelDays: number) {
      if (stayMinimum + travelDays + (input.journey ? 0 : legs.length - index) > availableTripDays(input)) return;
      if (index < legs.length) {
        for (const ticket of legs[index])
          visit(
            index + 1,
            [...selected, ticket.id],
            travelDays + calendarTransferGap(transferDays(ticket), input),
          );
        return;
      }
      const days = automaticDays === undefined ? allocateDays(ids, selected, input) : automaticDays;
      if (!days) return;
      const plan: RoutePlan = {
        id: "balance",
        ...(input.journey ? { calendarMode: "shared" as const } : {}),
        cities: ids,
        days,
        tickets: selected,
        hotels: hotelIds,
      };
      const total = totals(plan, input);
      candidates.push({
        plan,
        cost: total.total,
        minutes: total.minutes,
        key: routeSignature(plan),
      });
    }
    visit(0, [], 0);
  }
  if (!candidates.length)
    return {
      plans: [],
      errors: [
        Number.isFinite(minimumDuration)
          ? `Для этих остановок и транспорта нужно минимум ${daysText(minimumDuration)}. Добавьте ${daysText(Math.max(0, minimumDuration - input.days))}, уберите остановку или разрешите другой транспорт.`
          : "Для этих условий не удалось подобрать переезды. Измените города или транспорт.",
      ],
    };
  return rankRoutePlans(candidates.map(c => c.plan), input, events, weather);
}

export function rankRoutePlans(plans: RoutePlan[], input: TripInput, events: VerifiedEvent[] = [], weather: WeatherDay[] = []): { plans: RoutePlan[]; errors: string[] } {
  type Candidate = { plan: RoutePlan; cost: number; minutes: number; key: string };
  const candidates: Candidate[] = plans.map(plan => {
    const t = totals(plan, input);
    return { plan, cost: t.total, minutes: t.minutes, key: routeSignature(plan) };
  });
  if (!candidates.length) return { plans: [], errors: ["Полные маршруты не найдены. Измените даты или остановки."] };
  const inBudget = candidates.filter((c) => c.cost <= input.budget);
  if (!inBudget.length) {
    const cheapest = Math.min(...candidates.map((c) => c.cost));
    return {
      plans: [],
      errors: [
        `Маршрут на ${daysText(input.days)} стоит минимум ${money(cheapest)}. Увеличьте бюджет на ${money(cheapest - input.budget)} или измените остановки и длительность.`,
      ],
    };
  }
  const environment = hasExactDates(input) && (events.length || weather.length) ? conditionsEvaluator(input, weather, events) : () => ({ eventBonus: 0, penalty: 0 });
  const eventBonus = (plan: RoutePlan) => environment(plan).eventBonus;
  const bestStay = input.journey ? Math.min(...inBudget.map(candidate => stayPenalty(candidate.plan, input))) : 0;
  const affordable = input.journey ? inBudget.filter(candidate => stayPenalty(candidate.plan, input) <= bestStay + 1) : inBudget;
  const byCost = (a: Candidate, b: Candidate) =>
    a.cost - b.cost || a.minutes - b.minutes || a.key.localeCompare(b.key);
  const cheap = [...affordable].sort(byCost)[0];
  const fast = [...affordable].sort(
    (a, b) => a.minutes - b.minutes || byCost(a, b),
  )[0];
  // Pareto frontier prevents dominated outliers from distorting normalization.
  let bestMinutes = Infinity;
  const frontier = [...affordable].sort(byCost).filter((candidate) => {
    if (candidate.minutes >= bestMinutes) return false;
    bestMinutes = candidate.minutes;
    return true;
  });
  const costRange = fast.cost - cheap.cost,
    timeRange = cheap.minutes - fast.minutes;
  const regrets = (c: Candidate) => [
    costRange ? (c.cost - cheap.cost) / costRange : 0,
    timeRange ? (c.minutes - fast.minutes) / timeRange : 0,
  ];
  let balanced = [...frontier].sort((a, b) => {
    const ra = regrets(a),
      rb = regrets(b);
    return (
      Math.max(...ra) - Math.max(...rb) ||
      ra[0] + ra[1] - (rb[0] + rb[1]) ||
      byCost(a, b)
    );
  })[0];
  if (input.journey) {
    const fits = new Map<string, number>();
    const fit = (candidate: Candidate) => {
      // The same cities and day counts share experience quality; ticket/hotel prices are scored separately.
      const key = JSON.stringify([candidate.plan.cities, candidate.plan.days]);
      if (!fits.has(key)) fits.set(key, routeFit(candidate.plan, input, experienceAllocation(candidate.plan.cities, input,
        candidate.plan.days.reduce((sum, days) => sum + days, 0), candidate.plan.days)).total);
      return fits.get(key)!;
    };
    // Stable reference scales keep irrelevant expensive/slow outliers from changing the compromise.
    const score = (candidate: Candidate) => balanceScoreWeights.cost * (candidate.cost - cheap.cost) / Math.max(1, cheap.cost)
      + balanceScoreWeights.time * (candidate.minutes - fast.minutes) / Math.max(120, fast.minutes)
      + balanceScoreWeights.experiences * (1 - fit(candidate) / 100) - eventBonus(candidate.plan) + environment(candidate.plan).penalty;
    balanced = [...affordable].sort((a, b) => score(a) - score(b) || byCost(a, b))[0];
  }
  const winners: Record<TripPriority, Candidate> = {
    value: cheap,
    fast,
    balance: balanced,
  };
  if (isAutomaticTrip(input)) {
    const fitCache = new Map<string, number>();
    const scored = inBudget.map(candidate => {
      const key = JSON.stringify([candidate.plan.cities, candidate.plan.days]);
      if (!fitCache.has(key)) fitCache.set(key, routeFit(candidate.plan, input, experienceAllocation(candidate.plan.cities, input,
        candidate.plan.days.reduce((sum, count) => sum + count, 0), candidate.plan.days)).total);
      return { ...candidate, fit: fitCache.get(key)!, stayPenalty: stayPenalty(candidate.plan, input), eventBonus: eventBonus(candidate.plan), weatherPenalty: environment(candidate.plan).penalty };
    });
    return { plans: selectDiverseRoutes(scored, input, scored.find(candidate => candidate.key === winners[input.priority].key)!), errors: [] };
  }
  const order: TripPriority[] = [
    input.priority,
    ...(["value", "fast", "balance"] as const).filter(
      (id) => id !== input.priority,
    ),
  ];
  return {
    plans: order.map((id) => ({ ...winners[id].plan, id })),
    errors: [],
  };
}

export function ticketFromTrainQuote(quote: TrainQuote): Ticket {
  const departure = Number(quote.departure.slice(11, 13)) * 60 + Number(quote.departure.slice(14, 16));
  return { id: `${quote.source}:${quote.trainNumber}:${quote.departure}`, from: quote.from, to: quote.to,
    mode: "train", service: quote.trainNumber, departure, minutes: quote.minutes,
    overhead: 60, calendarDays: Math.floor((departure + quote.minutes) / 1440) + 1,
    price: quote.amount, detail: `${quote.fromStation} → ${quote.toStation} · ${trainSeatLabel(quote.seatClass)}` };
}

export function ticketFromFlightQuote(quote: FlightQuote): Ticket {
  const departure = Number(quote.departure.slice(11, 13)) * 60 + Number(quote.departure.slice(14, 16));
  return { id: `flyai-flight:${quote.flightNumber}:${quote.departure}`, from: quote.from, to: quote.to, mode: "air", service: `${airlineLabel(quote.airlineCode)} · ${quote.flightNumber}`,
    departure, minutes: quote.minutes, overhead: 180, calendarDays: Math.floor((departure + quote.minutes) / 1440) + 1,
    price: quote.amount, detail: `${airportLabel(quote.fromAirport)} → ${airportLabel(quote.toAirport)} · ${cabinLabel(quote.cabin)}` };
}

export function schedule(plan: RoutePlan, input: TripInput) {
  let offset = 0;
  let checkIn = 0;
  const automatic = isAutomaticTrip(input);
  const shared = Boolean(input.journey && (automatic || plan.calendarMode === "shared"));
  let arrival: { from: CityId; at: number; availableMinutes: number; estimated: boolean } | undefined;
  return plan.cities.map((city, index) => {
    const first = offset;
    const last = first + plan.days[index] - 1;
    const transferStart = last + 1;
    const stored = plan.trainQuotes?.[city];
    const trainQuote = validTrainQuote(stored) && stored.from === city && stored.to === plan.cities[index + 1]
      && (input.maxTrainMinutes === undefined || stored.minutes <= input.maxTrainMinutes)
      && input.transport !== "air" && (!automatic || stored.departure.slice(0, 10) === stored.arrival.slice(0, 10))
      && stored.departure.slice(0, 10) === addDays(chinaStartDate(input), transferStart) ? stored : undefined;
    const storedFlight = plan.flightQuotes?.[city];
    const flightQuote = !trainQuote && validFlightQuote(storedFlight) && storedFlight.from === city && storedFlight.to === plan.cities[index + 1]
      && input.transport !== "train" && (!automatic || storedFlight.departure.slice(0, 10) === storedFlight.arrival.slice(0, 10))
      && storedFlight.departure.slice(0, 10) === addDays(chinaStartDate(input), transferStart) ? storedFlight : undefined;
    const ticket = trainQuote ? ticketFromTrainQuote(trainQuote) : flightQuote ? ticketFromFlightQuote(flightQuote)
      : plan.tickets[index] ? ticketById(plan.tickets[index]) : null;
    const transferLength = ticket ? transferDays(ticket) : 0;
    const transferGap = automatic ? 0 : Math.max(0, transferLength - Number(shared && Boolean(ticket)));
    const checkOut = ticket ? transferStart : last + Number(Boolean(input.journey) && !automatic);
    const row = {
      city,
      first,
      last,
      checkIn,
      checkOut,
      nights: checkOut - checkIn,
      ticket,
      trainQuote,
      flightQuote,
      outdatedFlight: Boolean(plan.outdatedFlights?.includes(city) || (storedFlight && !flightQuote)),
      outdatedTrain: Boolean(plan.outdatedTrains?.includes(city) || (stored && !trainQuote)),
      transferStart,
      transferLength,
      transferGap,
      arrival: shared && !automatic ? arrival : undefined,
      date: addDays(chinaStartDate(input), first),
      endDate: addDays(chinaStartDate(input), last),
    };
    offset = transferStart + transferGap;
    checkIn = offset - Number(!shared);
    if (ticket) {
      const at = (ticket.departure + ticket.minutes + (trainQuote || flightQuote ? 0 : ticket.overhead / 2)) % 1440;
      const ready = at + (trainQuote || flightQuote ? ticket.overhead / 2 : 0) + 60; // Arrival transfer and settling into the hotel.
      arrival = { from: city, at, availableMinutes: Math.max(0, 20 * 60 - Math.max(9 * 60, ready)), estimated: !trainQuote && !flightQuote };
    }
    return row;
  });
}

/** Quotes only contribute on the exact stay dates used for the search. */
export function hotelStays(plan: RoutePlan, input: TripInput) {
  return schedule(plan, input).map((row, index) => {
    const fallback = hotelById(plan.hotels[index]);
    const stored = plan.hotelQuotes?.[row.city];
    const checkIn = addDays(chinaStartDate(input), row.checkIn);
    const checkOut = addDays(chinaStartDate(input), row.checkOut);
    const quote = validHotelQuote(stored) && stored.city === row.city
      && stored.checkIn === checkIn && stored.checkOut === checkOut ? stored : undefined;
    const nightly = quote?.nightly ?? fallback.nightly;
    return { city: row.city, checkIn, checkOut, nights: row.nights, quote,
      outdated: Boolean(stored && !quote), name: quote?.name ?? fallback.name,
      nightly, total: Math.round(nightly * 100) * row.nights / 100 };
  });
}

export function selectFlyaiHotel(plan: RoutePlan, input: TripInput, index: number, quote: FlyaiHotelQuote): RoutePlan | null {
  const stay = hotelStays(plan, input)[index];
  if (!stay || !validHotelQuote(quote) || quote.city !== stay.city
    || quote.checkIn !== stay.checkIn || quote.checkOut !== stay.checkOut) return null;
  return { ...plan, hotelQuotes: { ...plan.hotelQuotes, [stay.city]: { ...quote } } };
}

export function selectDemoHotel(plan: RoutePlan, index: number, id: string): RoutePlan {
  const hotelQuotes = { ...plan.hotelQuotes };
  delete hotelQuotes[plan.cities[index]];
  return { ...plan, hotelQuotes, hotels: plan.hotels.map((old, i) => i === index ? id : old) };
}

export function totals(plan: RoutePlan, input: TripInput) {
  const rows = schedule(plan, input);
  const stays = hotelStays(plan, input);
  const lodging = Math.round(stays.reduce((sum, stay) => sum + stay.total * 100, 0)) / 100;
  const transit = rows.reduce((sum, row) => sum + (row.ticket ? Math.round(row.ticket.price * 100) : 0), 0) / 100;
  return {
    tripDays: (rows.at(-1)?.last ?? -1) + 1 + internationalDays(input),
    liveFlights: rows.filter(row => row.flightQuote).length,
    outdatedFlights: rows.filter(row => row.ticket && row.outdatedFlight).length,
    liveTrains: rows.filter(row => row.trainQuote).length,
    railgoTrains: rows.filter(row => row.trainQuote?.source === "railgo").length,
    estimatedTickets: rows.filter(row => row.ticket && row.trainQuote?.source !== "flyai" && !row.flightQuote).length,
    demoTickets: rows.filter(row => row.ticket && !row.trainQuote && !row.flightQuote).length,
    outdatedTrains: rows.filter(row => row.ticket && row.outdatedTrain).length,
    liveHotels: stays.filter(stay => stay.nights > 0 && stay.quote).length,
    demoHotels: stays.filter(stay => stay.nights > 0 && !stay.quote).length,
    outdatedHotels: stays.filter(stay => stay.nights > 0 && stay.outdated).length,
    lodging,
    transit,
    total: Math.round((lodging + transit) * 100) / 100,
    nights: rows.reduce((sum, row) => sum + row.nights, 0),
    minutes: rows.reduce((sum, row) => sum + (row.ticket ? travelMinutes(row.ticket) : 0), 0),
    transferDays: rows.reduce((sum, row) => sum + row.transferLength, 0),
    extraTransferDays: rows.reduce((sum, row) => sum + row.transferGap, 0),
  };
}

export function moveDay(
  plan: RoutePlan,
  input: TripInput,
  index: number,
  delta: number,
): RoutePlan | null {
  if (input.journey) return null;
  const days = [...plan.days];
  if (delta < 0 && days[index] <= minimumDays(plan.cities[index], input))
    return null;
  const other =
    delta > 0
      ? days
          .map((count, i) => ({ count, i }))
          .filter(
            (x) =>
              x.i !== index && x.count > minimumDays(plan.cities[x.i], input),
          )
          .sort((a, b) => b.count - a.count)[0]?.i
      : index === days.length - 1
        ? 0
        : days.length - 1;
  if (other === undefined) return null;
  days[index] += delta;
  days[other] -= delta;
  return reconcileTrainSchedule({ ...plan, days }, input);
}

export function changeTicket(
  plan: RoutePlan,
  input: TripInput,
  index: number,
  id: string,
): RoutePlan | null {
  const candidate = ticketById(id);
  if (
    !candidate ||
    candidate.from !== plan.cities[index] ||
    candidate.to !== plan.cities[index + 1] ||
    (input.transport !== "mixed" && candidate.mode !== input.transport)
    || (candidate.mode === "train" && input.maxTrainMinutes !== undefined && candidate.minutes > input.maxTrainMinutes)
  )
    return null;
  const updated = [...plan.tickets];
  updated[index] = id;
  const trainQuotes = { ...plan.trainQuotes }, flightQuotes = { ...plan.flightQuotes };
  delete trainQuotes[plan.cities[index]]; delete flightQuotes[plan.cities[index]];
  return reconcileTrainSchedule({ ...plan, tickets: updated, trainQuotes, flightQuotes,
    outdatedFlights: plan.outdatedFlights?.filter(city => city !== plan.cities[index]),
    outdatedTrains: plan.outdatedTrains?.filter(city => city !== plan.cities[index]) }, input);
}

/** Rebalance after edits; discard snapshots whose departure date moved. */
export function reconcileTrainSchedule(
  plan: RoutePlan,
  input: TripInput,
  anchor = -1,
): RoutePlan | null {
  const trainQuotes = { ...plan.trainQuotes }, flightQuotes = { ...plan.flightQuotes };
  const outdatedFlights = new Set(plan.outdatedFlights ?? []);
  const outdated = new Set(plan.outdatedTrains ?? []);
  const days = [...plan.days];
  for (let attempt = 0; attempt <= plan.cities.length + 1; attempt++) {
    const next = { ...plan, days, trainQuotes, flightQuotes, outdatedFlights: [...outdatedFlights], outdatedTrains: [...outdated] };
    const rows = schedule(next, input);
    let removed = false;
    for (const row of rows) {
      if (flightQuotes[row.city] && !row.flightQuote) { delete flightQuotes[row.city]; outdatedFlights.add(row.city); removed = true; }
      if (trainQuotes[row.city] && !row.trainQuote) {
        delete trainQuotes[row.city]; outdated.add(row.city); removed = true;
      }
    }
    const difference = rows.at(-1)!.last + 1 + internationalDays(input) - input.days;
    if (!difference && !removed) return next;
    if (input.journey) {
      if (difference < 0) days[anchor + 1] -= difference;
      for (let n = 0; n < difference; n++) {
        const donor = days.map((count, i) => ({ count, i })).filter(x => x.i > anchor && x.count > 1)
          .sort((a, b) => b.count - a.count).find(x => {
            const candidate = days.map((count, i) => count - Number(i === x.i));
            return experienceAllocation(plan.cities, input, candidate.reduce((a, b) => a + b, 0), candidate) !== null;
          });
        if (!donor) return null;
        days[donor.i]--;
      }
      continue;
    }
    if (difference < 0) days[anchor + 1] -= difference;
    for (let n = 0; n < difference; n++) {
      const donor = days.map((count, i) => ({ count, i }))
        .filter(x => x.i > anchor && x.count > minimumDays(plan.cities[x.i], input))
        .sort((a, b) => b.count - a.count || b.i - a.i)[0];
      if (!donor) return null;
      days[donor.i]--;
    }
  }
  return null;
}

export function selectFlyaiTrain(plan: RoutePlan, input: TripInput, index: number, quote: TrainQuote): RoutePlan | null {
  const row = schedule(plan, input)[index];
  if (!row?.ticket || input.transport === "air" || !validTrainQuote(quote)
    || (input.maxTrainMinutes !== undefined && quote.minutes > input.maxTrainMinutes)
    || quote.from !== row.city || quote.to !== plan.cities[index + 1]
    || quote.departure.slice(0, 10) !== addDays(chinaStartDate(input), row.transferStart)
    || isAutomaticTrip(input) && quote.departure.slice(0, 10) !== quote.arrival.slice(0, 10)) return null;
  const flightQuotes = { ...plan.flightQuotes }; delete flightQuotes[row.city];
  const next = reconcileTrainSchedule({ ...plan, flightQuotes, outdatedFlights: plan.outdatedFlights?.filter(city => city !== row.city),
    trainQuotes: { ...plan.trainQuotes, [row.city]: { ...quote } },
    outdatedTrains: plan.outdatedTrains?.filter(city => city !== row.city),
  }, input, index);
  return next && schedule(next, input)[index].trainQuote ? next : null;
}

export function selectFlyaiFlight(plan: RoutePlan, input: TripInput, index: number, quote: FlightQuote): RoutePlan | null {
  const row = schedule(plan, input)[index];
  const placeholder = ticketsBetween(plan.cities[index], plan.cities[index + 1]).find(ticket => ticket.mode === "air");
  if (!row?.ticket || !placeholder || input.transport === "train" || !validFlightQuote(quote)
    || quote.from !== row.city || quote.to !== plan.cities[index + 1]
    || quote.departure.slice(0, 10) !== addDays(chinaStartDate(input), row.transferStart)
    || isAutomaticTrip(input) && quote.departure.slice(0, 10) !== quote.arrival.slice(0, 10)) return null;
  const trainQuotes = { ...plan.trainQuotes }; delete trainQuotes[row.city];
  const next = reconcileTrainSchedule({ ...plan, trainQuotes,
    tickets: plan.tickets.map((id, i) => i === index ? placeholder.id : id),
    flightQuotes: { ...plan.flightQuotes, [row.city]: { ...quote } },
    outdatedTrains: plan.outdatedTrains?.filter(city => city !== row.city),
    outdatedFlights: plan.outdatedFlights?.filter(city => city !== row.city),
  }, input, index);
  return next && schedule(next, input)[index].flightQuote ? next : null;
}

export function replaceCity(
  plan: RoutePlan,
  input: TripInput,
  index: number,
  replacement: CityId,
): RoutePlan | null {
  if (
    index <= 0 ||
    index >= plan.cities.length - 1 ||
    input.required.includes(plan.cities[index]) ||
    plan.cities.includes(replacement) ||
    cities[plan.cities[index]].interest !== cities[replacement].interest
  )
    return null;
  const newInput = {
    ...input,
    cityOrder: "fixed" as const,
    budget: 100000,
    required: plan.cities
      .slice(1, -1)
      .map((id, i) => (i + 1 === index ? replacement : id)),
  };
  const next = generateRoutes(newInput).plans.find((p) => p.id === plan.id);
  if (!next) return null;
  next.hotels = next.cities.map((city, i) =>
    city === plan.cities[i] ? plan.hotels[i] : next.hotels[i],
  );
  next.hotelQuotes = Object.fromEntries(Object.entries(plan.hotelQuotes ?? {}).filter(([city]) => next.cities.includes(city as CityId)));
  const updatedTickets = next.tickets.map((id, leg) =>
    leg === index - 1 || leg === index ? id : plan.tickets[leg],
  );
  next.trainQuotes = Object.fromEntries(Object.entries(plan.trainQuotes ?? {}).filter(([city, quote]) => {
    const leg = next.cities.indexOf(city as CityId);
    return leg >= 0 && quote?.to === next.cities[leg + 1];
  }));
  next.flightQuotes = Object.fromEntries(Object.entries(plan.flightQuotes ?? {}).filter(([city, quote]) => {
    const leg = next.cities.indexOf(city as CityId);
    return leg >= 0 && quote?.to === next.cities[leg + 1];
  }));
  next.outdatedFlights = plan.outdatedFlights?.filter(city => next.cities.includes(city));
  next.outdatedTrains = plan.outdatedTrains?.filter(city => next.cities.includes(city));
  return reconcileTrainSchedule({ ...next, tickets: updatedTickets, days: plan.days }, input);
}
