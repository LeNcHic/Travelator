import { destinationSeeds, type ExpansionCityId } from "../../shared/destination-seeds";
import type { Attraction, City, CityId, Interest } from "../types";

export const additionalCities = Object.fromEntries(destinationSeeds.map(base => [base.id, {
  id: base.id, name: base.name, en: base.en, cn: base.cn, interest: base.interest,
  experiences: [...base.experiences], kind: base.interest === "sea" ? "Побережье и город" : base.interest === "nature" ? "Природа и выезды" : "История и город",
  point: [...base.point], description: base.season, activities: base.places.map(place => place.name),
}])) as Record<ExpansionCityId, City>;
export const additionalPlaces: Attraction[] = destinationSeeds.flatMap(base => base.places.map(place => ({ ...place, city: base.id, point: [...place.point] as [number, number] })));
export const additionalProfiles = Object.fromEntries(destinationSeeds.map(base => [base.id, { min: base.stay[0], max: base.stay[1] }])) as Record<ExpansionCityId, { min: number; max: number }>;
export const additionalScores = Object.fromEntries(destinationSeeds.map(base => [base.id, {
  experiences: { city: base.interest === "city" ? 4 : 2.5, nature: base.interest === "nature" ? 4.2 : 2, sea: base.interest === "sea" ? 4 : 0 },
  appeal: 4, reason: base.places.slice(0, 3).map(place => place.name).join(", "),
}])) as Record<ExpansionCityId, { experiences: Record<Interest, number>; appeal: number; reason: string }>;
export const additionalHotelNames = Object.fromEntries(destinationSeeds.map(base => [base.id, ["Demo " + base.en + " Stay", "Demo " + base.en + " Garden", "Demo " + base.en + " Retreat"]])) as Record<ExpansionCityId, [string, string, string]>;
export const additionalHotelAreas = Object.fromEntries(destinationSeeds.map(base => [base.id, ["Учебная центральная зона", "Учебная парковая зона", "Учебная зона отдыха"]])) as Record<ExpansionCityId, string[]>;
export const additionalKnowledge = Object.fromEntries(destinationSeeds.map(base => [base.id, {
  season: base.season, practical: "База с ночёвкой — " + base.name + ". Загородные места посещают выездами; время, открытие и местный транспорт уточняются отдельно.",
  sources: [{ title: "Источник сведений о направлении", url: base.source }],
  ...(base.interest === "sea" ? { coastalMonths: base.id === "hai" ? [4,5,6,7,8,9,10,11] : base.id === "zhu" ? [5,6,7,8,9,10] : [7,8,9] } : {}),
}])) as Record<ExpansionCityId, { season: string; practical: string; sources: { title: string; url: string }[]; coastalMonths?: number[] }>;

// Sparse, explicitly fictional connections. They are not assertions of direct flights.
const links: [CityId, CityId, number, number, number, number][] = [
  ["suz","sha",0,30,0,45],["suz","han",0,100,0,110],["suz","wux",0,20,0,30],["wux","nan",0,60,0,90],["nan","sha",0,100,0,160],
  ["nin","han",0,60,0,85],["shx","han",0,25,0,35],["shx","nin",0,50,0,65],
  ["fuz","xmn",0,100,0,110],["qua","xmn",0,45,0,55],["qua","fuz",0,65,0,85],["wuy","fuz",0,65,0,100],
  ["gua","she",0,55,0,90],["gua","zhu",0,75,0,100],["she","zhu",0,90,0,120],["gua","gui",0,150,0,210],
  ["hai","san",0,105,0,120],["yan","wei",0,30,0,45],["yan","qin",0,110,0,140],["jin","qin",0,110,0,180],
  ["qhd","bei",0,120,0,150],["dat","bei",0,110,0,150],["luo","xan",0,85,0,160],["pin","dat",0,180,0,170],
  ["kun","dli",0,120,0,160],["dli","lij",0,100,0,110],["lij","shr",0,90,0,95],
  ["cho","che",0,95,0,160],["les","che",0,55,0,85],["ans","guy",0,40,0,60],["guy","gui",0,110,0,150],
];
// Each added base has two demo links to established hubs. No real availability is inferred.
for (const base of destinationSeeds) {
  const hubs: CityId[] = base.point[0] < 108 ? ["che", "xan"] : base.point[1] > 34 ? ["bei", "sha"] : ["sha", "han"];
  for (const hub of hubs) if (!links.some(([a,b]) => a === base.id && b === hub || b === base.id && a === hub))
    links.push([base.id, hub, 120, 360, 900, 400]);
}
export const additionalConnections = links;
