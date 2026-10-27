import { isAutomaticTrip } from "./trip-timing";
import { destinationScores } from "../data/destination-scores";
import { cities } from "../data/catalog";
import type { CityId, Interest, RoutePlan, TripInput } from "../types";
import { algorithmSettings } from "./algorithm-settings";

const kinds: Interest[] = ["city", "nature", "sea"];
export const locationScoreWeights = { interests: .8, appeal: .2 } as const;
export const balanceScoreWeights = { cost: algorithmSettings.weights.cost, time: algorithmSettings.weights.time, experiences: algorithmSettings.weights.experiences } as const;
export function interestWeights(input: TripInput): Record<Interest, number> {
  const requested = (!isAutomaticTrip(input) ? input.journey?.daysByInterest : undefined) ?? Object.fromEntries(kinds.map(kind => [kind, Number(input.interests.includes(kind))])) as Record<Interest, number>;
  const total = kinds.reduce((sum, kind) => sum + requested[kind], 0);
  return Object.fromEntries(kinds.map(kind => [kind, total ? requested[kind] / total : 0])) as Record<Interest, number>;
}

/** Optimistic city-set reward for pruning prefixes; actual days are scored only on complete plans. */
export function sequenceAttractiveness(ids: CityId[], input: TripInput): number {
  if (!ids.length) return 0;
  const weights = interestWeights(input);
  const match = kinds.reduce((sum, kind) => sum + weights[kind] * Math.max(...ids.map(city => destinationScores[city].experiences[kind])) / 5, 0);
  const appeal = ids.reduce((sum, city) => sum + destinationScores[city].appeal / 5, 0) / ids.length;
  return 100 * (locationScoreWeights.interests * match + locationScoreWeights.appeal * appeal);
}

/** Match is weighted by requested days; quality within a category follows its actual allocated days. */
export function routeFit(plan: RoutePlan, input: TripInput, allocation?: Partial<Record<CityId, Interest[]>> | null) {
  const weights = interestWeights(input);
  const category = Object.fromEntries(kinds.map(kind => {
    let total = 0, quality = 0;
    plan.cities.forEach((city, index) => {
      const days = allocation?.[city]?.filter(value => value === kind).length ?? (cities[city].interest === kind ? plan.days[index] : 0);
      total += days; quality += days * destinationScores[city].experiences[kind];
    });
    return [kind, total ? quality / total / 5 * 100 : 0];
  })) as Record<Interest, number>;
  const days = plan.days.reduce((sum, count) => sum + count, 0);
  const match = kinds.reduce((sum, kind) => sum + weights[kind] * category[kind], 0);
  const appeal = days ? plan.cities.reduce((sum, city, index) => sum + plan.days[index] * destinationScores[city].appeal / 5 * 100, 0) / days : 0;
  return { total: locationScoreWeights.interests * match + locationScoreWeights.appeal * appeal, match, appeal, weights, category,
    locations: plan.cities.map(city => ({ city, reason: destinationScores[city].reason })) };
}
