import { algorithmSettings } from "./algorithm-settings";
import { placeInterest } from "./attraction-interest";
import { cities, cityIds } from "../data/catalog";
import { attractions } from "../data/attractions";
import { baseCatalog, publishedBaseIds } from "../data/destination-catalog";
import { destinationScores } from "../data/destination-scores";
import type { CityId, Interest, JourneyPreferences, TripInput } from "../types";
import { addDays } from "./format";
import { chinaKnowledge } from "../data/china-knowledge";
import { distributeExperienceDays } from "./stay-allocation";
import { buildRouteGraph, weightedCityPaths } from "./route-graph";
import { availableTripDays, hasExactDates, internationalDays, tripDayOffset, isAutomaticTrip } from "./trip-timing";

export const interestNames: Record<Interest, string> = { city: "Города и культура", nature: "Природа", sea: "Море" };
export const interests: Interest[] = ["city", "nature", "sea"];
const legacyRequiredPlaces = [
  { id: "sha-bund", name: "Набережная Вайтань", city: "sha", interest: "city", minDays: 1 },
  { id: "bei-palace", name: "Запретный город", city: "bei", interest: "city", minDays: 1 },
  { id: "bei-wall", name: "Великая китайская стена", city: "bei", interest: "nature", minDays: 1 },
  { id: "zjj-yuanjiajie", name: "Парк Чжанцзяцзе", city: "zjj", interest: "nature", minDays: 2 },
  { id: "zjj-tianmen", name: "Гора Тяньмэнь", city: "zjj", interest: "nature", minDays: 1 },
  { id: "gui-yangshuo", name: "Яншо и река Ли", city: "gui", interest: "nature", minDays: 1 },
  { id: "san-yalong", name: "Бухта Ялунвань", city: "san", interest: "sea", minDays: 1 },
  { id: "qin-laoshan", name: "Горы Лаошань", city: "qin", interest: "nature", minDays: 1 },
  { id: "xmn-gulangyu", name: "Остров Гуланъюй", city: "xmn", interest: "city", minDays: 1 },
  { id: "bha-silver", name: "Серебряный пляж", city: "bha", interest: "sea", minDays: 1 },
  { id: "che-pandas", name: "Центр разведения больших панд", city: "che", interest: "nature", minDays: 1 },
  { id: "xan-terracotta", name: "Терракотовая армия", city: "xan", interest: "city", minDays: 1 },
  { id: "hua-mountains", name: "Горный парк Хуаншань", city: "hua", interest: "nature", minDays: 2 },
  { id: "han-westlake", name: "Озеро Сиху", city: "han", interest: "nature", minDays: 1 },
] as const;
export const requiredPlaces: { id: string; name: string; city: CityId; interest: Interest; minDays: number }[] = [
  ...legacyRequiredPlaces,
  ...attractions.filter(place => !legacyRequiredPlaces.some(legacy => legacy.id === place.id)).map(place => ({
    id: place.id, name: place.name, city: place.city,
    interest: placeInterest(place), minDays: 1,
  })),
];
const supports = Object.fromEntries(cityIds.map(id => [id, cities[id].experiences ?? [cities[id].interest]])) as Record<CityId, Interest[]>;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function validJourney(value: unknown): value is JourneyPreferences {
  if (!object(value) || value.origin !== "MOW" || !object(value.daysByInterest)) return false;
  const distribution = value.daysByInterest;
  return (value.planningMode === undefined || value.planningMode === "automatic")
    && (value.flexibleDates === undefined || typeof value.flexibleDates === "boolean" && value.planningMode === "automatic")
    && interests.every(key => Number.isInteger(distribution[key]) && Number(distribution[key]) >= 0 && Number(distribution[key]) <= 14)
    && Number.isInteger(value.minStops) && Number.isInteger(value.maxStops)
    && Number(value.minStops) >= 1 && Number(value.maxStops) <= 5 && Number(value.minStops) <= Number(value.maxStops)
    && Array.isArray(value.requiredPlaces) && value.requiredPlaces.length <= requiredPlaces.length
    && new Set(value.requiredPlaces).size === value.requiredPlaces.length
    && value.requiredPlaces.every(id => requiredPlaces.some(place => place.id === id));
}

export const restDays = (input: TripInput) => input.journey ? interests.reduce((sum, key) => sum + input.journey!.daysByInterest[key], 0) : input.days;
export const chinaStartDate = (input: TripInput) => addDays(input.startDate, tripDayOffset(input));
export const placesFor = (input: TripInput, city?: CityId) => requiredPlaces.filter(place => input.journey?.requiredPlaces.includes(place.id) && (!city || place.city === city));
export const mandatoryCities = (input: TripInput): CityId[] => [...new Set([...input.required, ...placesFor(input).map(place => place.city)])];

export function toJourneyInput(input: TripInput): TripInput {
  if (input.journey) return input;
  const available = Math.max(3, input.days - 4);
  const city = Math.max(1, Math.floor(available * .3)), sea = Math.max(1, Math.floor(available * .3));
  const journey: JourneyPreferences = { origin: "MOW", daysByInterest: { city, nature: available - city - sea, sea }, minStops: 3, maxStops: 4, requiredPlaces: [] };
  return updateJourney(input, journey);
}

export function updateJourney(input: TripInput, journey: JourneyPreferences): TripInput {
  return { ...input, journey,
    interests: interests.filter(key => journey.daysByInterest[key] > 0),
    seaEnd: Boolean(input.journey && input.seaEnd && journey.daysByInterest.sea > 0),
    seaDays: Math.max(2, journey.daysByInterest.sea), cityOrder: "auto" };
}

/** Allocate experience days to sleeping bases; an excursion never adds a base. */
export function experienceAllocation(ids: CityId[], input: TripInput, availableDays = restDays(input), fixedDays?: number[]): Partial<Record<CityId, Interest[]>> | null {
  const preference = input.journey;
  if (!preference || !validJourney(preference) || ids.length < preference.minStops || ids.length > preference.maxStops
    || input.seaEnd && cities[ids.at(-1)!]?.interest !== "sea"
    || !mandatoryCities(input).every(city => ids.includes(city))) return null;
  if (!Number.isInteger(availableDays)) return null;
  if (fixedDays) return allocationWithinStays(ids, input, fixedDays);
  const remaining = experienceTargets(ids, input, availableDays);
  if (!remaining) return null;
  const assigned = Object.fromEntries(ids.map(city => [city, [] as Interest[]])) as Record<CityId, Interest[]>;
  for (const city of ids) {
    for (const interest of interests) {
      const minimum = Math.max(0, ...placesFor(input, city).filter(place => place.interest === interest).map(place => place.minDays));
      remaining[interest] -= minimum;
      if (remaining[interest] < 0) return null;
      assigned[city].push(...Array<Interest>(minimum).fill(interest));
    }
  }
  if (!distributeExperienceDays(ids, remaining, assigned, input.pace)) return null;
  for (const city of ids) assigned[city].sort((a, b) => interests.indexOf(a) - interests.indexOf(b));
  return assigned;
}

/** Equal selected interests in automatic mode; explicit legacy day quotas retain their weights. */
function experienceTargets(ids: CityId[], input: TripInput, total: number): Record<Interest, number> | null {
  const preference = input.journey!, remaining = { ...preference.daysByInterest };
  if (total < restDays(input)) return null;
  for (let extra = total - restDays(input); extra > 0; extra--) {
    const choices = interests.filter(kind => preference.daysByInterest[kind] > 0 && ids.some(city => supports[city].includes(kind)));
    const weight = (kind: Interest) => isAutomaticTrip(input) ? 1 : preference.daysByInterest[kind];
    const next = choices.sort((a, b) => remaining[a] / weight(a) - remaining[b] / weight(b))[0];
    if (!next) return null;
    remaining[next]++;
  }
  return remaining;
}

/** Weighted flow with fixed city capacities preserves manual stay lengths and experience minima. */
function allocationWithinStays(ids: CityId[], input: TripInput, fixedDays: number[]): Partial<Record<CityId, Interest[]>> | null {
  if (fixedDays.length !== ids.length || fixedDays.some(n => !Number.isInteger(n) || n < 1)) return null;
  const demand = isAutomaticTrip(input) ? experienceTargets(ids, input, fixedDays.reduce((sum, days) => sum + days, 0)) : { ...input.journey!.daysByInterest };
  if (!demand) return null;
  const assigned = Object.fromEntries(ids.map(city => [city, [] as Interest[]])) as Record<CityId, Interest[]>;
  for (const city of ids) for (const kind of interests) {
    const minimum = Math.max(0, ...placesFor(input, city).filter(place => place.interest === kind).map(place => place.minDays));
    demand[kind] -= minimum;
    if (demand[kind] < 0) return null;
    assigned[city].push(...Array<Interest>(minimum).fill(kind));
  }
  if (!distributeExperienceDays(ids, demand, assigned, input.pace, fixedDays)) return null;
  for (const city of ids) assigned[city].sort((a, b) => interests.indexOf(a) - interests.indexOf(b));
  return assigned;
}

/** Weighted graph paths are checked against actual experience-day feasibility. */
export function journeySequences(input: TripInput): CityId[][] {
  const preference = input.journey;
  if (!preference || !validJourney(preference)) return [];
  const mandatory = mandatoryCities(input), month = Number(input.startDate.slice(5, 7));
  const eligible = publishedBaseIds.filter(city => baseCatalog[city].country === (input.country ?? "CN") && (mandatory.includes(city) || supports[city].some(key => preference.daysByInterest[key] > 0)
    && !(hasExactDates(input) && cities[city].interest === "sea" && preference.daysByInterest.sea > 0 && chinaKnowledge[city].coastalMonths && !chinaKnowledge[city].coastalMonths!.includes(month))));
  // Small connected catalogues keep exhaustive behaviour; larger ones keep interests and regional variety.
  const shortlisted = new Set<CityId>(mandatory);
  if (eligible.length <= algorithmSettings.search.basePool) eligible.forEach(city => shortlisted.add(city));
  else {
    for (const kind of interests.filter(kind => preference.daysByInterest[kind] > 0)) {
      const ranked = eligible.filter(city => supports[city].includes(kind)).sort((a,b) => destinationScores[b].experiences[kind] - destinationScores[a].experiences[kind] || a.localeCompare(b));
      ranked.slice(0, 5).forEach(city => shortlisted.add(city));
      // Preserve nearby alternatives around required bases, rather than only globally famous cities.
      if (mandatory.length) ranked.sort((a,b) => proximity(a) - proximity(b)).slice(0, 3).forEach(city => shortlisted.add(city));
    }
    for (const city of eligible) { if (shortlisted.size >= algorithmSettings.search.basePool) break; shortlisted.add(city); }
  }
  function proximity(id: CityId) { return Math.min(...mandatory.map(base => (cities[id].point[0] - cities[base].point[0]) ** 2 + (cities[id].point[1] - cities[base].point[1]) ** 2)); }
  return weightedCityPaths(buildRouteGraph(input, [...shortlisted]), input, mandatory)
    .filter(ids => experienceAllocation(ids, input, availableTripDays(input)));
}

export function journeyErrors(input: TripInput): string[] {
  if (!validJourney(input.journey)) return ["Проверьте дни отдыха, диапазон городов и обязательные места."];
  const errors: string[] = [], total = restDays(input);
  if (input.seaEnd && input.journey.daysByInterest.sea === 0) errors.push("Чтобы закончить у моря, добавьте дни морского отдыха.");
  if (total < (isAutomaticTrip(input) ? 1 : 2) || total > 24) errors.push(isAutomaticTrip(input) ? "Выберите хотя бы один интерес." : "Выберите минимум 2 дня отдыха; максимум — 24 дня по всем категориям.");
  const minimum = total + internationalDays(input);
  if (minimum > input.days) errors.push(isAutomaticTrip(input) ? `Для обязательных мест нужно минимум ${minimum} дней. Увеличьте срок или уберите часть мест.` : `Для выбранного распределения нужно минимум ${minimum} дней: ${total} в Китае и 2 на международные перелёты. Внутренние переезды входят в дни остановок. Увеличьте отпуск или сократите число дней в пожеланиях.`);
  if (mandatoryCities(input).length > input.journey.maxStops) errors.push("Обязательных городов больше выбранного максимума. Увеличьте число городов или уберите обязательное место.");
  for (const place of placesFor(input)) if (input.journey.daysByInterest[place.interest] < place.minDays) errors.push(`Для «${place.name}» добавьте хотя бы ${place.minDays} дн. в категории «${interestNames[place.interest]}».`);
  if (!errors.length && !journeySequences(input).length) errors.push("Для такого сочетания транспорта, числа остановок и дней отдыха не удалось связать подходящие города. Измените одно из этих условий.");
  return errors;
}
