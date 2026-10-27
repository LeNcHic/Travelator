import { destinationSeeds } from "./destination-seeds";
/** Stable identifiers are retained across catalogue expansions and saved trips. */
export const CITY_IDS = ["han", "sha", "bei", "zjj", "gui", "san", "qin", "xmn", "bha", "che", "xan", "hua", ...destinationSeeds.map(base => base.id)] as const;
export type CityId = typeof CITY_IDS[number];
