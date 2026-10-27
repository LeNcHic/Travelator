import type { City, CityId } from "../types";
export type NewCityId = "qin" | "xmn" | "bha" | "che" | "xan" | "hua";

export const expandedCities: Record<NewCityId, City> = {
  qin: { id: "qin", name: "Циндао", en: "Qingdao", cn: "青岛", kind: "Море и старый город", interest: "sea", experiences: ["sea", "city", "nature"], point: [120.3826, 36.0671],
    description: "Берег Жёлтого моря, старые кварталы Бадагуань и горы Лаошань. Пляжный отдых здесь сезонный; зимой больше подойдут прогулки по городу и побережью.",
    activities: ["Пляж Шилаожэнь", "Квартал Бадагуань", "Набережная и площадь Четвёртого мая", "Выезд к горам Лаошань"] },
  xmn: { id: "xmn", name: "Сямэнь", en: "Xiamen", cn: "厦门", kind: "Море и островные кварталы", interest: "sea", experiences: ["sea", "city"], point: [118.0894, 24.4798],
    description: "Остров Гуланъюй, старые кварталы и прогулки вдоль моря. Подходит для сочетания города и побережья; зимой купание не предполагаем. Поездку на остров нужно согласовать с паромами.",
    activities: ["Остров Гуланъюй", "Набережная Хуаньдао", "Храм Наньпуто", "Улица Чжуншань"] },
  bha: { id: "bha", name: "Бэйхай", en: "Beihai", cn: "北海", kind: "Песчаные пляжи", interest: "sea", experiences: ["sea", "city"], point: [109.1193, 21.4733],
    description: "Серебряный пляж, прибрежные прогулки и старый торговый квартал. Более спокойный морской вариант на материке. Зимний отдых здесь не означает тёплую воду для купания.",
    activities: ["Серебряный пляж", "Старый город Бэйхая", "Пляж Цяоган", "Прогулка у Бэйбуского залива"] },
  che: { id: "che", name: "Чэнду", en: "Chengdu", cn: "成都", kind: "Город, панды и парки", interest: "city", experiences: ["city", "nature"], point: [104.0665, 30.5723],
    description: "Панды, чайные в парках и сычуаньские кварталы. Посещение центра панд и прогулки по городу позволяют чередовать впечатления без смены гостиницы.",
    activities: ["Исследовательский центр панд", "Квартал Куаньчжай", "Народный парк и чайные", "Храм Ухоу и улица Цзиньли"] },
  xan: { id: "xan", name: "Сиань", en: "Xi’an", cn: "西安", kind: "История и городские кварталы", interest: "city", experiences: ["city"], point: [108.9398, 34.3416],
    description: "Терракотовая армия, городская стена и наследие древней столицы. Музей находится за пределами центра: для поездки стоит выделить отдельную часть дня и уточнить транспорт.",
    activities: ["Терракотовая армия", "Городская стена", "Большая пагода диких гусей", "Колокольная башня и старый центр"] },
  hua: { id: "hua", name: "Хуаншань", en: "Huangshan", cn: "黄山", kind: "Гранитные горы и деревни", interest: "nature", experiences: ["nature"], point: [118.3376, 29.7147],
    description: "Гранитные вершины, сосны и облака Хуаншаня, старые улицы Туньси и деревни Хуэйчжоу. База в городе и горный парк разнесены: трансфер к горам нужно планировать отдельно.",
    activities: ["Горный парк Хуаншань", "Старые улицы Туньси", "Деревня Хунцунь", "Деревня Сиди"] },
};
export const expandedHotelNames: Record<NewCityId, [string, string, string]> = {
  qin: ["Qingdao Coast Stay", "Badaguan Garden", "Yellow Sea Retreat"], xmn: ["Xiamen Lane Stay", "Island Garden", "Seaside View Retreat"],
  bha: ["Beihai Old Town Stay", "Silver Beach Garden", "Gulf View Retreat"], che: ["Chengdu Tea Stay", "Panda Garden", "Sichuan Skyline Retreat"],
  xan: ["Xian Courtyard Stay", "City Wall Garden", "Ancient Capital Retreat"], hua: ["Tunxi Trail Stay", "Huangshan Garden", "Cloud Peak Retreat"],
};
export const expandedHotelAreas: Record<NewCityId, string[]> = { qin: ["Старый город", "Бадагуань", "Побережье"], xmn: ["Центр Сымина", "Набережная", "Рядом с паромом"], bha: ["Старый город", "Серебряный пляж", "Цяоган"], che: ["Центр города", "Рядом с парком", "Чуньси-роуд"], xan: ["Внутри городской стены", "Рядом с пагодой", "Центр города"], hua: ["Туньси", "Старая улица", "Городская база Хуаншаня"] };
// Planning fixtures, not verified direct services, schedules or ticket prices.
export const expandedConnections: [CityId, CityId, number, number, number, number][] = [
  ["qin","bei",100,220,780,310], ["qin","sha",100,300,820,390], ["qin","han",105,360,860,420], ["qin","xan",130,500,950,480], ["qin","che",175,800,1190,650],
  ["xmn","sha",105,350,850,410], ["xmn","han",110,320,820,380], ["xmn","gui",110,480,880,490], ["xmn","bei",170,650,1180,690], ["xmn","san",120,720,980,590], ["xmn","bha",95,480,780,390],
  ["bha","sha",180,800,1200,700], ["bha","bei",240,1100,1550,980], ["bha","han",175,750,1150,680], ["bha","che",135,550,920,480], ["bha","gui",0,300,0,260],
  ["che","sha",180,780,1280,720], ["che","bei",180,480,1180,690], ["che","han",165,700,1200,680], ["che","gui",100,330,820,350], ["che","zjj",100,390,800,390], ["che","san",150,1260,1100,760], ["che","xan",110,230,760,290],
  ["xan","sha",130,360,980,490], ["xan","bei",120,280,900,420], ["xan","han",135,440,990,500], ["xan","gui",140,570,1020,590], ["xan","zjj",110,510,860,510], ["xan","san",190,1620,1320,850], ["xan","xmn",170,700,1180,680], ["xan","bha",180,700,1250,690],
  ["hua","han",0,105,0,150], ["hua","sha",0,155,0,210], ["hua","bei",120,360,980,490], ["hua","gui",120,450,950,460], ["hua","san",165,1280,1150,740], ["hua","che",150,660,1100,620], ["hua","qin",130,550,990,520], ["hua","xmn",100,250,850,290],
];
