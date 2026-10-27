import { cities } from "../data/catalog";
import type { CityId, Interest, TripInput } from "../types";
import { interests, mandatoryCities, placesFor, toJourneyInput } from "./journey";
import { isAutomaticTrip } from "./trip-timing";

/** Interests are minimum coverage, not user-entered quotas. The allocator chooses the remaining days. */
export function automaticPreferences(input: TripInput, patch: Partial<Pick<TripInput, "days" | "interests" | "pace" | "required">> = {}): TripInput {
  const source = toJourneyInput(input), next = { ...source, interests: [...input.interests], ...patch };
  const selected = new Set<Interest>(next.interests);
  const daysByInterest: Record<Interest, number> = { city: 0, nature: 0, sea: 0 };
  for (const kind of interests) if (selected.has(kind)) daysByInterest[kind] = 1;
  const floors = new Map<string, number>();
  for (const place of placesFor(next)) {
    selected.add(place.interest);
    floors.set(`${place.city}:${place.interest}`, Math.max(floors.get(`${place.city}:${place.interest}`) ?? 0, place.minDays));
  }
  for (const kind of interests) {
    const minimum = [...floors].filter(([key]) => key.endsWith(`:${kind}`)).reduce((sum, [, days]) => sum + days, 0);
    daysByInterest[kind] = Math.max(daysByInterest[kind], minimum);
  }
  for (const city of next.required) {
    const supported = cities[city].experiences ?? [cities[city].interest];
    if (!supported.some(kind => selected.has(kind))) selected.add(cities[city].interest);
  }
  for (const kind of selected) daysByInterest[kind] = Math.max(1, daysByInterest[kind]);
  const bases = mandatoryCities(next).length;
  const paceDays = { slow: 6, balanced: 4, active: 3 }[next.pace];
  const maxStops = Math.min(5, Math.max(selected.size === 3 ? 2 : 1, bases, Math.ceil((Number.isFinite(next.days) ? next.days : 10) / paceDays)));
  return { ...next, interests: interests.filter(kind => selected.has(kind)), seaEnd: false, seaDays: 2, cityOrder: "auto", maxTrainMinutes: 120,
    journey: { ...source.journey!, planningMode: "automatic", flexibleDates: isAutomaticTrip(source) ? Boolean(source.journey!.flexibleDates) : true,
      daysByInterest, minStops: Math.max(1, bases), maxStops } };
}

export function toggleAutomaticPlace(input: TripInput, id: string, city: CityId, isPlace: boolean): TripInput {
  const base = automaticPreferences(input), included = isPlace ? base.journey!.requiredPlaces.includes(id) : base.required.includes(city);
  return automaticPreferences({ ...base,
    required: isPlace ? base.required : included ? base.required.filter(value => value !== city) : [...base.required, city],
    journey: { ...base.journey!, requiredPlaces: isPlace ? included ? base.journey!.requiredPlaces.filter(value => value !== id) : [...base.journey!.requiredPlaces, id] : base.journey!.requiredPlaces },
  });
}
