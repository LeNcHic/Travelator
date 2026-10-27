import { travelMoments, type TravelMoment } from "../data/travel-moments";
import type { CityId, RoutePlan, TripInput } from "../types";
import { addDays, displayDate } from "./format";
import { schedule } from "./planner";

export interface DatePeriod { start: string; end: string }
export interface MomentMatch { moment: TravelMoment; overlap: DatePeriod }

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function validPeriod(period: DatePeriod): boolean {
  return isCalendarDate(period.start) && isCalendarDate(period.end) && period.start <= period.end
    && Number(period.end.slice(0, 4)) - Number(period.start.slice(0, 4)) <= 2;
}
export function intersectPeriods(a: DatePeriod, b: DatePeriod): DatePeriod | null {
  if (!validPeriod(a) || !validPeriod(b)) return null;
  const start = a.start > b.start ? a.start : b.start, end = a.end < b.end ? a.end : b.end;
  return start <= end ? { start, end } : null;
}
export function holidayPeriod(start: string, days: number, international = true): DatePeriod | null {
  if (!isCalendarDate(start) || !Number.isInteger(days) || days < 5 || days > 28) return null;
  return { start: addDays(start, international ? 1 : 0), end: addDays(start, days - 1 - (international ? 1 : 0)) };
}
export function cityPeriod(plan: RoutePlan, input: TripInput, index: number): DatePeriod {
  const row = schedule(plan, input)[index];
  return { start: row.date, end: addDays(row.date, plan.days[index] - 1) };
}

function seasonalOverlap(period: DatePeriod, months: number[]): DatePeriod | null {
  let first: string | undefined, last: string | undefined;
  const cursor = new Date(`${period.start.slice(0, 7)}-01T00:00:00Z`);
  while (cursor.toISOString().slice(0, 10) <= period.end) {
    if (months.includes(cursor.getUTCMonth() + 1)) {
      const start = cursor.toISOString().slice(0, 10);
      const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
      const overlap = intersectPeriods(period, { start, end });
      if (overlap) { first ??= overlap.start; last = overlap.end; }
    } else if (first) break; // Do not span an off-season gap in a long query.
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return first && last ? { start: first, end: last } : null;
}

export function momentsForPeriod(period: DatePeriod | null, city?: CityId, catalogue = travelMoments): MomentMatch[] {
  if (!period || !validPeriod(period)) return [];
  return catalogue.flatMap(moment => {
    if (city && moment.city && moment.city !== city) return [];
    const overlap = moment.dates ? intersectPeriods(period, moment.dates)
      : moment.months ? seasonalOverlap(period, moment.months) : null;
    return overlap ? [{ moment, overlap }] : [];
  }).sort((a, b) => {
    const order = { holiday: 0, event: 1, season: 2 };
    return order[a.moment.kind] - order[b.moment.kind] || a.overlap.start.localeCompare(b.overlap.start);
  });
}

export function periodLabel(period: DatePeriod): string {
  if (!validPeriod(period)) return "Выберите даты";
  const sameYear = period.start.slice(0, 4) === period.end.slice(0, 4);
  const withYear = (value: string) => `${displayDate(value)} ${value.slice(0, 4)}`;
  if (period.start === period.end) return withYear(period.start);
  return sameYear ? `${displayDate(period.start)} — ${withYear(period.end)}` : `${withYear(period.start)} — ${withYear(period.end)}`;
}

export function missingCalendarYears(period: DatePeriod, covered: readonly number[]): number[] {
  if (!validPeriod(period)) return [];
  const missing: number[] = [];
  for (let year = Number(period.start.slice(0, 4)); year <= Number(period.end.slice(0, 4)); year++) {
    if (!covered.includes(year)) missing.push(year);
  }
  return missing;
}
