import { validFlightQuote } from "../../shared/flights";
import { cities, cityIds, hotels, tickets } from "../data/catalog";
import { minimumDays, schedule, validateInput } from "./planner";
import { validVisits } from "./city-planner";
import { validHotelQuote, validTrainQuote } from "../../shared/flyai";
import type { AppSnapshot, RoutePlan, SavedTrip, TripInput } from "../types";
import { experienceAllocation, mandatoryCities, placesFor, validJourney } from "./journey";
import { availableTripDays, internationalDays, isAutomaticTrip } from "./trip-timing";
import { countries } from "../data/destination-catalog";

export const DRAFT_KEY = "travelator.draft.v1";
export const SAVED_KEY = "travelator.saved.v1";
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function isInput(value: unknown): value is TripInput {
  if (!object(value)) return false;
  if (value.country !== undefined && (typeof value.country !== "string" || !countries[value.country])) return false;
  if (value.journey !== undefined && !validJourney(value.journey)) return false;
  if (
    !cityIds.includes(value.start as never) ||
    !cityIds.includes(value.end as never) ||
    typeof value.startDate !== "string"
  )
    return false;
  if (
    !["days", "budget", "seaDays"].every(
      (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
    )
  )
    return false;
  if (
    typeof value.seaEnd !== "boolean" ||
    !["mixed", "air", "train"].includes(String(value.transport)) ||
    !["balanced", "slow", "active"].includes(String(value.pace)) ||
    !["value", "fast", "balance"].includes(String(value.priority)) ||
    !["auto", "fixed"].includes(String(value.cityOrder))
  )
    return false;
  if (
    !Array.isArray(value.required) ||
    value.required.length > cityIds.length ||
    !value.required.every((id) => cityIds.includes(id)) ||
    new Set(value.required).size !== value.required.length
  )
    return false;
  if (
    !Array.isArray(value.interests) ||
    value.interests.length > 3 ||
    !value.interests.every((id) => ["city", "nature", "sea"].includes(id))
  )
    return false;
  return validateInput(value as unknown as TripInput).length === 0;
}

export function isPlan(value: unknown, input: TripInput): value is RoutePlan {
  if (
    !object(value) ||
    !["fast", "value", "balance"].includes(String(value.id))
  )
    return false;
  const p = value as unknown as RoutePlan;
  if (p.calendarMode !== undefined && (p.calendarMode !== "shared" || !input.journey)) return false;
  if (
    !Array.isArray(p.cities) ||
    p.cities.length < (input.journey ? 1 : 2) ||
    p.cities.length > 5 ||
    !p.cities.every((id) => cityIds.includes(id)) ||
    new Set(p.cities).size !== p.cities.length
  )
    return false;
  if (
    !Array.isArray(p.days) ||
    p.days.length !== p.cities.length ||
    !p.days.every(
      (n, i) => Number.isInteger(n) && n >= minimumDays(p.cities[i], input),
    )
  )
    return false;
  if (
    !Array.isArray(p.hotels) ||
    p.hotels.length !== p.cities.length ||
    !p.hotels.every((id, i) =>
      hotels.some((h) => h.id === id && h.city === p.cities[i]),
    )
  )
    return false;
  if (
    !Array.isArray(p.tickets) ||
    p.tickets.length !== p.cities.length - 1 ||
    !p.tickets.every((id, i) =>
      tickets.some(
        (t) =>
          t.id === id &&
          t.from === p.cities[i] &&
          t.to === p.cities[i + 1] &&
          (input.transport === "mixed" || t.mode === input.transport)
          && (p.trainQuotes?.[p.cities[i]] || t.mode !== "train" || input.maxTrainMinutes === undefined || t.minutes <= input.maxTrainMinutes),
      ),
    )
  )
    return false;
  if (
    (!input.journey && (p.cities[0] !== input.start || p.cities.at(-1) !== input.end)) ||
    !input.required.every((id) => p.cities.includes(id))
  )
    return false;
  if (
    !input.journey && !input.interests.every((interest) =>
      p.cities.some((id) => cities[id].interest === interest),
    )
  )
    return false;
  const required = input.required.filter(
    (id) => id !== input.start && id !== input.end,
  );
  if (
    !input.journey && input.cityOrder === "fixed" &&
    p.cities.filter((id) => required.includes(id)).join(",") !==
      required.join(",")
  )
    return false;
  if (!validVisits(p.visits, p)) return false;
  if (p.hotelQuotes !== undefined && (!object(p.hotelQuotes)
    || !Object.entries(p.hotelQuotes).every(([city, quote]) =>
      cityIds.includes(city as never) && validHotelQuote(quote) && quote.city === city))) return false;
  if (p.trainQuotes !== undefined && (!object(p.trainQuotes)
    || !Object.entries(p.trainQuotes).every(([city, quote]) => {
      const leg = p.cities.indexOf(city as never);
      return leg >= 0 && leg < p.tickets.length && validTrainQuote(quote)
        && quote.from === city && quote.to === p.cities[leg + 1];
    }))) return false;
  if (p.flightQuotes !== undefined && (!object(p.flightQuotes) || !Object.entries(p.flightQuotes).every(([city, quote]) => {
    const leg = p.cities.indexOf(city as never);
    return leg >= 0 && leg < p.tickets.length && validFlightQuote(quote) && quote.from === city && quote.to === p.cities[leg + 1]
      && !p.trainQuotes?.[city as keyof typeof p.trainQuotes];
  }))) return false;
  if (p.outdatedFlights !== undefined && (!Array.isArray(p.outdatedFlights) || p.outdatedFlights.length > p.tickets.length
    || new Set(p.outdatedFlights).size !== p.outdatedFlights.length || !p.outdatedFlights.every(city => p.cities.slice(0, -1).includes(city)))) return false;
  if (p.outdatedTrains !== undefined && (!Array.isArray(p.outdatedTrains)
    || p.outdatedTrains.length > p.tickets.length || new Set(p.outdatedTrains).size !== p.outdatedTrains.length
    || !p.outdatedTrains.every(city => p.cities.slice(0, -1).includes(city)))) return false;
  const rows = schedule(p, input);
  if (rows.some(row => p.trainQuotes?.[row.city] && !row.trainQuote || p.flightQuotes?.[row.city] && !row.flightQuote)) return false;
  if (input.journey) {
    if (!mandatoryCities(input).every(city => p.cities.includes(city))) return false;
    const allocation = experienceAllocation(p.cities, input, availableTripDays(input) - rows.reduce((sum, row) => sum + row.transferGap, 0), p.days);
    if (!allocation || p.days.some((days, index) => days !== allocation[p.cities[index]]?.length)) return false;
    if (p.visits && !placesFor(input).every(place => p.visits?.[place.city]?.flat().includes(place.id))) return false;
  }
  return (
    p.days.reduce((a, b) => a + b, 0) +
      rows.reduce((sum, row) => sum + row.transferGap, 0) + internationalDays(input) ===
    input.days
  );
}

/** Bring the former unplanned arrival date into each stop without shifting any dates or quotes. */
function migratePlan(plan: RoutePlan, input: TripInput): RoutePlan {
  if (!input.journey || isAutomaticTrip(input) || plan.calendarMode === "shared") return plan;
  return { ...plan, calendarMode: "shared", days: plan.days.map((days, index) => days + Number(index > 0)),
    ...(plan.visits ? { visits: Object.fromEntries(Object.entries(plan.visits).map(([city, days]) =>
      [city, plan.cities.indexOf(city as never) > 0 ? [[], ...days!] : days])) } : {}) };
}

// Old trips keep their original city order. No catalogue IDs or user edits are lost.
function migrateInput(value: unknown): TripInput | null {
  if (!object(value)) return null;
  const migrated = {
    ...value,
    priority: value.priority ?? "balance",
    cityOrder: value.cityOrder ?? "fixed",
  };
  return isInput(migrated) ? migrated : null;
}

export function parseDraft(raw: string | null): AppSnapshot | null {
  try {
    const data: unknown = JSON.parse(raw ?? "null");
    if (!object(data) || data.version !== 1) return null;
    const input = migrateInput(data.input);
    if (!input) return null;
    const plan = isPlan(data.plan, input) ? migratePlan(data.plan, input) : null;
    const screen =
      data.screen === "plan" && plan
        ? "plan"
        : data.screen === "discover" ? "discover" : data.screen === "compare"
          ? "compare"
          : "create";
    return { version: 1, input, plan, screen,
      ...(data.routeSource === "demo" || data.routeSource === "flyai" ? { routeSource: data.routeSource } : {}) };
  } catch {
    return null;
  }
}

export function parseSaved(raw: string | null): SavedTrip[] {
  try {
    const data: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(data)) return [];
    return data
      .flatMap((item): SavedTrip[] => {
        if (
          !object(item) ||
          typeof item.id !== "string" ||
          typeof item.savedAt !== "string" ||
          !Number.isFinite(Date.parse(item.savedAt))
        )
          return [];
        const input = migrateInput(item.input);
        return input && isPlan(item.plan, input)
          ? [{ id: item.id, savedAt: item.savedAt, input, plan: migratePlan(item.plan, input) }]
          : [];
      })
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
