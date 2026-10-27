import type { CityId } from "../src/types.ts";
import { CITY_IDS } from "./cities.ts";

export type FlyaiQuery =
  | { kind: "hotel"; city: CityId; checkIn: string; checkOut: string }
  | { kind: "train"; from: CityId; to: CityId; date: string };

// A search estimate is not a room/rate plan or a confirmed booking quote.
export interface FlyaiHotelQuote {
  source: "flyai";
  hotelId: string;
  city: CityId;
  name: string;
  address: string;
  checkIn: string;
  checkOut: string;
  currency: "CNY";
  nightly: number;
  /** Approximate straight-line distance from the destination's base point. */
  distanceKm?: number;
  priceBasis: "nightly_search_estimate";
  searchedAt: string;
}

export interface FlyaiTrainQuote {
  source: "flyai";
  from: CityId;
  to: CityId;
  trainNumber: string;
  fromStation: string;
  toStation: string;
  seatClass: string;
  departure: string;
  arrival: string;
  minutes: number;
  amount: number;
  currency: "CNY";
  priceBasis: "passenger_search_estimate";
  searchedAt: string;
}

// RailGo supplies a dated timetable, never a fare or seat availability.
export interface RailgoTrainQuote extends Omit<FlyaiTrainQuote, "source" | "priceBasis"> {
  source: "railgo";
  priceBasis: "catalogue_estimate";
}
export type TrainQuote = FlyaiTrainQuote | RailgoTrainQuote;

export interface FlyaiOffer {
  id: string;
  name: string;
  description: string;
  priceLabel: string;
  url: string | null;
  hotelQuote?: FlyaiHotelQuote;
  trainQuote?: FlyaiTrainQuote;
  departure?: string;
  arrival?: string;
  minutes?: number;
}
export interface FlyaiResult {
  source: "flyai";
  query: FlyaiQuery;
  searchedAt: string;
  access: "personal_key" | "trial";
  limited: boolean;
  offers: FlyaiOffer[];
}

export function parseFlyaiPrice(label: string): number | null {
  if (!/^(?:¥\s*)?\d+(?:\.\d{1,2})?$/.test(label)) return null;
  const value = Number(label.replace(/^¥\s*/, ""));
  return Number.isFinite(value) && value > 0 && value <= 1_000_000 ? value : null;
}

export function validHotelQuote(value: unknown): value is FlyaiHotelQuote {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const q = value as FlyaiHotelQuote;
  const date = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
    && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d;
  if (!date(q.checkIn) || !date(q.checkOut)) return false;
  const nights = (Date.parse(q.checkOut) - Date.parse(q.checkIn)) / 86400000;
  return q.source === "flyai" && q.currency === "CNY" && q.priceBasis === "nightly_search_estimate"
    && (CITY_IDS as readonly string[]).includes(q.city)
    && typeof q.hotelId === "string" && /^\d{1,40}$/.test(q.hotelId)
    && typeof q.name === "string" && q.name.length > 0 && q.name.length <= 250
    && typeof q.address === "string" && q.address.length <= 250
    && typeof q.nightly === "number" && parseFlyaiPrice(String(q.nightly)) === q.nightly
    && (q.distanceKm === undefined || (typeof q.distanceKm === "number" && Number.isFinite(q.distanceKm) && q.distanceKm >= 0 && q.distanceKm <= 20040))
    && nights > 0 && nights <= 28
    && typeof q.searchedAt === "string" && Number.isFinite(Date.parse(q.searchedAt));
}

/** Parse the provider's wall-clock time explicitly as China time (UTC+8). */
export function chinaDateTime(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:00$/.test(value)) return null;
  const date = value.slice(0, 10);
  const midnight = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) return null;
  return Date.parse(`${date}T${value.slice(11)}+08:00`);
}

export function validTrainQuote(value: unknown): value is TrainQuote {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const q = value as TrainQuote;
  const departure = chinaDateTime(q.departure), arrival = chinaDateTime(q.arrival);
  const cityIds: readonly string[] = CITY_IDS;
  const text = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
  return ((q.source === "flyai" && q.priceBasis === "passenger_search_estimate")
      || (q.source === "railgo" && q.priceBasis === "catalogue_estimate" && q.minutes <= 120)) && q.currency === "CNY"
    && cityIds.includes(q.from) && cityIds.includes(q.to) && q.from !== q.to
    && text(q.trainNumber, 40) && /^[A-Z0-9/-]+$/i.test(q.trainNumber)
    && text(q.fromStation, 250) && text(q.toStation, 250) && text(q.seatClass, 100)
    && typeof q.amount === "number" && parseFlyaiPrice(String(q.amount)) === q.amount
    && Number.isInteger(q.minutes) && q.minutes > 0 && q.minutes <= 4320
    && departure !== null && arrival !== null && arrival - departure === q.minutes * 60000
    && typeof q.searchedAt === "string" && Number.isFinite(Date.parse(q.searchedAt));
}

export function trainQuoteKey(q: TrainQuote): string {
  return JSON.stringify([q.source, q.from, q.to, q.trainNumber, q.departure, q.arrival, q.fromStation, q.toStation, q.seatClass]);
}

export const trainSeatLabel = (seat: string) => ({
  "二等座": "2-й класс", "一等座": "1-й класс", "商务座": "Бизнес-класс",
  "硬座": "Сидячее место", "硬卧": "Спальное место", "软卧": "Купе",
}[seat] ?? seat);
