import type { RoutePlan, TripInput } from "../types";
import { coastalSeasonNote } from "../data/china-knowledge";
import { cities } from "../data/catalog";
import { daysText, duration, money, plural } from "./format";
import { experienceAllocation, interestNames, interests, mandatoryCities, placesFor, updateJourney } from "./journey";
import { generateRoutes, schedule, totals } from "./planner";
import { isAutomaticTrip, hasExactDates } from "./trip-timing";
import { routeFit } from "./destination-fit";

export type AdjustmentId = "fewer-stops" | "more-nature" | "sea-last";
export interface RouteAdjustment {
  id: AdjustmentId;
  label: string;
  hint: string;
  input?: TripInput;
  message?: string;
  active?: boolean;
}

/** Offer only changes that produce a complete trip within the same holiday and budget. */
export function routeAdjustments(input: TripInput, plan: RoutePlan): RouteAdjustment[] {
  if (!input.journey) return [];
  const preference = input.journey;
  const find = (next: TripInput) => generateRoutes(next).plans[0];
  const feasible = (next: TripInput) => Boolean(find(next));
  const fewer: RouteAdjustment = { id: "fewer-stops", label: "Меньше переездов", hint: "Для этих пожеланий уже минимум" };
  const maximum = plan.cities.length - 1;
  if (maximum >= Math.max(1, mandatoryCities(input).length)) {
    const next = updateJourney(input, { ...preference, minStops: Math.min(preference.minStops, maximum), maxStops: maximum });
    if (feasible(next)) Object.assign(fewer, { input: next, hint: `До ${maximum} ${plural(maximum, ["базы", "баз", "баз"])} с ночёвкой`,
      message: `Сократили число баз: теперь до ${maximum}. Обязательные места и минимумы отдыха сохранены.` });
  } else if (mandatoryCities(input).length > maximum) fewer.hint = "Все города обязательные";

  const nature: RouteAdjustment = { id: "more-nature", label: "Больше природы", hint: "В этот срок больше не помещается" };
  const natureDays = routeExplanation(plan, input).experiences.find(item => item.kind === "nature")?.days ?? 0;
  if (natureDays < 14) {
    const distribution = { ...preference.daysByInterest, nature: natureDays + 1 };
    const next = updateJourney(input, { ...preference, daysByInterest: distribution });
    if (feasible(next)) Object.assign(nature, { input: next, hint: `${natureDays} → ${distribution.nature} дн. на природе`, message: `На природу: было ${daysText(natureDays)}, теперь не меньше ${daysText(distribution.nature)}. Общий срок и остальные минимумы отдыха сохранены.` });
    else {
      for (const donor of [...(["city", "sea"] as const)].sort((a, b) => distribution[b] - distribution[a])) {
        const floors = new Map<string, number>();
        placesFor(input).filter(place => place.interest === donor).forEach(place => floors.set(place.city, Math.max(floors.get(place.city) ?? 0, place.minDays)));
        const minimum = Math.max(distribution[donor] > 0 ? 1 : 0, [...floors.values()].reduce((a, b) => a + b, 0));
        if (distribution[donor] <= minimum) continue;
        const candidate = updateJourney(input, { ...preference, daysByInterest: { ...distribution, [donor]: distribution[donor] - 1 } });
        if (!feasible(candidate)) continue;
        Object.assign(nature, { input: candidate, hint: `${natureDays} → ${distribution.nature} дн. · за счёт категории «${interestNames[donor]}»`,
          message: `На природу: было ${daysText(natureDays)}, теперь не меньше ${daysText(distribution.nature)}. Категорию «${interestNames[donor]}» сократили на день. Общий срок и обязательные места сохранены.` });
        break;
      }
    }
  } else nature.hint = `Природе уже отведено ${daysText(natureDays)}`;

  const sea: RouteAdjustment = { id: "sea-last", label: "Закончить у моря", active: input.seaEnd, hint: "Добавьте море в пожелания" };
  if (preference.daysByInterest.sea > 0) {
    const next = { ...input, seaEnd: !input.seaEnd };
    const nextPlan = find(next);
    if (nextPlan) {
      const coast = cities[(input.seaEnd ? plan : nextPlan).cities.at(-1)!].name;
      const sameOrder = nextPlan.cities.join() === plan.cities.join();
      Object.assign(sea, { input: next, hint: input.seaEnd ? `${coast} в конце · нажмите, чтобы снять условие` : "Морская остановка перед возвращением",
        message: input.seaEnd ? `Условие «море в конце» снято. ${sameOrder ? `Текущий порядок городов остался самым подходящим; последняя остановка — ${coast}.` : "Порядок городов снова подбирается автоматически."}`
          : `${sameOrder ? "Закрепили отдых у моря в конце поездки, сохранив подходящий порядок городов." : "Перенесли отдых у моря в конец поездки."} Последняя остановка — ${coast}.` });
    }
    else sea.hint = "Не удаётся совместить с пожеланиями";
  }
  return [fewer, nature, sea];
}

/** Explain the allocation actually present in the selected plan, including excursions. */
export function routeExplanation(plan: RoutePlan, input: TripInput) {
  const allocation = input.journey ? experienceAllocation(plan.cities, input, plan.days.reduce((a, b) => a + b, 0), plan.days) : null;
  const experiences = interests.flatMap(kind => {
    const days = allocation ? Object.values(allocation).flat().filter(value => value === kind).length
      : plan.cities.reduce((sum, city, index) => sum + (cities[city].interest === kind ? plan.days[index] : 0), 0);
    return days ? [{ kind, name: interestNames[kind], days }] : [];
  });
  const rows = schedule(plan, input), t = totals(plan, input);
  const stops = plan.cities.map(city => ({ city, kinds: [...new Set(allocation?.[city] ?? [cities[city].interest])].map(kind => interestNames[kind]) }));
  const shortTrains = rows.filter(row => row.ticket?.mode === "train" && row.ticket.minutes <= 120);
  const rationale = isAutomaticTrip(input) ? "Этот вариант сохраняет обязательные места и срок, сочетает ваши интересы, стоимость и дорогу. Другие варианты отбираем по отличающимся наборам городов, без искусственных дубликатов." : plan.id === "value" ? "Среди вариантов с сопоставимым ритмом этот даёт минимальную стоимость проживания и переездов."
    : plan.id === "fast" ? "Среди вариантов с сопоставимым ритмом этот требует меньше всего времени на переезды внутри Китая."
    : input.journey ? "Этот вариант сочетает соответствие мест вашим интересам, стоимость и время переездов внутри Китая."
    : "Этот вариант выбирает компромисс между стоимостью и временем на переезды внутри Китая.";
  const order = input.journey && input.seaEnd ? `Последняя база — ${cities[plan.cities.at(-1)!].name}: отдых у моря в конце поездки.`
    : "Порядок городов подбирается по стоимости и времени переездов внутри Китая. Международные рейсы ещё не сравниваем.";
  const calendar = isAutomaticTrip(input) ? `${daysText(input.days)} на остановки и посещения; время дороги из срока не вычитаем` : `${daysText(plan.days.reduce((a, b) => a + b, 0))} на месте${plan.calendarMode === "shared" ? `, включая ${plan.tickets.length} дн. приезда${t.extraTransferDays ? ` · ещё ${t.extraTransferDays} дн. в пути` : ""}` : ` · ${daysText(t.transferDays)} на переезды`}${input.journey ? " · 2 дня на международную дорогу" : ""}`;
  const transport = shortTrains.length ? `${shortTrains.length} ${plural(shortTrains.length, ["короткий поезд", "коротких поезда", "коротких поездов"])}: ${shortTrains.map(row => `${cities[row.city].name} → ${cities[row.ticket!.to].name}, ${duration(row.ticket!.minutes)}`).join("; ")}.`
    : plan.tickets.length ? "Между этими базами предложены перелёты; расписания и стоимость пока оценочные." : "Одна база с ночёвкой: переездов между городами нет.";
  const seasonalNotes = (hasExactDates(input) ? rows : []).flatMap(row => { const note = coastalSeasonNote(row.city, row.date); return note ? [`${cities[row.city].name}: ${note}`] : []; });
  return { experiences, stops, rationale, order, calendar, transport, seasonalNotes, fit: routeFit(plan, input, allocation) };
}

export function routeDifference(reference: RoutePlan, alternative: RoutePlan, input: TripInput): string {
  const before = totals(reference, input), after = totals(alternative, input);
  const cost = Math.round((after.total - before.total) * 100) / 100, time = after.minutes - before.minutes;
  const changes: string[] = [];
  const sameOrder = reference.cities.join() === alternative.cities.join();
  const sameCities = reference.cities.length === alternative.cities.length && reference.cities.every(city => alternative.cities.includes(city));
  const sameDays = sameOrder && reference.days.join() === alternative.days.join();
  const added = alternative.cities.filter(city => !reference.cities.includes(city));
  const removed = reference.cities.filter(city => !alternative.cities.includes(city));
  const structure = !sameCities ? added.length === 1 && removed.length === 1
    ? `${cities[added[0]].name} вместо ${cities[removed[0]].name}`
    : added.length ? `Другие города: ${added.map(city => cities[city].name).join(", ")}` : "Меньше остановок"
    : !sameOrder ? "Те же города, другой порядок"
    : !sameDays ? "Те же города, другое распределение дней"
    : reference.tickets.join() !== alternative.tickets.join() ? "Те же города и дни, другие переезды"
    : reference.hotels.join() !== alternative.hotels.join() ? "Те же города и дни, другие гостиницы"
    : "Те же города и дни";
  if (cost) changes.push(`${money(Math.abs(cost))} ${cost < 0 ? "экономии" : "дороже"}`);
  if (time) changes.push(`на ${duration(Math.abs(time))} ${time < 0 ? "меньше" : "больше"} в дороге`);
  return `${structure}. ${changes.join(" · ")}`.trim();
}
