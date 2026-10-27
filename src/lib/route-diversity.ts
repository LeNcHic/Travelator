import type { RoutePlan, TripInput, TripPriority } from "../types";
import { algorithmSettings } from "./algorithm-settings";

export interface RankedCandidate {
  plan: RoutePlan;
  cost: number;
  minutes: number;
  key: string;
  fit: number;
  stayPenalty: number;
  eventBonus?: number;
  weatherPenalty?: number;
}

/** Reversing a route or changing a ticket does not create another destination idea. */
export const destinationSetKey = (plan: RoutePlan) => [...plan.cities].sort().join(",");
export function destinationDistance(a: RoutePlan, b: RoutePlan): number {
  const union = new Set([...a.cities, ...b.cities]);
  const shared = a.cities.filter(city => b.cities.includes(city)).length;
  return 1 - shared / union.size;
}

/** Bounded relevance + novelty selection. Every candidate already satisfies the hard trip constraints. */
export function selectDiverseRoutes(candidates: RankedCandidate[], input: TripInput, primary: RankedCandidate): RoutePlan[] {
  const bestStay = Math.min(...candidates.map(candidate => candidate.stayPenalty));
  // Diversity must not reintroduce the long-stay/one-day imbalances excluded by the planner.
  const qualityPool = candidates.filter(candidate => candidate.stayPenalty <= bestStay + 2
    && candidate.fit >= primary.fit - 15);
  const cheapest = Math.min(...qualityPool.map(candidate => candidate.cost), primary.cost);
  const fastest = Math.min(...qualityPool.map(candidate => candidate.minutes), primary.minutes);
  const score = (candidate: RankedCandidate, goal: TripPriority) => {
    const cost = (candidate.cost - cheapest) / Math.max(1, cheapest);
    const time = (candidate.minutes - fastest) / Math.max(120, fastest);
    const fit = 1 - candidate.fit / 100;
    const weights = goal === "balance" ? algorithmSettings.weights : algorithmSettings.objectives[goal];
    const relevance = weights.cost * cost + weights.time * time + weights.experiences * fit;
    return relevance - (candidate.eventBonus ?? 0) + (candidate.weatherPenalty ?? 0);
  };
  const chosen: { candidate: RankedCandidate; goal: TripPriority }[] = [{ candidate: primary, goal: input.priority }];
  for (const goal of (["value", "fast", "balance"] as const).filter(goal => goal !== input.priority)) {
    const available = qualityPool.filter(candidate => !chosen.some(item => destinationSetKey(item.candidate.plan) === destinationSetKey(candidate.plan)));
    if (!available.length) break;
    // First find the best relevant distinct idea. Novelty can only reorder candidates within
    // 15% normalized regret; a remote expensive detour cannot win just by being different.
    const best = Math.min(...available.map(candidate => score(candidate, goal)));
    const shortlist = available.filter(candidate => score(candidate, goal) <= best + algorithmSettings.search.maximumRegret);
    const novelty = (candidate: RankedCandidate) => Math.min(...chosen.map(item => destinationDistance(item.candidate.plan, candidate.plan)));
    const next = [...shortlist].sort((a, b) => (score(a, goal) - algorithmSettings.search.novelty * novelty(a)) - (score(b, goal) - algorithmSettings.search.novelty * novelty(b))
      || a.cost - b.cost || a.minutes - b.minutes || a.key.localeCompare(b.key))[0];
    chosen.push({ candidate: next, goal });
  }
  return chosen.map(({ candidate, goal }) => ({ ...candidate.plan, id: goal }));
}
