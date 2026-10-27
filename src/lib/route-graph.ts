import { algorithmSettings } from "./algorithm-settings";
import { ticketsBetween } from "../data/catalog";
import { balanceScoreWeights, sequenceAttractiveness } from "./destination-fit";
import type { CityId, Ticket, TripInput } from "../types";

export interface RouteEdge { from: CityId; to: CityId; options: Ticket[]; cost: number; minutes: number }
export type RouteGraph = Map<CityId, RouteEdge[]>;

export function buildRouteGraph(input: TripInput, eligible: CityId[]): RouteGraph {
  return new Map(eligible.map(from => [from, eligible.filter(to => to !== from).flatMap(to => {
    const options = ticketsBetween(from, to).filter(ticket => (input.transport === "mixed" || ticket.mode === input.transport)
      && (ticket.mode !== "train" || input.maxTrainMinutes === undefined || ticket.minutes <= input.maxTrainMinutes));
    return options.length ? [{ from, to, options, cost: Math.min(...options.map(ticket => ticket.price)),
      minutes: Math.min(...options.map(ticket => ticket.minutes + ticket.overhead)) }] : [];
  })]));
}

interface Path { ids: CityId[]; cost: number; minutes: number; reward: number; key: string }
/** Bounded multi-objective beam search. Each path is simple; depth is the allowed number of sleeping bases. */
export function weightedCityPaths(graph: RouteGraph, input: TripInput, mandatory: CityId[]): CityId[][] {
  const preference = input.journey;
  if (!preference) return [];
  const vertices = [...graph.keys()], results: CityId[][] = [], rewards = new Map<string, number>();
  const reward = (ids: CityId[]) => {
    const key = [...ids].sort().join();
    if (!rewards.has(key)) rewards.set(key, sequenceAttractiveness(ids, input));
    return rewards.get(key)!;
  };
  const costOrder = (a: Path, b: Path) => a.cost - b.cost || a.minutes - b.minutes || a.key.localeCompare(b.key);
  const fitOrder = (a: Path, b: Path) => b.reward - a.reward || costOrder(a, b);
  let frontier: Path[] = [{ ids: [], cost: 0, minutes: 0, reward: 0, key: "" }];
  for (let depth = 1; depth <= preference.maxStops; depth++) {
    const next: Path[] = [];
    for (const previous of frontier) {
      const edges = previous.ids.length ? graph.get(previous.ids.at(-1)!)! : vertices.map(to => ({ to, cost: 0, minutes: 0 }));
      for (const edge of edges) {
        if (previous.ids.includes(edge.to)) continue;
        const ids = [...previous.ids, edge.to];
        if (mandatory.filter(city => !ids.includes(city)).length > preference.maxStops - depth) continue;
        const cost = previous.cost + edge.cost;
        next.push({ ids, cost, minutes: previous.minutes + edge.minutes, reward: reward(ids), key: ids.join() });
      }
    }
    if (next.length <= algorithmSettings.search.beamQuota * 4) frontier = next;
    else {
      const selected = new Map<string, Path>();
      const keep = (items: Path[]) => items.forEach(item => selected.set(item.key, item));
      const future = (path: Path) => mandatory.filter(city => !path.ids.includes(city)).reduce((sum, city) =>
        sum + (graph.get(path.ids.at(-1)!)?.find(edge => edge.to === city)?.cost ?? 2500), 0);
      const heuristic = (path: Path) => balanceScoreWeights.cost * (path.cost + future(path)) / Math.max(1000, input.budget)
        + balanceScoreWeights.time * path.minutes / 720 - balanceScoreWeights.experiences * path.reward / 100;
      // Separate quotas keep appealing paths alongside cheap/fast paths; endpoint quotas retain connectivity diversity.
      keep([...next].sort((a, b) => a.cost + future(a) - b.cost - future(b) || costOrder(a, b)).slice(0, algorithmSettings.search.beamQuota));
      keep([...next].sort((a, b) => a.minutes - b.minutes || costOrder(a, b)).slice(0, algorithmSettings.search.beamQuota));
      keep([...next].sort(fitOrder).slice(0, algorithmSettings.search.beamQuota));
      keep([...next].sort((a, b) => heuristic(a) - heuristic(b) || costOrder(a, b)).slice(0, algorithmSettings.search.beamQuota));
      for (const city of vertices) keep(next.filter(path => path.ids.at(-1) === city).sort(fitOrder).slice(0, 3));
      frontier = [...selected.values()];
    }
    if (depth >= preference.minStops) results.push(...frontier.filter(path => mandatory.every(city => path.ids.includes(city))).map(path => path.ids));
    if (!frontier.length) break;
  }
  return results;
}
