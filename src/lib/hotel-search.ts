import type { HotelProviderId, HotelSearchRequest, HotelSearchResult, HotelProviderStatus } from "../../shared/hotels";
import type { RoutePlan, TripInput } from "../types";
import { schedule } from "./planner";
import { addDays } from "./format";
import { chinaStartDate } from "./journey";

export function hotelSearchRequest(plan: RoutePlan, input: TripInput, index: number, provider: HotelProviderId): HotelSearchRequest {
  const row = schedule(plan, input)[index];
  return { provider, city: row.city,
    checkIn: addDays(chinaStartDate(input), row.checkIn), checkOut: addDays(chinaStartDate(input), row.checkOut),
    adults: 1, rooms: 1, currency: "CNY" };
}

async function request<T>(path: string, signal: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error?.message || "Поиск недоступен. Проверьте, что сервер приложения запущен.");
  return data as T;
}
export const getHotelProviders = (signal: AbortSignal) =>
  request<{ providers: HotelProviderStatus[] }>("/api/hotels/providers", signal);
export const searchHotels = (query: HotelSearchRequest, signal: AbortSignal) =>
  request<HotelSearchResult>("/api/hotels/search", signal, query);
