import { internationalDays } from "../lib/trip-timing";
import { Plane } from "lucide-react";
import { cities } from "../data/catalog";
import { addDays, displayDate } from "../lib/format";
import { experienceAllocation, interestNames, interests } from "../lib/journey";
import type { CityId, RoutePlan, TripInput } from "../types";

export function ExperienceTags({ plan, input, city }: { plan: RoutePlan; input: TripInput; city?: CityId }) {
  if (!input.journey) return null;
  const allocation = experienceAllocation(plan.cities, input, plan.days.reduce((a, b) => a + b, 0), plan.days);
  const days = city ? allocation?.[city] ?? [] : Object.values(allocation ?? {}).flat();
  return <div className="tv-experience-tags">{interests.map(key => {
    const count = days.filter(day => day === key).length;
    return count ? <span key={key}>{interestNames[key]} · {count} дн.</span> : null;
  })}</div>;
}

export function FlightStage({ input, city, returning = false }: { input: TripInput; city: CityId; returning?: boolean }) {
  if (!internationalDays(input)) return null;
  return <div className="tv-route-endcap"><Plane /><span><strong>{returning ? `${cities[city].name} → Москва` : `Москва → ${cities[city].name}`}</strong>
    <small>{displayDate(returning ? addDays(input.startDate, input.days - 1) : input.startDate)} · день {returning ? input.days : 1} · перелёт ещё не подобран</small></span></div>;
}
