import type { FlightQuote } from "../shared/flights";
import type { FlyaiHotelQuote, TrainQuote } from "../shared/flyai";

import type { CityId } from "../shared/cities";
export type { CityId } from "../shared/cities";
export type Interest = "city" | "nature" | "sea";
export type Mode = "air" | "train";
export type Screen = "discover" | "create" | "compare" | "plan";
export type TripPriority = "value" | "fast" | "balance";

export interface JourneyPreferences {
  // New preference-based trips use all days for stops; older saves retain their calendar.
  planningMode?: "automatic";
  flexibleDates?: boolean;
  origin: "MOW";
  daysByInterest: Record<Interest, number>;
  minStops: number;
  maxStops: number;
  requiredPlaces: string[];
}

export interface TripInput {
  country?: string;
  start: CityId;
  end: CityId;
  startDate: string;
  days: number;
  budget: number;
  interests: Interest[];
  required: CityId[];
  seaEnd: boolean;
  seaDays: number;
  transport: "mixed" | Mode;
  pace: "balanced" | "slow" | "active";
  priority: TripPriority;
  cityOrder: "auto" | "fixed";
  journey?: JourneyPreferences;
  maxTrainMinutes?: 120;
}

export interface City {
  country?: string;
  id: CityId;
  name: string;
  en: string;
  cn: string;
  kind: string;
  interest: Interest;
  experiences?: Interest[];
  point: [number, number];
  description: string;
  activities: string[];
}

export interface Ticket {
  id: string;
  from: CityId;
  to: CityId;
  mode: Mode;
  service: string;
  departure: number;
  minutes: number;
  overhead: number;
  price: number;
  detail: string;
  // Live trains reserve calendar days through the actual arrival date.
  calendarDays?: number;
}

export interface Hotel {
  id: string;
  city: CityId;
  name: string;
  area: string;
  stars: number;
  rating: string;
  nightly: number;
  features: string[];
}

export interface RoutePlan {
  id: TripPriority;
  // The arrival day belongs to the destination; only earlier transit dates add days.
  calendarMode?: "shared";
  cities: CityId[];
  days: number[];
  tickets: string[];
  hotels: string[];
  hotelQuotes?: Partial<Record<CityId, FlyaiHotelQuote>>;
  flightQuotes?: Partial<Record<CityId, FlightQuote>>;
  outdatedFlights?: CityId[];
  trainQuotes?: Partial<Record<CityId, TrainQuote>>;
  outdatedTrains?: CityId[];
  visits?: Partial<Record<CityId, string[][]>>;
}

export interface Attraction {
  id: string;
  city: CityId;
  name: string;
  category: string;
  point: [number, number];
  minutes: number;
  description: string;
}

export interface SavedTrip {
  id: string;
  savedAt: string;
  input: TripInput;
  plan: RoutePlan;
}

export interface AppSnapshot {
  version: 1;
  input: TripInput;
  plan: RoutePlan | null;
  screen: Screen;
  routeSource?: "demo" | "flyai";
}
