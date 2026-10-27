import type { RoutePlan, TripInput } from "../src/types";

export interface LiveRouteProgress {
  requests: number;
  maxRequests: number;
  message: string;
}
export interface LiveRouteResult {
  source: "flyai" | "railgo";
  input: TripInput;
  plans: RoutePlan[];
  errors: string[];
  warnings: string[];
  searchedAt: string;
  partial: boolean;
  stats: { requests: number; templates: number; completedTemplates: number; candidates: number };
}
export type LiveRouteEvent =
  | { type: "progress"; progress: LiveRouteProgress }
  | { type: "result"; result: LiveRouteResult }
  | { type: "error"; message: string };
