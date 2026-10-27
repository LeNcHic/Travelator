import type { CityId, Interest, TripInput } from "../types";
import { cities } from "../data/catalog";
import { preferredStay } from "../data/destination-profiles";
import { destinationScores } from "../data/destination-scores";
import { marginalProgrammePenalty, marginalInterestPenalty } from "./programme";
import { algorithmSettings } from "./algorithm-settings";

interface Edge { to: number; reverse: number; capacity: number; cost: number }
const kinds: Interest[] = ["city", "nature", "sea"];

/** Convex-cost flow: cover every base, avoid one-day stops, then fit the editorial stay ranges. */
export function distributeExperienceDays(ids: CityId[], targets: Record<Interest, number>, assigned: Record<CityId, Interest[]>, pace: TripInput["pace"] = "balanced", fixedDays?: number[]): boolean {
  const sink = ids.length + 4, overflow = sink + 1, graph: Edge[][] = Array.from({ length: sink + 2 }, () => []);
  function edge(from: number, to: number, capacity: number, cost: number): Edge {
    const forward = { to, reverse: graph[to].length, capacity, cost };
    graph[from].push(forward); graph[to].push({ to: from, reverse: graph[from].length - 1, capacity: 0, cost: -cost });
    return forward;
  }
  const minimum = kinds.reduce((sum, kind) => sum + targets[kind], 0);
  if (fixedDays && fixedDays.length !== ids.length) return false;
  const capacities = fixedDays?.map((days, index) => days - assigned[ids[index]].length);
  if (capacities?.some(capacity => capacity < 0)) return false;
  const extra = capacities ? capacities.reduce((sum, days) => sum + days, 0) - minimum : 0;
  if (extra < 0) return false;
  const total = minimum + extra;
  // Fixed manual stays may have spare days above requested minima. Any selected category can fill them.
  if (extra) edge(0, overflow, extra, 0);
  const links: { city: CityId; kind: Interest; edge: Edge; capacity: number }[] = [];
  kinds.forEach((kind, i) => {
    edge(0, i + 1, targets[kind], 0);
    if (extra && targets[kind] + ids.reduce((sum, city) => sum + assigned[city].filter(value => value === kind).length, 0) > 0)
      edge(overflow, i + 1, extra, 0);
    ids.forEach((city, j) => {
      if (!(cities[city].experiences ?? [cities[city].interest]).includes(kind)) return;
      const already = assigned[city].filter(value => value === kind).length;
      for (let day = 0; day < total; day++) links.push({ city, kind, capacity: 1,
        edge: edge(i + 1, j + 4, 1, Math.round((5 - destinationScores[city].experiences[kind]) * algorithmSettings.programme.experienceCost) + marginalInterestPenalty(city, kind, already + day, pace)) });
    });
  });
  ids.forEach((city, j) => {
    if (capacities) { edge(j + 4, sink, capacities[j], 0); return; }
    const profile = preferredStay(city, pace);
    for (let extra = 0; extra < total; extra++) {
      const count = assigned[city].length + extra;
      const cost = count === 0 ? -100000 : count === 1 ? -8000 : count < profile.min ? -100
        : count < profile.max ? (count - profile.min) * 25 : 400 + (count - profile.max + 1) ** 2 * 120;
      edge(j + 4, sink, 1, cost + marginalProgrammePenalty(city, count, pace));
    }
  });
  let filled = 0;
  while (filled < total) {
    const distance = Array(graph.length).fill(Infinity), previous = Array<number>(graph.length).fill(-1), via = Array<number>(graph.length).fill(-1);
    const queue = [0], queued = Array<boolean>(graph.length).fill(false); distance[0] = 0; queued[0] = true;
    for (let head = 0; head < queue.length; head++) {
      const from = queue[head]; queued[from] = false;
      graph[from].forEach((link, index) => {
        if (!link.capacity || distance[link.to] <= distance[from] + link.cost) return;
        distance[link.to] = distance[from] + link.cost; previous[link.to] = from; via[link.to] = index;
        if (!queued[link.to]) { queue.push(link.to); queued[link.to] = true; }
      });
    }
    if (previous[sink] < 0) return false;
    for (let to = sink; to !== 0; to = previous[to]) {
      const link = graph[previous[to]][via[to]]; link.capacity--; graph[to][link.reverse].capacity++;
    }
    filled++;
  }
  links.forEach(link => assigned[link.city].push(...Array<Interest>(link.capacity - link.edge.capacity).fill(link.kind)));
  return ids.every(city => assigned[city].length > 0);
}
