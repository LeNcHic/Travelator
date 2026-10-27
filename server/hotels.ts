import { cityIds, hotelsIn } from "../src/data/catalog.ts";
import type { HotelProviderStatus, HotelSearchRequest, HotelSearchResult } from "../shared/hotels.ts";

export class HotelApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface HotelProvider {
  status(): HotelProviderStatus;
  search(request: HotelSearchRequest): Promise<HotelSearchResult>;
}

function dateValue(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

export function validateSearch(value: unknown): HotelSearchRequest {
  const fail = () => { throw new HotelApiError(400, "INVALID_SEARCH", "Проверьте город, даты проживания и параметры гостей."); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const v = value as Record<string, unknown>;
  const nights = (dateValue(v.checkOut) - dateValue(v.checkIn)) / 86_400_000;
  if (!cityIds.some(city => city === v.city) || !["demo", "ostrovok"].includes(v.provider as string)
    || !Number.isInteger(nights) || nights < 1 || nights > 28
    || v.adults !== 1 || v.rooms !== 1 || v.currency !== "CNY") return fail();
  // Copy only the supported fields; never accept provider URLs or credentials.
  return { provider: v.provider, city: v.city, checkIn: v.checkIn, checkOut: v.checkOut,
    adults: 1, rooms: 1, currency: "CNY" } as HotelSearchRequest;
}

export function createHotelProviders(env: Record<string, string | undefined>) {
  const demo: HotelProvider = {
    status: () => ({ id: "demo", available: true, state: "ready", message: "Подборка гостиниц · стоимость ориентировочная" }),
    async search(request) {
      const nights = (dateValue(request.checkOut) - dateValue(request.checkIn)) / 86_400_000;
      return {
        provider: "demo", isDemo: true, searchedAt: new Date().toISOString(),
        offers: hotelsIn(request.city).map(hotel => ({
          id: `demo:${hotel.id}:${request.checkIn}:${request.checkOut}`,
          provider: "demo", catalogHotelId: hotel.id, name: hotel.name, area: hotel.area,
          stars: hotel.stars, rating: hotel.rating, features: hotel.features,
          total: hotel.nightly * nights, currency: "CNY", nights,
          checkIn: request.checkIn, checkOut: request.checkOut,
        })),
      };
    },
  };
  const hasKeys = Boolean(env.OSTROVOK_KEY_ID?.trim() && env.OSTROVOK_API_KEY?.trim());
  const ostrovok: HotelProvider = {
    status: () => ({
      id: "ostrovok", available: false,
      state: hasKeys ? "awaiting_integration" : "awaiting_access",
      message: hasKeys
        ? "Ключи заданы. Подключение и проверка поиска ещё не завершены."
        : "Ожидаем доступ от Островка. Реальные цены пока недоступны.",
    }),
    async search() {
      // Deliberately no network call or demo fallback. Enable only after the
      // approved API contract, content mapping and rate handling are implemented.
      throw new HotelApiError(503, "PROVIDER_NOT_READY", this.status().message);
    },
  };
  return { demo, ostrovok };
}
