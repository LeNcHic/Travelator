import { priorityLabels, routeSignature, schedule, totals } from "./planner";
import { duration, money } from "./format";
import type { RoutePlan, TripInput, TripPriority } from "../types";

export interface RouteVariant { plan: RoutePlan; labels: TripPriority[]; key: string }
export interface RouteOptionGroup { key: string; variants: RouteVariant[] }

/** Group only identical sleeping bases and calendars; arrival times can still differ between variants. */
export function itineraryKey(plan: RoutePlan, input: TripInput): string {
  return JSON.stringify([plan.calendarMode, schedule(plan, input).map(row =>
    [row.city, row.date, row.endDate, row.checkIn, row.checkOut, row.transferGap])]);
}

export function defaultVariant(group: RouteOptionGroup, priority: TripPriority): RouteVariant {
  return group.variants.find(variant => variant.labels.includes(priority)) ?? group.variants[0];
}

export function variantTitle(variant: RouteVariant): string {
  const labels = variant.labels;
  if (labels.includes("value") && !labels.includes("fast")) return priorityLabels.value;
  if (labels.includes("fast") && !labels.includes("value")) return priorityLabels.fast;
  return priorityLabels[labels.includes("balance") ? "balance" : labels[0]];
}

export function variantTradeoff(reference: RoutePlan, plan: RoutePlan, input: TripInput): string {
  const before = totals(reference, input), after = totals(plan, input);
  const cost = Math.round((after.total - before.total) * 100) / 100, minutes = after.minutes - before.minutes;
  return [cost ? `${money(Math.abs(cost))} ${cost < 0 ? "экономии" : "дороже"}` : "",
    minutes ? `на ${duration(Math.abs(minutes))} ${minutes < 0 ? "меньше" : "больше"} в дороге` : ""].filter(Boolean).join(" · ") || "Другое предложение по той же цене и времени";
}

export function groupRouteOptions(plans: RoutePlan[], input: TripInput): RouteOptionGroup[] {
  const groups: RouteOptionGroup[] = [];
  for (const plan of plans) {
    const key = itineraryKey(plan, input), signature = routeSignature(plan);
    let group = groups.find(group => group.key === key);
    if (!group) { group = { key, variants: [] }; groups.push(group); }
    const same = group.variants.find(variant => variant.key === signature);
    if (same) { if (!same.labels.includes(plan.id)) same.labels.push(plan.id); }
    else group.variants.push({ plan, labels: [plan.id], key: signature });
  }
  const main = groups.find(group => group.variants.some(variant => variant.labels.includes(input.priority)));
  return main ? [main, ...groups.filter(group => group !== main)] : groups;
}
