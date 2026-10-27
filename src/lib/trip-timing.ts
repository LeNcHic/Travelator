import type { TripInput } from "../types";

export const isAutomaticTrip = (input: TripInput) => input.journey?.planningMode === "automatic";
export const hasExactDates = (input: TripInput) => !input.journey?.flexibleDates;
export const internationalDays = (input: TripInput) => input.journey && !isAutomaticTrip(input) ? 2 : 0;
export const tripDayOffset = (input: TripInput) => internationalDays(input) / 2;
export const availableTripDays = (input: TripInput) => input.days - internationalDays(input);
export const calendarTransferGap = (length: number, input: TripInput) => isAutomaticTrip(input) ? 0
  : Math.max(0, length - Number(Boolean(input.journey)));
