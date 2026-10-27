import type { CityId } from "../src/types";
import type { RailgoTrainQuote } from "./flyai";

export const SHORT_TRAIN_MINUTES = 120;
export interface RailgoQuery { from: CityId; to: CityId; date: string }
export interface RailgoResult {
  source: "railgo";
  query: RailgoQuery;
  searchedAt: string;
  maxMinutes: 120;
  trains: RailgoTrainQuote[];
}
