import type { CityId, Interest } from "../types";
import { additionalScores } from "./catalog-expansion";

export interface DestinationScore {
  experiences: Record<Interest, number>;
  appeal: number;
  reason: string;
}

/** Editorial fixtures on a 0–5 scale, not traveller ratings or verified popularity. */
export const destinationScores: Record<CityId, DestinationScore> = {
  ...additionalScores,
  sha: { experiences: { city: 5, nature: 0, sea: 0 }, appeal: 4.8, reason: "Панорамы Пудуна, Вайтань и городские кварталы" },
  bei: { experiences: { city: 5, nature: 2.5, sea: 0 }, appeal: 5, reason: "Императорские дворцы и выезд к Великой стене" },
  zjj: { experiences: { city: 0, nature: 5, sea: 0 }, appeal: 4.8, reason: "Скальные панорамы, лесной парк и гора Тяньмэнь" },
  gui: { experiences: { city: 0, nature: 4.7, sea: 0 }, appeal: 4.6, reason: "Карстовые горы, река Ли и выезд в Яншо" },
  san: { experiences: { city: 0, nature: 2.5, sea: 5 }, appeal: 4.3, reason: "Бухты Хайнаня, пляжный отдых и тропический парк" },
  han: { experiences: { city: 0, nature: 3.7, sea: 0 }, appeal: 4.1, reason: "Озеро Сиху, чайные холмы и прогулки в парках" },
  qin: { experiences: { city: 3.5, nature: 3.5, sea: 3.8 }, appeal: 4.1, reason: "Побережье, квартал Бадагуань и горы Лаошань" },
  xmn: { experiences: { city: 4, nature: 0, sea: 4 }, appeal: 4.3, reason: "Остров Гуланъюй, городские улицы и набережная" },
  bha: { experiences: { city: 2.5, nature: 0, sea: 4.5 }, appeal: 3.6, reason: "Серебряный пляж и спокойный старый город" },
  che: { experiences: { city: 4.2, nature: 3, sea: 0 }, appeal: 4.5, reason: "Центр панд, чайные в парках и сычуаньские кварталы" },
  xan: { experiences: { city: 4.8, nature: 0, sea: 0 }, appeal: 4.8, reason: "Терракотовая армия, городская стена и древняя столица" },
  hua: { experiences: { city: 0, nature: 4.9, sea: 0 }, appeal: 4.7, reason: "Горные панорамы, сосны и деревни Хуэйчжоу" },
};
