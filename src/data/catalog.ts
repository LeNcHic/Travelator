import type { City, CityId, Hotel, Ticket } from "../types.ts";
import { additionalCities, additionalHotelNames, additionalHotelAreas, additionalConnections } from "./catalog-expansion";

import { expandedCities, expandedHotelNames, expandedHotelAreas, expandedConnections } from "./expanded-china.ts";

export const cities: Record<CityId, City> = {
  ...additionalCities,
  ...expandedCities,
  han: {
    id: "han", name: "Ханчжоу", en: "Hangzhou", cn: "杭州", kind: "Озеро и природа", interest: "nature",
    point: [120.1551, 30.2741], description: "Прогулки у озера Сиху, чайные холмы и парки рядом с Шанхаем.",
    activities: ["Прогулка у озера Сиху", "Чайные холмы Лунцзин", "Храм Линъинь", "Отдых в парках"],
  },
  sha: {
    id: "sha",
    name: "Шанхай",
    en: "Shanghai",
    cn: "上海",
    kind: "Мегаполис",
    interest: "city",
    point: [121.4581, 31.2222],
    description:
      "Небоскрёбы Пудуна, тихие улочки и вечерние огни набережной. Начните с прогулки, оставив время на неожиданные открытия.",
    activities: [
      "Прогулка по набережной Вайтань",
      "Сады Юйюань и старый город",
      "Панорама Пудуна",
      "Кофейни и улицы бывшей Французской концессии",
    ],
  },
  bei: {
    id: "bei",
    experiences: ["city", "nature"],
    name: "Пекин",
    en: "Beijing",
    cn: "北京",
    kind: "Город и культура",
    interest: "city",
    point: [116.4074, 39.9042],
    description:
      "Императорские дворцы, хутуны и большая история. Чередуйте насыщенные экскурсии с неспешными прогулками.",
    activities: [
      "Запретный город",
      "Прогулка по хутунам",
      "Храм Неба",
      "Однодневная поездка к Великой стене",
    ],
  },
  zjj: {
    id: "zjj",
    name: "Чжанцзяцзе",
    en: "Zhangjiajie",
    cn: "张家界",
    kind: "Природа",
    interest: "nature",
    point: [110.48, 29.13],
    description:
      "Горы, уходящие в облака, лесные тропы и смотровые площадки. Оставьте свободный день на погоду и отдых.",
    activities: [
      "Национальный лесной парк",
      "Гора Тяньмэнь",
      "Прогулка по долине Золотого кнута",
      "Свободный день среди гор",
    ],
  },
  gui: {
    id: "gui",
    name: "Гуйлинь",
    en: "Guilin",
    cn: "桂林",
    kind: "Природа",
    interest: "nature",
    point: [110.2906, 25.2742],
    description:
      "Карстовые горы, река Ли и зелёные долины. Здесь хочется замедлиться и провести больше времени на природе.",
    activities: [
      "Прогулка вдоль реки Ли",
      "Однодневная поездка в Яншо",
      "Велопрогулка по долине",
      "Чай и отдых с видом на горы",
    ],
  },
  san: {
    id: "san",
    experiences: ["sea", "nature"],
    name: "Санья",
    en: "Sanya",
    cn: "三亚",
    kind: "Море",
    interest: "sea",
    point: [109.52, 18.25],
    description:
      "Тёплый берег, длинные прогулки и дни без плотного расписания. Отдохните в своём темпе.",
    activities: [
      "Пляж и отдых у моря",
      "Прогулка по набережной",
      "Тропический парк",
      "Свободный день без планов",
    ],
  },
};
export const cityIds = Object.keys(cities) as CityId[];

// Fictional hotel catalogue. Names, ratings, services and prices are demo data.
const hotelNames: Record<CityId, [string, string, string]> = {
  ...additionalHotelNames,
  ...expandedHotelNames,
  han: ["West Lake Stay", "Hangzhou Tea Garden", "Lakeview Retreat"],
  sha: ["Bund Garden Stay", "Shanghai Riverside", "Skyline Retreat"],
  bei: ["Hutong Courtyard", "Beijing Garden House", "Capital Panorama"],
  zjj: ["Mountain Trail Inn", "Cloud Valley Lodge", "Forest View Retreat"],
  gui: ["Li River Guesthouse", "Karst Garden Hotel", "Riverlight Residence"],
  san: ["Sea Breeze Stay", "Sanya Palm Garden", "Horizon Bay Resort"],
};
const hotelAreas: Record<CityId, string[]> = {
  ...additionalHotelAreas,
  ...expandedHotelAreas,
  han: ["Рядом с озером", "Чайные холмы", "Центр города"],
  sha: ["Старый город", "Рядом с набережной", "Пудун"],
  bei: ["Район хутунов", "Центр города", "Рядом с парком"],
  zjj: ["Центр города", "Рядом с национальным парком", "У подножия гор"],
  gui: ["Центр Гуйлиня", "Рядом с рекой Ли", "Набережная"],
  san: ["Санья-Бэй", "Дадунхай", "Ялунвань"],
};
export const hotels: Hotel[] = cityIds.flatMap((city) =>
  hotelNames[city].map((name, tier) => ({
    id: `${city}-hotel-${tier}`,
    city,
    name,
    area: hotelAreas[city][tier],
    stars: tier + 3,
    rating: ["8,3", "9,1", "9,4"][tier],
    nightly: [260, 480, 790][tier] + (({ sha: 60, bei: 40, zjj: 0, gui: -20, san: 100, han: 20, qin: -10, xmn: 10, bha: -30, che: -10, xan: -20, hua: -20 } as Partial<Record<CityId, number>>)[city] ?? 0),
    features:
      tier === 0
        ? ["Wi-Fi", "Одноместный номер"]
        : tier === 1
          ? ["Завтрак", "Одноместный номер", "Wi-Fi"]
          : ["Завтрак", "Номер с видом", "Бассейн"],
  })),
);
const hotelIndex = new Map(hotels.map(hotel => [hotel.id, hotel]));
export const hotelById = (id: string) => hotelIndex.get(id)!;
export const hotelsIn = (city: CityId) => hotels.filter((h) => h.city === city);

// Both directions are deliberately available in the demo. This is not a timetable.
// Tuple: first city, second city, flight minutes, train minutes, air fare, rail fare.
const connections: [CityId, CityId, number, number, number, number][] = [
  ...additionalConnections,
  ...expandedConnections,
  ["sha", "bei", 140, 280, 920, 560],
  ["sha", "zjj", 155, 550, 1090, 610],
  ["sha", "gui", 175, 540, 1180, 590],
  ["sha", "san", 205, 1740, 1480, 840],
  ["bei", "zjj", 175, 690, 1190, 720],
  ["bei", "gui", 195, 650, 1320, 760],
  ["bei", "san", 240, 2040, 1680, 980],
  ["zjj", "gui", 100, 420, 830, 340],
  ["zjj", "san", 135, 1260, 1120, 580],
  ["gui", "san", 90, 960, 890, 460],
  ["sha", "han", 0, 65, 0, 80],
  ["bei", "han", 135, 300, 900, 600],
  ["zjj", "han", 150, 480, 1000, 550],
  ["gui", "han", 165, 500, 1080, 560],
  ["san", "han", 190, 1620, 1400, 800],
];
export const tickets: Ticket[] = connections.flatMap(
  ([a, b, air, train, airfare, railfare], pair) =>
    [
      [a, b],
      [b, a],
    ].flatMap(([from, to], direction) => [
      {
        id: `${from}-${to}-air-0`,
        from,
        to,
        mode: "air" as const,
        service: `DEMO A${100 + pair * 2 + direction}`,
        departure: 9 * 60 + 20,
        minutes: air,
        overhead: 150,
        price: airfare,
        detail: "Эконом · багаж 20 кг",
      },
      {
        id: `${from}-${to}-air-1`,
        from,
        to,
        mode: "air" as const,
        service: `DEMO A${300 + pair * 2 + direction}`,
        departure: 14 * 60 + 10,
        minutes: air + 20,
        overhead: 150,
        price: airfare - 160,
        detail: "Эконом · ручная кладь 8 кг",
      },
      {
        id: `${from}-${to}-train-0`,
        from,
        to,
        mode: "train" as const,
        service: `DEMO T${100 + pair * 2 + direction}`,
        departure: 7 * 60,
        minutes: train,
        overhead: 60,
        price: railfare,
        detail:
          train > 900
            ? "Спальное место · ночной поезд"
            : "Место второго класса",
      },
      {
        id: `${from}-${to}-train-1`,
        from,
        to,
        mode: "train" as const,
        service: `DEMO T${300 + pair * 2 + direction}`,
        departure: 8 * 60 + 30,
        minutes: train + 40,
        overhead: 60,
        price: railfare + 190,
        detail: train > 900 ? "Купе · ночной поезд" : "Место первого класса",
      },
    ].filter(ticket => ticket.mode === "train" || air > 0)),
);
const ticketIndex = new Map(tickets.map(ticket => [ticket.id, ticket]));
const pairIndex = new Map<string, Ticket[]>();
for (const ticket of tickets) { const key = `${ticket.from}:${ticket.to}`; pairIndex.set(key, [...(pairIndex.get(key) ?? []), ticket]); }
export const ticketById = (id: string) => ticketIndex.get(id)!;
export const ticketsBetween = (from: CityId, to: CityId) => pairIndex.get(`${from}:${to}`) ?? [];
