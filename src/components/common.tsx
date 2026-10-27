import {
  CalendarDays,
  Landmark,
  Mountain,
  Pin,
  Wallet,
  Plane,
  Waves,
} from "lucide-react";
import { cities } from "../data/catalog";
import { addDays, daysText, displayDate, money } from "../lib/format";
import type { CityId, TripInput } from "../types";

export function CityIcon({ city }: { city: CityId }) {
  const Icon = cities[city].interest === "sea" ? Waves : cities[city].interest === "nature" ? Mountain : Landmark;
  return <Icon size={18} aria-hidden="true" />;
}

export function Conditions({ input }: { input: TripInput }) {
  if (input.journey) return <div className="tv-request-strip">
    <span><Plane />Москва · туда и обратно</span>
    <span><CalendarDays />{displayDate(input.startDate)} — {displayDate(addDays(input.startDate, input.days - 1))} · {daysText(input.days)}</span>
    <span><Pin />{input.journey.minStops}–{input.journey.maxStops} баз для ночёвок</span>
  </div>;
  return (
    <div className="tv-request-strip">
      <span>
        <CalendarDays />
        {displayDate(input.startDate)} —{" "}
        {displayDate(addDays(input.startDate, input.days - 1))} ·{" "}
        {daysText(input.days)}
      </span>
      <span>
        <Wallet />
        До {money(input.budget)}
      </span>
      <span>
        <Pin />
        {[...new Set([input.start, ...input.required, input.end])]
          .map((id) => cities[id].name)
          .join(" · ")}
      </span>
      {input.seaEnd && (
        <span>
          <Waves />
          Море в конце · от {input.seaDays} дней
        </span>
      )}
    </div>
  );
}
