import type { CityId } from "../src/types";
import { CITY_IDS } from "./cities";

export interface EventQuery { cities: CityId[]; start: string; end: string }
export interface VerifiedEvent {
  id: string; city: CityId; interest?: "city" | "nature" | "sea"; title: string; description: string; advice: string;
  dates: { start: string; end: string };
  source: { title: string; url: string };
  verifiedAt: string;
  venue?: string; registration?: "required" | "not_required" | "unknown";
  availability?: "unknown"; status?: "scheduled" | "cancelled";
}
export interface OfficialEventResult {
  source: "official_sites"; query: EventQuery; events: VerifiedEvent[]; searchedAt: string;
  checkedCities: CityId[]; supportedCities: CityId[]; warnings: string[];
}
export const eventSourceHosts = ["english.shanghai.gov.cn", "english.beijing.gov.cn", "wlj.xa.gov.cn", "www.gochengdu.cn", "www.zjam.org.cn", "www.njmuseum.com", "www.szmuseum.com", "ucca.org.cn", "www.gdmuseum.com"] as const;
export const validEventDate = (date: unknown): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
export function validVerifiedEvent(value: unknown): value is VerifiedEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const e = value as VerifiedEvent;
  const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
  let sourceValid = false;
  try { const url = new URL(e.source.url); sourceValid = url.protocol === "https:" && (eventSourceHosts as readonly string[]).includes(url.hostname) && !url.port && !url.username && !url.password; } catch { return false; }
  return typeof e.id === "string" && /^[a-z0-9-]{1,100}$/.test(e.id) && (CITY_IDS as readonly string[]).includes(e.city) && sourceValid
    && (e.interest === undefined || ["city", "nature", "sea"].includes(e.interest))
    && (e.venue === undefined || text(e.venue, 250)) && (e.registration === undefined || ["required", "not_required", "unknown"].includes(e.registration))
    && (e.availability === undefined || e.availability === "unknown") && (e.status === undefined || ["scheduled", "cancelled"].includes(e.status))
    && text(e.title, 200) && text(e.description, 700) && text(e.advice, 700) && text(e.source.title, 200)
    && validEventDate(e.dates?.start) && validEventDate(e.dates?.end) && e.dates.start <= e.dates.end
    && Date.parse(e.dates.end) - Date.parse(e.dates.start) <= 366 * 86400000
    && typeof e.verifiedAt === "string" && Number.isFinite(Date.parse(e.verifiedAt));
}
export function currentEventsForStay(events: VerifiedEvent[], city: CityId, start: string, end: string, now = Date.now()): VerifiedEvent[] {
  return events.filter(event => validVerifiedEvent(event) && event.status !== "cancelled" && event.city === city
    && now - Date.parse(event.verifiedAt) >= -300000 && now - Date.parse(event.verifiedAt) <= 6 * 3600000
    && event.dates.start <= end && event.dates.end >= start);
}
