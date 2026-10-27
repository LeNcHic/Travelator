import type { TripInput, RoutePlan } from "../types";
import type { VerifiedEvent } from "../../shared/events";
import type { WeatherDay } from "../../shared/weather";
import type { RouteAdjustment } from "./route-adjustments";
import type { RouteRecovery } from "./route-recovery";

export type PlannerTask =
  | { kind: "routes"; input: TripInput; events?: VerifiedEvent[]; weather?: WeatherDay[] }
  | { kind: "adjustments"; input: TripInput; plan: RoutePlan }
  | { kind: "recoveries"; input: TripInput };
export interface PlannerResults {
  routes: { plans: RoutePlan[]; errors: string[] };
  adjustments: RouteAdjustment[];
  recoveries: RouteRecovery[];
}
export type PlannerReply = { id: number } & ({ ok: true; result: PlannerResults[keyof PlannerResults] } | { ok: false; error: string });
