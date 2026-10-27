import { cities } from "../data/catalog";
import { attractionById } from "../data/attractions";
import { destinationScores } from "../data/destination-scores";
import { preferredStay } from "../data/destination-profiles";
import { cityDays, dayCapacity, dayMinutes } from "./city-planner";
import { daysText, duration, money, plural } from "./format";
import { experienceAllocation, interestNames, placesFor } from "./journey";
import { routeFit } from "./destination-fit";
import { totals } from "./planner";
import { programmeSize } from "./programme";
import type { CityId, Interest, RoutePlan, TripInput } from "../types";

const paceNames = { slow: "спокойного", balanced: "умеренного", active: "насыщенного" } as const;
export function stopReason(plan: RoutePlan, input: TripInput, city: CityId) {
  const index = plan.cities.indexOf(city), days = plan.days[index];
  const profile = preferredStay(city, input.pace), mandatory = placesFor(input, city), programme = programmeSize(city, input.pace);
  const allocation = experienceAllocation(plan.cities, input, plan.days.reduce((sum, count) => sum + count, 0), plan.days)?.[city] ?? [];
  const kinds = [...new Set(allocation)] as Interest[];
  const experiences = kinds.map(kind => ({ kind, label: interestNames[kind], days: allocation.filter(value => value === kind).length }));
  const visits = cityDays(plan, input, city), count = new Set(visits.flat()).size;
  const minutes = visits.reduce((sum, ids) => sum + dayMinutes(ids), 0), freeDays = visits.filter(ids => !ids.length).length;
  const inRange = days >= profile.min && days <= profile.max;
  const why = mandatory.length ? `Здесь ваши обязательные места: ${mandatory.map(place => place.name).join(", ")}.`
    : input.required.includes(city) ? "Этот город включён по вашему пожеланию."
      : `${destinationScores[city].reason}.`;
  const otherStops = plan.cities.flatMap((other, i) => other === city ? [] : [`${cities[other].name} — ${daysText(plan.days[i])}`]).join(", ");
  const coverage = experiences.map(item => `${item.label.toLocaleLowerCase("ru")} — ${daysText(item.days)}`).join(", ");
  const daysReason = `${daysText(days)}: ${inRange ? `в пределах ориентира ${profile.min}–${profile.max} дней` : days < profile.min ? `короткая остановка, ниже ориентира ${profile.min}–${profile.max} дней` : `дольше обычного ориентира ${profile.min}–${profile.max} дней`} для ${paceNames[input.pace]} темпа. ${coverage ? `В распределении: ${coverage}.` : ""}${otherStops ? ` Остальные дни: ${otherStops}. Общий срок сохраняем.` : ""} В каталоге: ${programme.places} мест, ${duration(programme.visits)} посещений и около ${duration(programme.transfers)} местных перемещений. Учтён запас свободного времени.`;
  const load = count ? `${count} ${plural(count, ["место", "места", "мест"])} в плане, около ${duration(minutes)} с запасом между посещениями. Ориентир темпа — до ${duration(dayCapacity(input.pace))} в день.` : "Посещения пока не назначены: дни оставлены свободными.";
  const caveat = freeDays ? `${freeDays} ${plural(freeDays, ["день без назначенных посещений", "дня без назначенных посещений", "дней без назначенных посещений"])}: ${cities[city].interest === "sea" ? "свободный отдых у моря; купание зависит от сезона и условий" : "запас для отдыха, погоды и самостоятельных прогулок"}. ${days > programme.contentDays ? "Уникальной программы в подборке на весь срок недостаточно; длительность сохраняет ваш срок и допустимое число остановок. " : ""}Длительные выезды, не подходящие выбранному темпу, автоматически не назначаем; их можно добавить вручную.` : "";
  return { city, why, daysReason, load, caveat, days, profile, inRange, minutes, count, freeDays, experiences,
    highlights: visits.flat().flatMap(id => { const place = attractionById(id); return place ? [place.name] : []; }).slice(0, 3),
    method: "Дни распределены между всеми городами с учётом срока, интересов, темпа и обязательных мест. Диапазоны и длительности — ориентиры для планирования; дни дороги не вычитаем." };
}

export function alternativeTitle(reference: RoutePlan, plan: RoutePlan, input: TripInput): string {
  const before = totals(reference, input), after = totals(plan, input);
  if (plan.cities.length < reference.cities.length) return "Меньше переездов";
  if (after.total < before.total - .01) return "Экономнее";
  if (after.minutes < before.minutes) return "Меньше времени в дороге";
  const added = plan.cities.filter(city => !reference.cities.includes(city));
  return added.length === 1 ? `Другой акцент: ${cities[added[0]].name}` : "Другие места и впечатления";
}

/** Relative facts describe this actual option; no synthetic claim of global optimality. */
export function routeChoiceReason(plan: RoutePlan, input: TripInput, reference?: RoutePlan) {
  const t = totals(plan, input);
  const allocation = experienceAllocation(plan.cities, input, plan.days.reduce((sum, count) => sum + count, 0), plan.days);
  const parts = [allocation ? `${new Set(Object.values(allocation).flat()).size} ${plural(new Set(Object.values(allocation).flat()).size, ["формат отдыха", "формата отдыха", "форматов отдыха"])}` : "Ваши интересы",
    `${plan.cities.length} ${plural(plan.cities.length, ["город", "города", "городов"])} на ${daysText(input.days)}`];
  if (reference) {
    const before = totals(reference, input), delta = Math.round((t.total - before.total) * 100) / 100;
    parts.push(delta < 0 ? `на ${money(-delta)} дешевле рекомендации` : delta > 0 ? `на ${money(delta)} дороже рекомендации` : "та же предварительная стоимость");
  } else parts.push(`около ${money(t.total)} на жильё и переезды`);
  return parts.join(" · ");
}

export function routeChoiceAssessment(plan: RoutePlan, input: TripInput, alternatives: RoutePlan[]) {
  const choices = alternatives.length ? alternatives : [plan];
  const evaluate = (candidate: RoutePlan) => {
    const allocation = experienceAllocation(candidate.cities, input, candidate.days.reduce((sum, days) => sum + days, 0), candidate.days);
    return { candidate, ...totals(candidate, input), fit: routeFit(candidate, input, allocation).total };
  };
  const rows = choices.map(evaluate), current = evaluate(plan);
  const minimum = Math.min(...rows.map(row => row.total)), fastest = Math.min(...rows.map(row => row.minutes)), bestFit = Math.max(...rows.map(row => row.fit));
  const costAboveMinimum = Math.round((current.total - minimum) * 100) / 100, minutesAboveFastest = current.minutes - fastest;
  const fitGap = bestFit - current.fit;
  const strengths: string[] = [];
  if (choices.length > 1) {
    if (costAboveMinimum < .01) strengths.push("Самая низкая стоимость среди показанных");
    if (minutesAboveFastest === 0 && current.minutes > 0) strengths.push("Меньше всего времени в дороге среди показанных");
    if (fitGap < .01 && !strengths.length) strengths.push("Лучшее соответствие интересам среди показанных по модели приложения");
  }
  if (!strengths.length) strengths.push(choices.length > 1 ? "Другой набор мест с сохранением ваших обязательных остановок" : "Подходит вашим интересам и сроку");
  const tradeoff = costAboveMinimum > .01 ? `На ${money(costAboveMinimum)} дороже минимальной оценки.`
    : minutesAboveFastest > 0 ? `Дорога на ${duration(minutesAboveFastest)} дольше самого быстрого варианта.` : "";
  return { strength: strengths.slice(0, 2).join(". ") + ".", tradeoff, costAboveMinimum, minutesAboveFastest, fitGap };
}
