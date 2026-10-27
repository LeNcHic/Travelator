import type { RoutePlan, TripInput } from "../types";
import { preferredStay } from "../data/destination-profiles";
import { isAutomaticTrip } from "./trip-timing";
import { cities } from "../data/catalog";

export function stayPenalty(plan: RoutePlan, input?: TripInput): number {
  if (plan.cities.length === 1 && input?.journey?.maxStops === 1) return 0;
  return plan.cities.reduce((sum, city, index) => {
    const days = plan.days[index], profile = preferredStay(city, input?.pace);
    return sum + (days === 1 && plan.cities.length > 1 ? 8 : 0) + Math.max(0, profile.min - days) + Math.max(0, days - profile.max) ** 2 * 3;
  }, input?.journey && input.pace === "slow" ? Math.max(0, plan.cities.length - input.journey.minStops) * 2 : 0);
}

export function stayNotes(plan: RoutePlan, input?: TripInput): string[] {
  if (plan.cities.length === 1 && input?.journey?.maxStops === 1) return [];
  return plan.cities.flatMap((city, index) => {
    const days = plan.days[index], profile = preferredStay(city, input?.pace);
    return days === 1 ? [`${cities[city].name}: короткая остановка на один день${input && isAutomaticTrip(input) ? "." : ", часть времени займёт дорога."}`]
      : days > profile.max ? [`${cities[city].name}: длительная остановка. Она помогает совместить выбранный срок, число городов и дни впечатлений.`] : [];
  });
}
