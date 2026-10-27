import { attractionById, attractionsIn } from "../data/attractions";
import type { Attraction, CityId, RoutePlan, TripInput } from "../types";
import { experienceAllocation, placesFor } from "./journey";
import { placeInterest } from "./attraction-interest";
import { schedule } from "./planner";

export const dayCapacity = (pace: TripInput["pace"]) =>
  ({ slow: 240, balanced: 360, active: 480 })[pace];
export const visitMinutes = (ids: string[]) =>
  ids.reduce((sum, id) => sum + (attractionById(id)?.minutes ?? 0), 0);
// A demo allowance between visits, not a calculated transport duration.
export const dayMinutes = (ids: string[]) =>
  visitMinutes(ids) + Math.max(0, ids.length - 1) * 30;
export function cityDayCapacity(plan: RoutePlan, input: TripInput, index: number, day: number): number {
  const arrival = day === 0 ? schedule(plan, input)[index]?.arrival : undefined;
  return Math.min(dayCapacity(input.pace), arrival?.availableMinutes ?? Infinity);
}
export function attractionInterest(place: Attraction) {
  return placeInterest(place);
}
const distance = (a: Attraction, b: Attraction) =>
  ((a.point[0] - b.point[0]) * Math.cos((a.point[1] * Math.PI) / 180)) ** 2 +
  (a.point[1] - b.point[1]) ** 2;

export function distributeVisits(
  city: CityId,
  count: number,
  pace: TripInput["pace"],
  capacities?: number[],
): string[][] {
  const days: string[][] = Array.from({ length: count }, () => []);
  const remaining = [...attractionsIn(city)];
  // Spread the catalogue over available days; nearby places share a day when capacity permits.
  for (let day = 0; day < count && remaining.length; day++) {
    const target = Math.ceil(remaining.length / (count - day));
    while (days[day].length < target && remaining.length) {
      const last = attractionById(days[day].at(-1) ?? "");
      const choices = [...remaining].sort((a, b) =>
        last ? distance(last, a) - distance(last, b) : 0,
      );
      const next = choices.find(
        (place) => dayMinutes([...days[day], place.id]) <= (capacities?.[day] ?? dayCapacity(pace)),
      );
      if (!next) break;
      days[day].push(next.id);
      remaining.splice(remaining.indexOf(next), 1);
    }
  }
  // Fill available gaps without exceeding the chosen pace; leftovers stay in the catalogue.
  for (const place of remaining) {
    const best = days
      .map((ids, index) => ({ ids, index }))
      .filter(({ ids, index }) => dayMinutes([...ids, place.id]) <= (capacities?.[index] ?? dayCapacity(pace)))
      .sort((a, b) => dayMinutes(a.ids) - dayMinutes(b.ids))[0];
    if (best) days[best.index].push(place.id);
  }
  return days;
}

export function cityDays(
  plan: RoutePlan,
  input: TripInput,
  city: CityId,
): string[][] {
  const index = plan.cities.indexOf(city);
  if (index < 0) return [];
  const count = plan.days[index],
    stored = plan.visits?.[city];
  const kinds = experienceAllocation(plan.cities, input, plan.days.reduce((a, b) => a + b, 0), plan.days)?.[city];
  const capacities = Array.from({ length: count }, (_, day) => cityDayCapacity(plan, input, index, day));
  let source = stored ?? distributeVisits(city, count, input.pace, capacities);
  if (!stored && kinds) {
    source = Array.from({ length: count }, () => [] as string[]);
    const required: string[] = placesFor(input, city).map(place => place.id);
    const options = [...attractionsIn(city)].sort((a, b) => Number(required.includes(b.id)) - Number(required.includes(a.id)));
    for (const place of options) {
      const kind = attractionInterest(place);
      const eligible = source.map((ids, day) => ({ ids, day })).filter(item => kinds[item.day] === kind
        && (required.includes(place.id) || dayMinutes([...item.ids, place.id]) <= capacities[item.day]))
        .sort((a, b) => Math.max(0, dayMinutes([...a.ids, place.id]) - capacities[a.day]) - Math.max(0, dayMinutes([...b.ids, place.id]) - capacities[b.day]) || dayMinutes(a.ids) - dayMinutes(b.ids));
      eligible[0]?.ids.push(place.id);
    }
  }
  const days: string[][] = Array.from({ length: count }, () => []);
  const seen = new Set<string>();
  source.forEach((ids, day) =>
    ids.forEach((id) => {
      if (attractionById(id)?.city !== city || seen.has(id)) return;
      days[Math.min(day, count - 1)].push(id);
      seen.add(id);
    }),
  );
  for (const place of placesFor(input, city)) {
    if (seen.has(place.id) && stored) continue;
    for (const day of days) { const existing = day.indexOf(place.id); if (existing >= 0) day.splice(existing, 1); }
    const preferred = days.map((ids, day) => ({ ids, day })).filter(item => !kinds || kinds[item.day] === place.interest)
      .sort((a, b) => Math.max(0, dayMinutes([...a.ids, place.id]) - capacities[a.day]) - Math.max(0, dayMinutes([...b.ids, place.id]) - capacities[b.day]) || dayMinutes(a.ids) - dayMinutes(b.ids))[0];
    days[preferred?.day ?? 0].push(place.id);
    seen.add(place.id);
  }
  return days;
}

// Keep visit order when shortening a stop: merge overflow into the last remaining day.
// Longer stops receive empty days. Replacement cities get a fresh local plan.
export function reconcileCityPlans(
  plan: RoutePlan,
  input: TripInput,
  previous?: RoutePlan["visits"],
): RoutePlan {
  const source = { ...plan, visits: plan.visits ?? previous };
  return {
    ...plan,
    visits: Object.fromEntries(
      plan.cities.map((city) => [city, cityDays(source, input, city)]),
    ),
  };
}

export function assignVisit(
  plan: RoutePlan,
  input: TripInput,
  city: CityId,
  id: string,
  target: number | null,
): RoutePlan | null {
  if (target === null && placesFor(input, city).some(place => place.id === id)) return null;
  if (!plan.cities.includes(city) || attractionById(id)?.city !== city)
    return null;
  const days = cityDays(plan, input, city);
  if (
    target !== null &&
    (!Number.isInteger(target) || target < 0 || target >= days.length)
  )
    return null;
  const next = days.map((ids) => ids.filter((current) => current !== id));
  if (target !== null) next[target].push(id);
  return { ...plan, visits: { ...plan.visits, [city]: next } };
}

export function reorderVisit(
  plan: RoutePlan,
  input: TripInput,
  city: CityId,
  day: number,
  index: number,
  delta: -1 | 1,
): RoutePlan | null {
  const days = cityDays(plan, input, city),
    ids = days[day];
  if (
    !ids ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= ids.length ||
    index + delta < 0 ||
    index + delta >= ids.length
  )
    return null;
  [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
  return { ...plan, visits: { ...plan.visits, [city]: days } };
}

export function validVisits(value: unknown, plan: RoutePlan): boolean {
  if (value === undefined) return true; // legacy plans
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([city, days]) => {
    const index = plan.cities.indexOf(city as CityId);
    if (index < 0 || !Array.isArray(days) || days.length !== plan.days[index])
      return false;
    const seen = new Set<string>();
    return days.every(
      (ids: unknown) =>
        Array.isArray(ids) &&
        ids.every((id: unknown) => {
          if (
            typeof id !== "string" ||
            attractionById(id)?.city !== city ||
            seen.has(id)
          )
            return false;
          seen.add(id);
          return true;
        }),
    );
  });
}
