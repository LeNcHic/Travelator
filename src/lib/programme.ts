import { attractionsIn } from "../data/attractions";
import { cities } from "../data/catalog";
import { algorithmSettings } from "./algorithm-settings";
import type { CityId, Interest, TripInput } from "../types";
import { placeInterest } from "./attraction-interest";
interface Programme { places: number; excursions: number; visits: number; transfers: number; capacity: number; contentDays: number }
const cache = new Map<string, Programme>();

export function programmeSize(city: CityId, pace: TripInput["pace"] = "balanced") {
  const key = city + ":" + pace;
  if (cache.has(key)) return cache.get(key)!;
  const places = attractionsIn(city), excursions = places.filter(place => /выезд|загород|паром/i.test(place.description));
  const visits = places.reduce((sum,place) => sum + place.minutes,0);
  const transfers = Math.max(0, places.length - 1) * algorithmSettings.programme.localTransferMinutes + excursions.length * 90;
  const capacity = pace === "slow" ? algorithmSettings.programme.slowMinutes : pace === "active" ? algorithmSettings.programme.activeMinutes : algorithmSettings.programme.balancedMinutes;
  // A quarter of the day stays free. Beach relaxation has value beyond a unique attraction list.
  const contentDays = Math.max(2, Math.ceil((visits + transfers) / (capacity * .75)), cities[city].interest === "sea" ? 5 : 0);
  const programme = { places: places.length, excursions: excursions.length, visits, transfers, capacity, contentDays };
  cache.set(key,programme); return programme;
}
export function marginalProgrammePenalty(city: CityId, day: number, pace: TripInput["pace"]) {
  const content = programmeSize(city, pace);
  const repeated = Math.max(0, day - content.contentDays + 1);
  return repeated ? Math.round(100 * (1 - algorithmSettings.programme.repeatDecay ** repeated) + repeated ** 2 * 80) : 0;
}
export function interestProgrammeDays(city: CityId, kind: Interest, pace: TripInput["pace"]) {
  const { capacity } = programmeSize(city, pace);
  const suitable = attractionsIn(city).filter(place => placeInterest(place) === kind && place.minutes <= capacity);
  const minutes = suitable.reduce((sum, place) => sum + place.minutes, 0) + Math.max(0, suitable.length - 1) * algorithmSettings.programme.localTransferMinutes;
  // Rest on a beach remains useful after its unique catalogue places have been seen.
  return Math.max(kind === "sea" && cities[city].interest === "sea" ? 5 : 1, Math.ceil(minutes / (capacity * .75)));
}
export function marginalInterestPenalty(city: CityId, kind: Interest, day: number, pace: TripInput["pace"]) {
  const repeated = Math.max(0, day - interestProgrammeDays(city, kind, pace) + 1);
  return repeated ? Math.round(80 * repeated ** 2 + 100 * (1 - algorithmSettings.programme.repeatDecay ** repeated)) : 0;
}
