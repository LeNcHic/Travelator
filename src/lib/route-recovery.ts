import type { TripInput } from "../types";
import { addDays, daysText, displayDate, money } from "./format";
import { restDays, validJourney } from "./journey";
import { generateRoutes, totals } from "./planner";
import { isCalendarDate } from "./travel-calendar";
import { hasExactDates, internationalDays } from "./trip-timing";

export interface RouteRecovery {
  id: "longer-holiday" | "mixed-transport" | "higher-budget";
  label: string;
  hint: string;
  input: TripInput;
  message: string;
}

/** Each suggestion changes one constraint and must produce a complete local route. */
export function routeRecoveries(input: TripInput): RouteRecovery[] {
  if (!validJourney(input.journey) || !isCalendarDate(input.startDate)
    || !Number.isInteger(input.days) || input.days < 5 || input.days > 28
    || !Number.isFinite(input.budget) || input.budget < 1000 || input.budget > 100000
    || generateRoutes(input).plans.length) return [];
  const suggestions: RouteRecovery[] = [];
  if (input.transport !== "mixed") {
    const next: TripInput = { ...input, transport: "mixed", maxTrainMinutes: 120 };
    if (generateRoutes(next).plans.length) suggestions.push({ id: "mixed-transport", input: next,
      label: "Разрешить самолёты и короткие поезда",
      hint: "Даты, бюджет и минимумы отдыха сохранятся.",
      message: "Разрешили внутренние перелёты и поезда до 2 часов. Даты, бюджет и обязательные места сохранены." });
  }
  const earliest = Math.max(input.days + 1, restDays(input) + internationalDays(input));
  for (let days = earliest; days <= 28; days++) {
    const next = { ...input, days };
    if (!generateRoutes(next).plans.length) continue;
    const returnDate = displayDate(addDays(input.startDate, days - 1));
    const returnHint = hasExactDates(input) ? `Возвращение ${returnDate}. ` : "";
    suggestions.push({ id: "longer-holiday", input: next, label: `Отпуск — ${daysText(days)}`,
      hint: `На ${daysText(days - input.days)} больше. ${returnHint}Бюджет прежний.`,
      message: `Увеличили отпуск до ${days} дней. ${returnHint}Минимумы отдыха, бюджет и обязательные места сохранены.` });
    break;
  }
  const generous = { ...input, budget: 100000 };
  const cheapest = [...generateRoutes(generous).plans].sort((a, b) => totals(a, generous).total - totals(b, generous).total)[0];
  if (cheapest) {
    const budget = Math.ceil(totals(cheapest, generous).total / 100) * 100;
    const next = { ...input, budget };
    if (budget > input.budget && budget <= 100000 && generateRoutes(next).plans.length) suggestions.push({
      id: "higher-budget", input: next, label: `Бюджет — ${money(budget)}`,
      hint: `На ${money(budget - input.budget)} больше. Срок и пожелания сохранятся.`,
      message: `Увеличили бюджет внутри Китая до ${money(budget)}. Даты, транспорт, минимумы отдыха и обязательные места сохранены.` });
  }
  return suggestions;
}
