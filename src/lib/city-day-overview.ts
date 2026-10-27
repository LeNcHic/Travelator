import { attractionById } from "../data/attractions";
import type { CityId, RoutePlan, TripInput } from "../types";
import { cityDayCapacity, cityDays, dayMinutes, visitMinutes } from "./city-planner";

export function dayOverview(ids: string[], capacity: number) {
  const visits = visitMinutes(ids), minutes = dayMinutes(ids);
  return { count: ids.length, visits, transfers: minutes - visits, minutes, capacity, overloaded: minutes > capacity };
}

/** Preview a move without editing the plan, changing visit order or assigning other places. */
export function visitMoveOptions(plan: RoutePlan, input: TripInput, city: CityId, id: string) {
  const index = plan.cities.indexOf(city);
  if (index < 0 || attractionById(id)?.city !== city) return [];
  return cityDays(plan, input, city).map((ids, day) => {
    const current = ids.includes(id);
    const projected = current ? ids : [...ids, id];
    return { day, current, ...dayOverview(projected, cityDayCapacity(plan, input, index, day)) };
  });
}
