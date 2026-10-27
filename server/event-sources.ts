import type { VerifiedEvent } from "../shared/events.ts";
export interface EventSource {
  event: Omit<VerifiedEvent, "dates" | "verifiedAt">;
  anchor: string;
  year: number;
  format: "when" | "after-title" | "before-title-chinese" | "numeric";
}
const shanghai = "https://english.shanghai.gov.cn/en-Events/";
const chengdu = "https://www.gochengdu.cn/en/article/column_167084631172793/4821";
const beijing = "https://english.beijing.gov.cn/whatson/events/exhibition/202609/t20260903_4848926.html";
export const officialEventSources: EventSource[] = [
  { year: 2026, format: "when", anchor: "12th Shanghai International Comedy Festival", event: { id: "shanghai-comedy-2026", city: "sha", title: "Шанхайский фестиваль комедии", description: "Спектакли и комедийные представления на разных площадках Шанхая.", advice: "Общие даты фестиваля не означают ежедневные показы. Выберите спектакль в программе организатора и проверьте язык представления.", source: { title: "Официальный портал Шанхая", url: shanghai + "20261022/cadab1b0299b466182f9df1a9d0e0aca.html" } } },
  { year: 2026, format: "when", anchor: "Short Track World Tour", event: { id: "shanghai-short-track-2026", city: "sha", title: "Мировой тур по шорт-треку в Шанхае", description: "Международные соревнования в Восточном спортивном центре района Пудун.", advice: "Уточните программу заездов и дату выпуска билетов у организатора. Прибавка к рекомендации не означает наличие билетов.", source: { title: "Официальный портал Шанхая", url: shanghai + "20261022/55fe734859fd423aaa4bb6505ebcd214.html" } } },
  { year: 2026, format: "when", anchor: "la Galerie du 19M", event: { id: "shanghai-crafts-2026", city: "sha", title: "Выставка французского и китайского ремесла", description: "Совместная программа мастеров, дизайнеров и художников в Музее искусств Пудуна.", advice: "Для посещения нужны запись через мини-приложение организатора и действующий билет музея на тот же день.", source: { title: "Официальный портал Шанхая", url: shanghai + "20261019/c197876017b643fab174504e5962cfcd.html" } } },
  { year: 2026, format: "when", anchor: "2026 Shanghai Marathon", event: { id: "shanghai-marathon-live-2026", city: "sha", title: "Шанхайский марафон", description: "Беговые соревнования в городе. В дни проведения возможны ограничения движения и повышенный спрос на жильё.", advice: "Участие требует регистрации. Для туристического маршрута это прежде всего повод проверить транспортные ограничения, а не обещание участия.", source: { title: "Официальный портал Шанхая", url: shanghai + "20260903/99bdcd2168344205b2d9757a038b4284.html" } } },
  { year: 2026, format: "before-title-chinese", anchor: "今日丝绸之路国际艺术邀请展", event: { id: "xian-silk-road-live-2026", city: "xan", title: "Искусство Шёлкового пути", description: "Международная художественная выставка в Музее искусств Шэньси и культурном центре Цюйцзян в Сиане.", advice: "Уточните конкретную площадку, часы работы и условия входа. Выставку можно совместить с городской частью маршрута.", source: { title: "Управление культуры и туризма Сианя", url: "https://wlj.xa.gov.cn/wlxw/wlzx/2109818340980613121.html" } } },
  { year: 2026, format: "after-title", anchor: "A Day of Wandering", event: { id: "chengdu-hongkong-crafts-2026", city: "che", title: "Один день прогулки: ремёсла Гонконга", description: "Выставка нематериального наследия и современного искусства Гонконга в Художественном музее Чэнду.", advice: "Проверьте часы работы зала A8 и необходимость записи. Указан период выставки, а не время отдельного сеанса.", source: { title: "Туристический портал Чэнду", url: chengdu } } },
  { year: 2026, format: "after-title", anchor: "The Natural within Paper", event: { id: "chengdu-bamboo-paper-2026", city: "che", title: "Искусство бамбуковой бумаги Цзяцзян", description: "Материалы об истории и ремесле изготовления бумаги в Художественном музее Чэнду.", advice: "Выставочные залы A12 и A13. Перед посещением проверьте режим работы музея и условия входа.", source: { title: "Туристический портал Чэнду", url: chengdu } } },
  { year: 2026, format: "after-title", anchor: "Carsten Höller: Two", event: { id: "beijing-ucca-two-2026", city: "bei", title: "Карстен Хёллер: Два", description: "Выставка современного искусства в центре UCCA, в арт-квартале 798.", advice: "Проверьте актуальный билет и расписание UCCA. Событие можно совместить с прогулкой по арт-кварталу.", source: { title: "Официальный портал Пекина", url: beijing } } },
  { year: 2026, format: "after-title", anchor: "Prehistoric Planet", event: { id: "beijing-prehistoric-2026", city: "bei", title: "Доисторическая планета: динозавры", description: "Иммерсивная выставка в арт-квартале 798.", advice: "Уточните возрастные ограничения, язык и время сеанса. Наличие билетов не подтверждено проверкой афиши.", source: { title: "Официальный портал Пекина", url: beijing } } },
  ...[
    ["hangzhou-wuzhenzhi-2026", "珍·墨——吴珍之作品展", "Живопись У Чжэньчжи", "8"],
    ["hangzhou-wuhonghui-2026", "采真见素——吴洪晖作品展", "Живопись У Хунхуэя", "9"],
    ["hangzhou-linxiaoshuang-2026", "素心万象——林孝爽书法作品展", "Каллиграфия Линь Сяошуан", "7"],
    ["hangzhou-chengaojie-2026", "陈高杰：世界的肚脐", "Чэнь Гаоцзе: Пуп мира", "10"],
  ].map(([id, anchor, title, hall]) => ({ year: 2026, format: "numeric" as const, anchor, event: {
    id, city: "han" as const, interest: "city" as const, title, venue: "Художественный музей Чжэцзяна · зал " + hall,
    registration: "unknown" as const, availability: "unknown" as const, status: "scheduled" as const,
    description: "Выставка в художественном музее на южном берегу Сиху.", advice: "Проверьте запись, часы работы и вход на конкретный день. Даты выставки не подтверждают наличие билетов.",
    source: { title: "Художественный музей Чжэцзяна · организатор", url: "https://www.zjam.org.cn/Site/Exbition/ExbitionList.aspx?type=1" },
  } })),
  { year: 2026, format: "numeric", anchor: "世界珍宝——印度莫卧儿王朝艺术展", event: { id: "nanjing-mughal-2026", city: "nan", interest: "city", title: "Сокровища искусства империи Великих Моголов", venue: "Нанкинский музей · зал 8", registration: "required", availability: "unknown", description: "Временная художественная выставка в Нанкинском музее.", advice: "Выставка учитывается только при подтверждённых полных датах; проверьте условия входа у музея.", source: { title: "Нанкинский музей · организатор", url: "https://www.njmuseum.com/zh/exhibitionList?id=5" } } },
];
