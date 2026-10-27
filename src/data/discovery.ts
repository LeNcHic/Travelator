import type { CityId, Interest, TripInput } from "../types";
import { mandatoryCities, requiredPlaces, toJourneyInput, updateJourney } from "../lib/journey";
import { cities } from "./catalog";
import { chinaKnowledge } from "./china-knowledge";
import { destinationSeeds } from "../../shared/destination-seeds";

export function toggleRequiredDestination(input: TripInput, city: CityId): TripInput | null {
  const base = toJourneyInput(input), chosen = mandatoryCities(base), selected = chosen.includes(city);
  if (!selected && chosen.length >= 5) return null;
  const required = selected ? base.required.filter(id => id !== city) : [...base.required, city];
  const places = selected ? base.journey!.requiredPlaces.filter(id => requiredPlaces.find(place => place.id === id)?.city !== city) : base.journey!.requiredPlaces;
  const next = { ...base, required, journey: { ...base.journey!, requiredPlaces: places } };
  const minimum = Math.min(5, Math.max(base.journey!.minStops, mandatoryCities(next).length));
  const maximum = Math.min(5, Math.max(base.journey!.maxStops, minimum));
  const mood = cities[city].interest;
  if (selected || base.interests.includes(mood)) return updateJourney(next, { ...next.journey, minStops: minimum, maxStops: maximum });
  return rebalancePreferences(next, [...base.interests, mood], base.days, minimum, maximum);
}

export const destinationImages: Record<CityId, string> = {
  ...Object.fromEntries(destinationSeeds.map(base => [base.id, "/images/china/destination-placeholder.svg"])) as Record<typeof destinationSeeds[number]["id"], string>,
  sha: "/images/china/shanghai.jpg", bei: "/images/china/beijing.jpg", zjj: "/images/china/nature.jpg",
  qin: "/images/china/qingdao.jpg", xmn: "/images/china/xiamen.jpg", bha: "/images/china/beihai.jpg",
  che: "/images/china/chengdu.jpg", xan: "/images/china/xian.jpg", hua: "/images/china/huangshan.jpg",
  gui: "/images/china/hero.jpg", san: "/images/china/sanya.jpg", han: "/images/china/hangzhou.jpg",
};
export const destinationNotes: Record<CityId, { title: string; line: string; highlight: string; stay: string }> = {
  ...Object.fromEntries(destinationSeeds.map(base => [base.id, { title: base.name, line: base.season, highlight: base.region, stay: `${base.stay[0]}–${base.stay[1]} дней` }])) as Record<typeof destinationSeeds[number]["id"], { title: string; line: string; highlight: string; stay: string }>,
  qin: {"title": "Летний берег и виллы", "line": "Пляжи, кварталы Бадагуань и горы у моря.", "highlight": "Летнее море", "stay": "3–4 дня"},
  xmn: {"title": "Город у моря", "line": "Гуланъюй, островные кварталы и прогулки по берегу.", "highlight": "Город и море", "stay": "3–4 дня"},
  bha: {"title": "Песок и спокойный ритм", "line": "Серебряный пляж и старые улицы материкового побережья.", "highlight": "Пляжи", "stay": "3–5 дней"},
  che: {"title": "Панды и чайные", "line": "Центр панд, зелёные парки и сычуаньские кварталы.", "highlight": "Культура", "stay": "3–4 дня"},
  xan: {"title": "История древней столицы", "line": "Терракотовая армия, городская стена и старый центр.", "highlight": "История", "stay": "2–3 дня"},
  hua: {"title": "Гранитные вершины", "line": "Горы в облаках, сосны и деревни Хуэйчжоу.", "highlight": "Горы", "stay": "3–4 дня"},

  sha: { title: "Город будущего", line: "Небоскрёбы, старые кварталы и огни Вайтаня.", highlight: "Мегаполис", stay: "3–4 дня" },
  bei: { title: "Большая история", line: "Императорские дворцы и поездка к Великой стене.", highlight: "Культура", stay: "3–4 дня" },
  zjj: { title: "Горы над облаками", line: "Лесные тропы и скалы национального парка.", highlight: "Горы", stay: "2–3 дня" },
  gui: { title: "Китай с открытки", line: "Карстовые горы, река Ли и долины Яншо.", highlight: "Природа", stay: "2–3 дня" },
  san: { title: "Пауза у моря", line: "Пляжи Хайнаня и дни без плотного расписания.", highlight: "Море", stay: "4–6 дней" },
  han: { title: "Озеро и чайные холмы", line: "Прогулки у Сиху и короткий поезд из Шанхая.", highlight: "Природа", stay: "2–3 дня" },
};
export interface TripIdea { id: string; title: string; description: string; days: number; cities: CityId[]; distribution: Record<Interest, number>; image: string }
export const tripIdeas: TripIdea[] = [
  { id: "first", title: "Первое знакомство", description: "Небоскрёбы, озеро и несколько дней у моря.", days: 14,
    cities: ["sha", "han", "san"], distribution: { city: 3, nature: 3, sea: 4 }, image: destinationImages.sha },
  { id: "nature", title: "Ближе к природе", description: "История Пекина и пейзажи двух природных регионов.", days: 12,
    cities: ["bei", "zjj", "gui"], distribution: { city: 2, nature: 6, sea: 0 }, image: destinationImages.zjj },
  { id: "sea", title: "Город и море", description: "Огни Шанхая и неспешные дни на берегу в Санье.", days: 10,
    cities: ["sha", "san"], distribution: { city: 3, nature: 0, sea: 4 }, image: destinationImages.san },
  { id: "eastern", title: "Горы и островной город", description: "Шанхай, вершины Хуаншаня и побережье Сямэня.", days: 14,
    cities: ["sha", "hua", "xmn"], distribution: { city: 2, nature: 4, sea: 4 }, image: destinationImages.hua },
  { id: "pandas", title: "Панды и древняя столица", description: "Чэнду, чайные и исторические места Сианя.", days: 12,
    cities: ["che", "xan"], distribution: { city: 5, nature: 4, sea: 0 }, image: destinationImages.che },
  { id: "summer", title: "Пекин и летнее море", description: "Культура Пекина и берег Циндао. Идея для летнего отпуска.", days: 10,
    cities: ["bei", "qin"], distribution: { city: 3, nature: 2, sea: 2 }, image: destinationImages.qin },
];

export const discoveryOrder: CityId[] = [...destinationSeeds.map(base => base.id), "sha", "zjj", "san", "bei", "gui", "han", "qin", "xmn", "bha", "che", "xan", "hua"];
export function findDestinations(filter: Interest | "all", query = ""): CityId[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  return discoveryOrder.filter(id => (filter === "all" || cities[id].interest === filter)
    && (!needle || [cities[id].name, cities[id].en, cities[id].cn, cities[id].description, ...cities[id].activities, destinationNotes[id].line].join(" ").toLocaleLowerCase("ru").includes(needle)));
}

export function inputForIdea(input: TripInput, idea: TripIdea): TripInput {
  const base = toJourneyInput(input);
  return updateJourney({ ...base, days: idea.days, required: [...idea.cities], maxTrainMinutes: 120, transport: "mixed", pace: "balanced" }, {
    ...base.journey!, daysByInterest: { ...idea.distribution }, minStops: idea.cities.length, maxStops: idea.cities.length, requiredPlaces: [],
  });
}

/** Keep a short holiday feasible when changing duration, interests or rhythm. */
export function rebalancePreferences(input: TripInput, selected: Interest[], days = input.days, minStops = input.journey!.minStops, maxStops = input.journey!.maxStops): TripInput {
  const base = toJourneyInput(input), old = base.journey!;
  const mandatory = mandatoryCities(base), month = Number(base.startDate.slice(5, 7));
  const eligible = Math.max(1, Object.values(cities).filter(city => mandatory.includes(city.id) || (city.experiences ?? [city.interest]).some(kind => selected.includes(kind))
    && !(city.interest === "sea" && selected.includes("sea") && chinaKnowledge[city.id].coastalMonths && !chinaKnowledge[city.id].coastalMonths!.includes(month))).length);
  minStops = Math.max(1, Math.min(minStops, eligible));
  maxStops = Math.max(minStops, Math.min(maxStops, eligible));
  const distribution: Record<Interest, number> = { city: 0, nature: 0, sea: 0 };
  selected.forEach(kind => { distribution[kind] = 1; });
  const target = Math.min(24, Math.max(2, selected.length, Number.isFinite(days) ? days - 2 : 2));
  for (let left = target - selected.length; left > 0 && selected.length; left--) {
    const kind = [...selected].sort((a, b) => distribution[a] / Math.max(1, old.daysByInterest[a]) - distribution[b] / Math.max(1, old.daysByInterest[b]))[0];
    distribution[kind] = Math.min(14, distribution[kind] + 1);
  }
  return updateJourney({ ...base, days, maxTrainMinutes: 120 }, { ...old, minStops, maxStops, daysByInterest: distribution });
}
