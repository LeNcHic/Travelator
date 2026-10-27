import type { CityId, TripInput } from "../types";
import { additionalProfiles } from "./catalog-expansion";

/** Editorial planning ranges, in calendar days including arrival; never a booking constraint. */
export const destinationProfiles: Record<CityId, { min: number; max: number }> = {
  ...additionalProfiles,
  sha: { min: 3, max: 5 }, bei: { min: 4, max: 6 },
  zjj: { min: 3, max: 4 }, gui: { min: 3, max: 5 },
  san: { min: 4, max: 7 }, han: { min: 2, max: 3 },
  qin: { min: 3, max: 5 }, xmn: { min: 3, max: 5 },
  bha: { min: 3, max: 5 }, che: { min: 3, max: 5 },
  xan: { min: 3, max: 4 }, hua: { min: 3, max: 4 },
};

/** A softer pace favours longer stays; these are preferences, never required minima. */
export function preferredStay(city: CityId, pace: TripInput["pace"] = "balanced") {
  const range = destinationProfiles[city];
  if (pace === "slow") return { min: range.min + 1, max: range.max + 2 };
  if (pace === "active") return { min: Math.max(2, range.min - 1), max: Math.max(2, range.max - 1) };
  return range;
}
