import type { TripInput } from "../types";
import { addDays, clockTime } from "./format";
import { chinaStartDate } from "./journey";
import { schedule, travelMinutes } from "./planner";

/** Presentation data follows the same calendar and validated quote as hotel stays. */
export function planTransfer(row: ReturnType<typeof schedule>[number], input: TripInput) {
  const ticket = row.ticket;
  if (!ticket) return null;
  const quote = row.flightQuote ?? row.trainQuote;
  const start = quote?.departure.slice(0, 10) ?? addDays(chinaStartDate(input), row.transferStart);
  const end = quote?.arrival.slice(0, 10) ?? addDays(start, row.transferLength - 1);
  return {
    start, end,
    departure: quote?.departure.slice(11, 16) ?? clockTime(ticket.departure),
    arrival: quote?.arrival.slice(11, 16) ?? clockTime(ticket.departure + ticket.minutes),
    rideMinutes: ticket.minutes,
    totalMinutes: travelMinutes(ticket),
    estimatedSchedule: !quote,
    estimatedPrice: quote?.source !== "flyai",
    source: quote ? `Расписание ${quote.source === "railgo" ? "RailGo" : "FlyAI"}`
      : ticket.mode === "air" ? "Оценка перелёта" : "Ориентировочное расписание",
  };
}
