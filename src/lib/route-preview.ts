import { attractionById } from "../data/attractions";
import { attractionInterest, cityDays } from "./city-planner";
import { experienceAllocation, placesFor } from "./journey";
import { schedule } from "./planner";
import type { RoutePlan, TripInput } from "../types";

/** A short preview of actual suggested/stored visits, not an extra itinerary or live event feed. */
export function routePreview(plan: RoutePlan, input: TripInput) {
  const allocation = experienceAllocation(plan.cities, input, plan.days.reduce((sum, days) => sum + days, 0), plan.days);
  const limit = plan.cities.length > 3 ? 1 : 2;
  return schedule(plan, input).map(row => {
    const required = new Set<string>(placesFor(input, row.city).map(place => place.id));
    const available = cityDays(plan, input, row.city).flat().map(id => attractionById(id)).filter(place => place !== undefined);
    const highlights = available.filter(place => required.has(place.id)).slice(0, limit);
    const kinds = allocation?.[row.city] ?? [];
    for (const kind of [...new Set(kinds)].sort((a, b) => kinds.filter(value => value === b).length - kinds.filter(value => value === a).length)) {
      const place = available.find(place => attractionInterest(place) === kind && !highlights.includes(place));
      if (place && highlights.length < limit) highlights.push(place);
    }
    for (const place of available) if (highlights.length < limit && !highlights.includes(place)) highlights.push(place);
    return { ...row, highlights };
  });
}
