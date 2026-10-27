import { destinationSeeds } from "../../shared/destination-seeds";
import { cities, cityIds, tickets } from "./catalog";
import { attractionsIn } from "./attractions";
import { chinaKnowledge } from "./china-knowledge";
import { destinationProfiles } from "./destination-profiles";
import type { CityId } from "../types";

export interface Country { id: string; name: string; currency: string; timezone: string; map?: { feature: string; center: [number, number] } }
export const countries: Record<string, Country> = { CN: { id: "CN", name: "Китай", currency: "CNY", timezone: "Asia/Shanghai", map: { feature: "CHN", center: [112, 34.5] } } };
export interface BaseRecord {
  id: CityId; country: string; region: string; timezone: string; status: "published" | "draft";
  point: [number, number]; highlights: string[]; excursions: string[]; season: string;
  stay: { min: number; max: number; reason: string }; connections: CityId[];
  sources: { title: string; url: string }[]; reviewedAt: string;
  referenceScope: string; estimates: string[];
}
const regions: Partial<Record<CityId, string>> = { sha: "Шанхай", bei: "Пекин", han: "Чжэцзян", zjj: "Хунань", gui: "Гуанси", san: "Хайнань", qin: "Шаньдун", xmn: "Фуцзянь", bha: "Гуанси", che: "Сычуань", xan: "Шэньси", hua: "Аньхой" };
export function catalogueProblems(base: BaseRecord): string[] {
  let timezoneValid = true;
  try { new Intl.DateTimeFormat("en", { timeZone: base.timezone }); } catch { timezoneValid = false; }
  return [!countries[base.country] && "страна", !base.region && "регион", !base.timezone && "часовой пояс",
    !timezoneValid && "неизвестный часовой пояс", (!base.point.every(Number.isFinite) || Math.abs(base.point[0]) > 180 || Math.abs(base.point[1]) > 90) && "координаты", base.highlights.length < 5 && "программа",
    (!base.stay.reason || base.stay.min < 1 || base.stay.max < base.stay.min) && "длительность",
    !base.season && "сезонность", !base.connections.length && "связи", !base.sources.length && "источники", !base.reviewedAt && "дата проверки"].filter(Boolean) as string[];
}
export const baseCatalog = Object.fromEntries(cityIds.map(id => {
  const city = cities[id], seed = destinationSeeds.find(item => item.id === id), places = attractionsIn(id);
  const range = destinationProfiles[id];
  const base: BaseRecord = {
    id, country: city.country ?? "CN", region: seed?.region ?? regions[id] ?? "", timezone: countries[city.country ?? "CN"]?.timezone ?? "", status: "draft", point: city.point,
    highlights: places.map(place => place.id), excursions: places.filter(place => /выезд|загород|паром|горы|высокогор/i.test(place.description)).map(place => place.id),
    season: chinaKnowledge[id].season, stay: { ...range, reason: `${places.length} мест: ${places.filter(place => place.minutes >= 300).length} длительных выездов; остальные посещения можно чередовать с отдыхом. Диапазон — учебная рекомендация, не обязательный минимум.` },
    connections: [...new Set(tickets.filter(ticket => ticket.from === id && ticket.minutes > 0 && ticket.price > 0).map(ticket => ticket.to))],
    sources: chinaKnowledge[id].sources, reviewedAt: "2026-10-27",
    referenceScope: "Источники описывают основные объекты и характер направления. Полнота, открытие всех мест и доступность не подтверждены онлайн.",
    estimates: ["приближённые координаты", "длительности посещений и выездов", "сезонные советы", "число дней", "связи, цены и расписания тестового каталога"],
  };
  if (!catalogueProblems(base).length) base.status = "published";
  return [id, base];
})) as Record<CityId, BaseRecord>;
export const publishedBaseIds = cityIds.filter(id => baseCatalog[id].status === "published");
