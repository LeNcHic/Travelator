import type { TripInput } from "../src/types";

/** A stable identity for supported trip parameters, independent of object key order. */
export function tripKey(input: TripInput): string {
  const journey = input.journey;
  return JSON.stringify({
    country: input.country ?? "CN",
    start: input.start,
    end: input.end,
    startDate: input.startDate,
    days: input.days,
    budget: input.budget,
    interests: [...input.interests].sort(),
    required: input.cityOrder === "fixed" ? input.required : [...input.required].sort(),
    seaEnd: input.seaEnd,
    seaDays: input.seaDays,
    transport: input.transport,
    pace: input.pace,
    priority: input.priority,
    cityOrder: input.cityOrder,
    maxTrainMinutes: input.maxTrainMinutes,
    ...(journey ? { journey: {
      ...(journey.planningMode ? { planningMode: journey.planningMode, flexibleDates: Boolean(journey.flexibleDates) } : {}),
      origin: journey.origin,
      daysByInterest: {
        city: journey.daysByInterest.city,
        nature: journey.daysByInterest.nature,
        sea: journey.daysByInterest.sea,
      },
      minStops: journey.minStops,
      maxStops: journey.maxStops,
      requiredPlaces: [...journey.requiredPlaces].sort(),
    } } : {}),
  });
}
