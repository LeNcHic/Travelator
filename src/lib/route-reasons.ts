import { cities } from "../data/catalog";
import { attractionById } from "../data/attractions";
import { destinationAngles, destinationIntroductions, visitAdvice } from "../data/travel-narratives";
import { preferredStay } from "../data/destination-profiles";
import { coastalSeasonNote } from "../data/china-knowledge";
import { cityDays, cityDayCapacity, dayCapacity, dayMinutes } from "./city-planner";
import { daysText, duration, money, plural } from "./format";
import { experienceAllocation, interestNames, placesFor } from "./journey";
import { routeFit } from "./destination-fit";
import { schedule, totals } from "./planner";
import { hasExactDates } from "./trip-timing";
import type { CityId, Interest, RoutePlan, TripInput } from "../types";

const joinIdeas = (items: string[]) => items.length < 2 ? items[0] ?? "" : `${items.slice(0, -1).join(", ")} и ${items.at(-1)}`;
function allocatedExperiences(plan: RoutePlan, input: TripInput) {
  return experienceAllocation(plan.cities, input, plan.days.reduce((sum, count) => sum + count, 0), plan.days);
}
function dominantKind(city: CityId, allocation: Partial<Record<CityId, Interest[]>> | null | undefined): Interest {
  const days = allocation?.[city] ?? [];
  if (!days.length) return cities[city].interest;
  return (["city", "nature", "sea"] as Interest[]).sort((a, b) => days.filter(kind => kind === b).length - days.filter(kind => kind === a).length)[0];
}

/** Personal prose is assembled only from the current itinerary, never invented provider facts. */
export function stopReason(plan: RoutePlan, input: TripInput, city: CityId) {
  const index = plan.cities.indexOf(city), days = plan.days[index];
  const profile = preferredStay(city, input.pace), mandatory = placesFor(input, city), allocation = allocatedExperiences(plan, input);
  const assigned = allocation?.[city] ?? [];
  const kinds = [...new Set(assigned)] as Interest[];
  const experiences = kinds.map(kind => ({ kind, label: interestNames[kind], days: assigned.filter(value => value === kind).length }));
  const visits = cityDays(plan, input, city), count = new Set(visits.flat()).size;
  const minutes = visits.reduce((sum, ids) => sum + dayMinutes(ids), 0), freeDays = visits.filter(ids => !ids.length).length;
  const firstCapacity = cityDayCapacity(plan, input, index, 0), capacity = dayCapacity(input.pace);
  const overloadedDays = visits.filter((ids, day) => dayMinutes(ids) > (day === 0 ? firstCapacity : capacity)).length;
  const highlights = [...new Set(visits.flat())].flatMap(id => { const place = attractionById(id); return place ? [place.name] : []; }).slice(0, 3);
  const inRange = days >= profile.min && days <= profile.max, kind = dominantKind(city, allocation);
  const introduction = destinationIntroductions[city]?.[kind]
    ?? `«${cities[city].name}» добавляет в маршрут свой акцент: ${destinationAngles[city]}.`;
  const requirement = mandatory.length
    ? `Ваше обязательное пожелание — ${joinIdeas(mandatory.map(place => `«${place.name}»`))}; оно включено в программу.` : "";
  const focus = highlights.filter(name => !mandatory.some(place => place.name === name)).slice(0, 2);
  const programme = focus.length ? `В текущем плане — ${joinIdeas(focus.map(name => `«${name}»`))}.` : "";
  const why = [introduction, requirement, programme].filter(Boolean).join(" ");
  const busyDays = days - freeDays;
  const freeTime = freeDays ? `${daysText(freeDays)} ${plural(freeDays, ["остаётся", "остаются", "остаются"])} без назначенных посещений` : "";
  const longest = visits.flat().map(attractionById).filter(place => !!place).sort((a, b) => b.minutes - a.minutes)[0];
  let daysReason: string;
  if (days > profile.max) daysReason = `${daysText(days)} — больше обычного ориентира для этого места (${profile.min}–${profile.max}). ${busyDays ? `Программа распределена на ${daysText(busyDays)}; дополнительные дни стоит оставлять здесь, только если вам нужен самостоятельный отдых.` : "Сначала стоит наполнить программу, прежде чем оставлять здесь весь этот срок."}`;
  else if (!count) daysReason = `На эту остановку выделено ${daysText(days)}, но места пока не добавлены. Сначала выберите, что хотите увидеть: после этого будет понятнее, нужен ли весь срок.`;
  else if (freeDays >= days / 2 && kind !== "sea") daysReason = `Выделено ${daysText(days)}, а посещения сейчас занимают только ${daysText(busyDays)}. Если свободные дни не нужны для собственных планов, часть времени можно перенести в другую остановку.`;
  else if (kind === "sea" && freeDays) daysReason = `Из ${days} ${plural(days, ["дня", "дней", "дней"])} программа занимает ${daysText(busyDays)}; ещё ${daysText(freeDays)} можно оставить для побережья. Такой срок подходит, если свободный отдых для вас так же важен, как посещение мест.`;
  else if (days < profile.min) daysReason = `${daysText(days)} — короткая остановка относительно ориентира ${profile.min}–${profile.max}. ${longest ? `Главный по времени пункт — «${longest.name}» (${duration(longest.minutes)} на посещение); остальные места лучше подстраивать вокруг него.` : "Лучше выбрать один главный акцент."}`;
  else if (longest && longest.minutes >= 300) daysReason = `Для пункта «${longest.name}» предусмотрено около ${duration(longest.minutes)} на посещение. При остановке на ${daysText(days)} его лучше сделать основой отдельного дня, а остальные места распределить по оставшимся.${freeDays ? ` Ещё ${daysText(freeDays)} — без назначенных посещений.` : ""}`;
  else daysReason = `${daysText(days)}: ${count} ${plural(count, ["место", "места", "мест"])} ${plural(count, ["распределено", "распределены", "распределены"])} на ${daysText(busyDays)}${freeDays ? `, ещё ${daysText(freeDays)} — без назначенных посещений` : ""}. ${input.pace === "slow" ? "Сохраняйте паузы между прогулками: выбранный спокойный темп важнее количества остановок за день." : input.pace === "active" ? "Дополнять программу стоит с учётом загрузки каждого дня, а не только числа мест." : "Свободные промежутки удобнее оставить на еду, дорогу и прогулки по настроению."}`;
  const previous = plan.cities[index - 1];
  const rows = schedule(plan,input), incoming = index > 0 ? rows[index - 1].ticket : null;
  const previousKind = previous ? dominantKind(previous, allocation) : null;
  const connection = input.seaEnd && index === plan.cities.length - 1 && kind === "sea" ? "Завершаем путешествие у моря, как вы и хотели."
    : incoming?.mode === "train" && incoming.minutes <= 120 ? `От остановки «${cities[previous].name}» — около ${duration(incoming.minutes)} на поезде: эти места можно сочетать без длинного переезда.`
      : previous && previousKind === kind ? `По сравнению с остановкой «${cities[previous].name}» (${destinationAngles[previous]}) здесь другой акцент: ${destinationAngles[city]}.` : "";
  const load = count ? `${count} ${plural(count, ["место", "места", "мест"])}: ${joinIdeas(highlights.map(name => `«${name}»`))}${count > highlights.length ? " и другие" : ""}. Примерно ${duration(minutes)} на посещения и заложенные промежутки между ними за всю остановку. Это оценка программы, а не расчёт местных дорог.${freeDays ? ` ${freeTime}.` : ""}`
    : "Места пока не добавлены. Их можно выбрать в плане по дням — свободное время останется под вашим контролем.";
  const practical = visitAdvice.find(advice => advice.ids.some(id => visits.flat().includes(id)))?.text ?? "";
  const notes: string[] = [];
  if (overloadedDays) {
    const day = visits.findIndex((ids, day) => dayMinutes(ids) > (day === 0 ? firstCapacity : capacity));
    const empty = visits.findIndex(ids => !ids.length);
    notes.push(`${overloadedDays} ${plural(overloadedDays, ["день получился плотнее", "дня получились плотнее", "дней получились плотнее"])} выбранного темпа. В ${day + 1}-й день остановки заложено ${duration(dayMinutes(visits[day]))}; ${empty >= 0 ? `часть мест можно перенести на свободный ${empty + 1}-й день.` : "перенесите часть мест или уберите менее важное."}`);
  }
  if (days > profile.max && freeDays) notes.push(`${freeTime}.`);
  if (firstCapacity < capacity) notes.push("В день приезда на прогулки останется меньше времени из-за переезда.");
  const season = hasExactDates(input) && kind === "sea" ? coastalSeasonNote(city, rows[index].date) : null;
  if (season) notes.push(season);
  return { city, why, daysReason, connection, load, caveat: notes.join(" "), days, profile, inRange, minutes, count, freeDays, experiences, overloadedDays, highlights, practical,
    method: "Рекомендация учитывает ваши интересы, выбранный темп, обязательные места и текущий план посещений." };
}

/** An itinerary overview in the same voice as individual stay recommendations. */
export function routeStory(plan: RoutePlan, input: TripInput) {
  const allocation = allocatedExperiences(plan, input), rows = schedule(plan, input), t = totals(plan, input);
  const overview = plan.cities.length === 1
    ? `«${cities[plan.cities[0]].name}» — одна база на ${daysText(plan.days[0])}. Главный акцент: ${destinationAngles[plan.cities[0]]}. Можно знакомиться с окрестностями, сохраняя одну гостиницу.`
    : `У каждой остановки своя роль. ${plan.cities.map((city, index) => `«${cities[city].name}» (${daysText(plan.days[index])}) — ${destinationAngles[city]}`).join("; ")}.`;

  const mandatory = placesFor(input).map(place => `«${place.name}»`);
  const preserved = mandatory.length ? `Ваши обязательные места — ${joinIdeas(mandatory)} — сохранены в программе.`
    : input.required.length ? `Обязательные города ${joinIdeas(input.required.map(city => `«${cities[city].name}»`))} включены в маршрут.` : "";
  const finish = input.seaEnd && dominantKind(plan.cities.at(-1)!, allocation) === "sea" ? "Морской отдых оставили на финал, как вы хотели." : "";
  const transport = plan.tickets.length ? `Между городами предлагаем ${joinIdeas([rows.some(row => row.ticket?.mode === "train") ? "поезда" : "", rows.some(row => row.ticket?.mode === "air") ? "перелёты" : ""].filter(Boolean))}; суммарно около ${duration(t.minutes)} с запасом на ${joinIdeas([rows.some(row => row.ticket?.mode === "train") ? "вокзалы" : "", rows.some(row => row.ticket?.mode === "air") ? "аэропорты" : ""].filter(Boolean))}. ${t.demoTickets > 0 ? "Часть расписаний и цен пока ориентировочная — их можно уточнить в плане." : t.estimatedTickets > 0 ? "Расписания проверены, а стоимость поездов остаётся ориентировочной." : "Источники и время проверки билетов указаны в плане."}`
    : "Можно сосредоточиться на отдыхе и выездах из одной базы, не меняя гостиницу между городами.";
  const longStops = plan.cities.filter((city,index) => plan.days[index] > preferredStay(city,input.pace).max);
  const caveat = longStops.length ? `Остановки ${joinIdeas(longStops.map(city => `«${cities[city].name}»`))} дольше обычного ориентира. Посмотрите программу по дням: свободное время можно оставить для отдыха или перераспределить.` : "";
  return { overview, personal: [preserved, finish].filter(Boolean).join(" "), transport, caveat };
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
    if (costAboveMinimum < .01) strengths.push("По стоимости это один из самых доступных вариантов среди предложенных");
    if (minutesAboveFastest === 0 && current.minutes > 0) strengths.push("Здесь меньше всего времени уходит на дорогу среди предложенных вариантов");
    if (fitGap < .01 && !strengths.length) strengths.push("Среди предложенных вариантов этот ближе всего к вашим интересам");
  }
  if (!strengths.length) strengths.push(choices.length > 1 ? "Предлагаем другой взгляд на поездку, сохраняя ваши обязательные остановки" : "Собрали поездку под ваши интересы и срок");
  const tradeoff = costAboveMinimum > .01 ? `На ${money(costAboveMinimum)} дороже минимальной оценки.`
    : minutesAboveFastest > 0 ? `Дорога на ${duration(minutesAboveFastest)} дольше самого быстрого варианта.` : "";
  return { strength: strengths.slice(0, 2).join(". ") + ".", tradeoff, costAboveMinimum, minutesAboveFastest, fitGap };
}
