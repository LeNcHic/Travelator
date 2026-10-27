import { cities } from "../data/catalog";
import type { Attraction, Interest } from "../types";

// Preserve the meaning of mandatory places in legacy saves.
const overrides: Record<string, Interest> = {
  "sha-bund": "city", "bei-palace": "city", "bei-wall": "nature", "zjj-yuanjiajie": "nature",
  "zjj-tianmen": "nature", "gui-yangshuo": "nature", "san-yalong": "sea", "qin-laoshan": "nature",
  "xmn-gulangyu": "city", "bha-silver": "sea", "che-pandas": "nature", "xan-terracotta": "city",
  "hua-mountains": "nature", "han-westlake": "nature",
};
export function placeInterest(place: Attraction): Interest {
  if (overrides[place.id]) return overrides[place.id];
  if (place.category === "Море") return "sea";
  if (["Природа", "Горы", "Парк"].includes(place.category)) return "nature";
  if (place.category === "Прогулка") return cities[place.city].interest;
  return "city";
}
