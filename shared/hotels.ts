import type { CityId } from "../src/types.ts";

export type HotelProviderId = "demo" | "ostrovok";
export interface HotelSearchRequest {
  provider: HotelProviderId;
  city: CityId;
  checkIn: string;
  checkOut: string;
  adults: 1;
  rooms: 1;
  currency: "CNY";
}

// Provider IDs and complete-stay prices are separate from the local catalogue.
// A live integration must supply rate conditions before allowing selection.
export interface HotelOffer {
  id: string;
  provider: HotelProviderId;
  catalogHotelId?: string;
  name: string;
  area: string;
  stars: number;
  rating: string | null;
  features: string[];
  total: number;
  currency: "CNY";
  nights: number;
  checkIn: string;
  checkOut: string;
}
export interface HotelSearchResult {
  provider: HotelProviderId;
  isDemo: boolean;
  searchedAt: string;
  offers: HotelOffer[];
}
export interface HotelProviderStatus {
  id: HotelProviderId;
  available: boolean;
  state: "ready" | "awaiting_access" | "awaiting_integration";
  message: string;
}
