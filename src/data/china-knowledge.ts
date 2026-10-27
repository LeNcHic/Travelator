import type { CityId } from "../types";
import { additionalKnowledge } from "./catalog-expansion";
export interface DestinationKnowledge { season: string; practical: string; sources: { title: string; url: string }[]; coastalMonths?: number[] }
// Editorial planning guidance, not a weather forecast or a guarantee of swimming conditions.
export const chinaKnowledge: Record<CityId, DestinationKnowledge> = {
  ...additionalKnowledge,
  sha: { season: "Городские прогулки и культура", practical: "Оставьте время на разные берега реки и городские кварталы.", sources: [{ title: "Shanghai — официальный путеводитель", url: "https://english.shanghai.gov.cn/" }] },
  bei: { season: "История и выезды к Великой стене", practical: "Великая стена — выезд из городской базы; участок и дорогу выбирают отдельно.", sources: [{ title: "UNESCO: Великая стена", url: "https://whc.unesco.org/en/list/438/" }] },
  zjj: { season: "Горы: оставьте запас на погоду", practical: "Лесной парк и гора Тяньмэнь — разные территории, не одна короткая прогулка.", sources: [{ title: "UNESCO: Улинъюань", url: "https://whc.unesco.org/en/list/640/" }] },
  gui: { season: "Речные и карстовые пейзажи", practical: "Яншо — выезд из базы в Гуйлине. Трансфер и речные прогулки уточняются отдельно.", sources: [{ title: "UNESCO: Южно-Китайский карст", url: "https://whc.unesco.org/en/list/1248/" }] },
  han: { season: "Озеро, сады и чайные холмы", practical: "Сиху и чайные районы можно посещать из одной базы в Ханчжоу.", sources: [{ title: "UNESCO: озеро Сиху", url: "https://whc.unesco.org/en/list/1334/" }] },
  san: { season: "Тропический курорт, в том числе зимой", coastalMonths: [1,2,3,4,5,6,7,8,9,10,11,12], practical: "Летом жарче; погода и доступность пляжей зависят от конкретных дат. Выбирайте бухту под свой отдых.", sources: [{ title: "Туристическое бюро Саньи: сезоны", url: "https://www.visitsanya.com/planning/travel-guide/travel-tips/a-guide-to-sanyas-peak-and-off-peak-travel-seasons" }] },
  qin: { season: "Летнее море · пляжный ориентир июль–сентябрь", coastalMonths: [7,8,9], practical: "Зимой это прогулки у моря и по городу. Купальный сезон и часы работы каждого пляжа проверяются отдельно.", sources: [{ title: "Правительство Циндао: пляжи и сезон 2026", url: "https://www.qingdao.gov.cn/zwgk/xxgk/csgl/ywfl/hygl/202607/t20260702_10650276.shtml" }] },
  xmn: { season: "Город и побережье · зимой прохладнее", coastalMonths: [3,4,5,6,7,8,9,10,11], practical: "Гуланъюй посещают на пароме; поездка требует отдельного согласования билетов и погоды. Зимнее купание не предполагаем.", sources: [{ title: "Xiamen English: остров Гуланъюй", url: "https://www.xmenglish.cn/en/travl/attractions/201903/t20190328_210456.htm" }, { title: "UNESCO: Кулансу", url: "https://whc.unesco.org/en/list/1541/" }] },
  bha: { season: "Тёплый сезон · ориентир апрель–ноябрь", coastalMonths: [4,5,6,7,8,9,10,11], practical: "Зимой вода прохладнее. Остров Вэйчжоу требует парома и отдельного плана; он не включён как обычная городская прогулка.", sources: [{ title: "CITS: сезонность Бэйхая", url: "https://www.cits.net/china-travel-guide/beihai/travel-season.html" }, { title: "Travel China Guide: Серебряный пляж", url: "https://www.travelchinaguide.com/attraction/guangxi/beihai/silver.htm" }] },
  che: { season: "Панды, парки и сычуаньская культура", practical: "Центр панд находится отдельно от центральных кварталов. Перед посещением нужно проверить правила бронирования на официальном сайте.", sources: [{ title: "Официальный центр разведения больших панд", url: "https://www.panda.org.cn/en/" }] },
  xan: { season: "Древняя столица и музеи", practical: "Терракотовая армия находится за городом; закладывайте время на поездку и заранее проверяйте правила посещения.", sources: [{ title: "UNESCO: мавзолей первого императора Цинь", url: "https://whc.unesco.org/en/list/441/" }] },
  hua: { season: "Горы · зимой возможны снег и лёд", practical: "База — город Хуаншань/Туньси. Поездка в горный парк включает трансфер; ночёвка на вершине и горная логистика в этой версии не моделируются.", sources: [{ title: "UNESCO: горы Хуаншань", url: "https://whc.unesco.org/en/list/547/" }, { title: "UNESCO: деревни Сиди и Хунцунь", url: "https://whc.unesco.org/en/list/1002/" }] },
};
export function coastalSeasonNote(city: CityId, date: string): string | null {
  const months = chinaKnowledge[city].coastalMonths, month = Number(date.slice(5, 7));
  return months && !months.includes(month) ? `${chinaKnowledge[city].season}. На эти даты планируем побережье и прогулки; купание не предполагаем.` : null;
}
