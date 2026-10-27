import { CITY_IDS, type CityId } from "../shared/cities.ts";
import { cities } from "../src/data/catalog.ts";
import { validEventDate, validVerifiedEvent, type EventQuery, type OfficialEventResult, type VerifiedEvent } from "../shared/events.ts";
import { officialEventSources, type EventSource } from "./event-sources.ts";
import { HotelApiError } from "./hotels.ts";

export function validateEventQuery(value: unknown): EventQuery {
  const q = value as EventQuery;
  if (!q || typeof q !== "object" || !Array.isArray(q.cities) || !q.cities.length || q.cities.length > CITY_IDS.length
    || new Set(q.cities).size !== q.cities.length || !q.cities.every(city => (CITY_IDS as readonly string[]).includes(city))
    || !validEventDate(q.start) || !validEventDate(q.end) || q.start > q.end || Date.parse(q.end) - Date.parse(q.start) > 28 * 86400000)
    throw new HotelApiError(400, "INVALID_EVENT_QUERY", "Проверьте города и даты поездки для поиска мероприятий.");
  return { cities: [...q.cities], start: q.start, end: q.end };
}
export function articleText(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, code) => Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : " ")
    .replace(/&nbsp;|&#xA0;|&thinsp;/gi, " ").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&lsquo;|&rsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/[\s\u202f\u200b]+/g, " ").trim();
}
const monthNames = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function parseOfficialPeriod(text: string, year: number): { start: string; end: string } | null {
  const numeric = /(20\d{2})[/.年-](\d{1,2})[/.月-](\d{1,2})日?\s*(?:至|到|to|[-–—])\s*(20\d{2})[/.年-](\d{1,2})[/.月-](\d{1,2})/.exec(text);
  if (numeric) {
    const iso = (offset: number) => `${numeric[offset]}-${numeric[offset+1].padStart(2,"0")}-${numeric[offset+2].padStart(2,"0")}`;
    const start = iso(1), end = iso(4);
    return validEventDate(start) && validEventDate(end) && start <= end ? { start, end } : null;
  }
  const range = new RegExp(`(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?\\s*,?\\s*(?:to|[-–—])\\s*(?:(${monthNames})\\.?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?`, "i").exec(text);
  const chinese = /(\d{1,2})月(\d{1,2})日(?:至|[-–—])(\d{1,2})月(\d{1,2})日/.exec(text);
  if (!range && !chinese) return null;
  const firstMonth = range ? months.indexOf(range[1].slice(0, 3).toLowerCase()) + 1 : Number(chinese![1]);
  const lastMonth = range ? range[4] ? months.indexOf(range[4].slice(0, 3).toLowerCase()) + 1 : firstMonth : Number(chinese![3]);
  const firstYear = Number(range?.[3] || year), lastYear = Number(range?.[6] || firstYear + Number(lastMonth < firstMonth));
  const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const start = iso(firstYear, firstMonth, Number(range?.[2] || chinese![2])), end = iso(lastYear, lastMonth, Number(range?.[5] || chinese![4]));
  return validEventDate(start) && validEventDate(end) && start <= end ? { start, end } : null;
}
export function extractOfficialEvent(html: string, spec: EventSource, now: Date): VerifiedEvent | null {
  const text = articleText(html), anchor = text.toLowerCase().indexOf(spec.anchor.toLowerCase());
  if (anchor < 0) return null;
  const local = text.slice(Math.max(0, anchor - 30), anchor + 650);
  if (/(?:EventCancelled|展览取消|活动取消|取消举办|exhibition cancelled|event cancelled)/i.test(local)) return null;
  let datesText: string;
  if (spec.format === "when") datesText = /When:\s*([\s\S]{1,200}?)(?:Where:|$)/i.exec(text)?.[1] ?? "";
  else if (spec.format === "before-title-chinese") datesText = text.slice(Math.max(0, anchor - 100), anchor);
  else if (spec.format === "numeric") datesText = text.slice(anchor, anchor + 230);
  else datesText = /Dates:\s*([\s\S]{1,160}?)(?:Venue:|Location:|$)/i.exec(text.slice(anchor, anchor + 1300))?.[1] ?? "";
  const dates = parseOfficialPeriod(datesText, spec.year);
  if (!dates || dates.start.slice(0,4) !== String(spec.year)) return null;
  const event = { venue: "Площадка и сеанс — в программе организатора", registration: "unknown" as const, availability: "unknown" as const, status: "scheduled" as const, ...spec.event, dates, verifiedAt: now.toISOString() };
  return validVerifiedEvent(event) ? event : null;
}

export const structuredEventSources: { city: CityId; title: string; url: string }[] = [
  { city: "suz", title: "Музей Сучжоу · организатор", url: "https://www.szmuseum.com/" },
  { city: "bei", title: "UCCA · организатор", url: "https://ucca.org.cn/en/exhibition/" },
  { city: "gua", title: "Музей Гуандуна · организатор", url: "https://www.gdmuseum.com/" },
];
export function extractStructuredEvents(html: string, source: typeof structuredEventSources[number], now: Date): VerifiedEvent[] {
  const events: VerifiedEvent[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== "object") return;
    const event = node as Record<string, any>;
    if (event["@graph"]) visit(event["@graph"]);
    if (!(Array.isArray(event["@type"]) ? event["@type"] : [event["@type"]]).some((type: unknown) => typeof type === "string" && /(?:^|\/)(?:Event|ExhibitionEvent|MusicEvent|TheaterEvent|DanceEvent|Festival|FoodEvent|LiteraryEvent|SportsEvent|VisualArtsEvent)$/.test(type))) return;
    if (typeof event.startDate !== "string" || typeof event.endDate !== "string" || !validEventDate(event.startDate.slice(0,10)) || !validEventDate(event.endDate.slice(0,10))) return;
    const locality = String(event.location?.address?.addressLocality ?? "").toLowerCase();
    if (![cities[source.city].cn, cities[source.city].en.toLowerCase(), cities[source.city].name.toLowerCase()].some(name => locality.includes(name))) return;
    const title = typeof event.name === "string" ? articleText(event.name).slice(0,200) : "";
    let hash = 0; for (const char of title + event.startDate) hash = (Math.imul(hash,31) + char.charCodeAt(0)) >>> 0;
    const candidate: VerifiedEvent = { id: `structured-${source.city}-${hash}`, city: source.city, interest: "city", title,
      description: typeof event.description === "string" ? articleText(event.description).slice(0,700) || "Программа организатора." : "Мероприятие из структурированной программы организатора.",
      advice: "Регистрацию, язык программы и наличие билетов нужно уточнить у организатора.",
      venue: String(event.location?.name ?? "Площадка уточняется у организатора").slice(0,250), registration: "unknown", availability: "unknown",
      status: /EventCancelled|EventPostponed/.test(String(event.eventStatus)) ? "cancelled" : "scheduled",
      dates: { start: event.startDate.slice(0,10), end: event.endDate.slice(0,10) }, source: { title: source.title, url: source.url }, verifiedAt: now.toISOString() };
    if (validVerifiedEvent(candidate)) events.push(candidate);
  };
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(script[1])); } catch { /* Malformed structured data never becomes a verified event. */ }
  }
  return events;
}
export function deduplicateEvents(events: VerifiedEvent[]): VerifiedEvent[] {
  const unique = new Map<string, VerifiedEvent>();
  for (const event of events) {
    const key = [event.city, event.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,""), event.dates.start, event.dates.end].join("|");
    const previous = unique.get(key);
    if (!previous || event.status === "cancelled" || event.verifiedAt > previous.verifiedAt && previous.status !== "cancelled") unique.set(key,event);
  }
  return [...unique.values()].filter(event => event.status !== "cancelled");
}

export function createOfficialEventSearch(fetcher: typeof fetch = fetch, clock = () => new Date(), sources = officialEventSources) {
  const cache = new Map<string, { html: string; verifiedAt: Date; expires: number }>();
  const pending = new Map<string, Promise<{ html: string; verifiedAt: Date; expires: number }>>();
  async function page(url: string) {
    if (cache.get(url)?.expires! > clock().getTime()) return cache.get(url)!;
    if (pending.has(url)) return pending.get(url)!;
    const promise = (async () => {
      const result = await fetcher(url, { signal: AbortSignal.timeout(10000), redirect: "error", headers: { Accept: "text/html", "User-Agent": "Travelator/0.1 (educational itinerary planner)" } });
      if (!result.ok || !result.headers.get("content-type")?.includes("text/html")) throw new Error("Source unavailable");
      const reader = result.body?.getReader(); if (!reader) throw new Error("Empty response");
      const chunks: Uint8Array[] = []; let size = 0;
      try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 1000000) throw new Error("Source too large"); chunks.push(part.value); } }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const html = new TextDecoder().decode(Buffer.concat(chunks));
      const entry = { html, verifiedAt: clock(), expires: clock().getTime() + 30 * 60000 };
      cache.set(url, entry); return entry;
    })().finally(() => pending.delete(url));
    pending.set(url, promise); return promise;
  }
  return async (value: unknown, signal?: AbortSignal): Promise<OfficialEventResult> => {
    const query = validateEventQuery(value), events: VerifiedEvent[] = [], warnings = new Set<string>();
    const selected = sources.filter(spec => query.cities.includes(spec.event.city));
    const checked = new Set<EventQuery["cities"][number]>();
    const jobs = selected.map(spec => async () => {
      signal?.throwIfAborted();
      try {
        const entry = await page(spec.event.source.url), event = extractOfficialEvent(entry.html, spec, entry.verifiedAt);
        if (!event) { warnings.add(`Источник «${spec.event.source.title}» изменился: даты события не подтверждены.`); return; }
        checked.add(event.city);
        if (event.dates.start <= query.end && event.dates.end >= query.start) events.push(event);
      } catch { warnings.add(`Не удалось проверить источник «${spec.event.source.title}». Это не означает отсутствия мероприятий.`); }
    });
    // Custom source fixtures stay isolated; production also checks organiser JSON-LD.
    const structured = sources === officialEventSources ? structuredEventSources.filter(source => query.cities.includes(source.city)) : [];
    jobs.push(...structured.map(source => async () => {
      signal?.throwIfAborted();
      try {
        const entry = await page(source.url), found = extractStructuredEvents(entry.html, source, entry.verifiedAt);
        if (!found.length) { warnings.add(`Источник «${source.title}» не вернул событий с полными датами и городом. Доступность афиши неизвестна.`); return; }
        checked.add(source.city); events.push(...found.filter(event => event.dates.start <= query.end && event.dates.end >= query.start));
      } catch { warnings.add(`Не удалось проверить источник «${source.title}». Маршрут можно составить без афиши.`); }
    }));
    for (let offset = 0; offset < jobs.length; offset += 3) { signal?.throwIfAborted(); await Promise.all(jobs.slice(offset,offset+3).map(job => job())); }
    signal?.throwIfAborted();
    const order = (a: VerifiedEvent, b: VerifiedEvent) => a.dates.start.localeCompare(b.dates.start) || a.id.localeCompare(b.id);
    return { source: "official_sites", query, events: deduplicateEvents(events).sort(order).slice(0,100), searchedAt: clock().toISOString(), checkedCities: [...checked].sort(), supportedCities: [...new Set([...sources.map(spec => spec.event.city), ...structured.map(source => source.city)])].sort(), warnings: [...warnings] };
  };
}
