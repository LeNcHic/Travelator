import { hasExactDates } from "../lib/trip-timing";
import { useState } from "react";
import FlightOffers from "./FlightOffers";
import RailgoOffers from "./RailgoOffers";
import { Check, Plane, TrainFront } from "lucide-react";
import { cities, ticketsBetween } from "../data/catalog";
import {
  addDays,
  clockTime,
  displayDate,
  duration,
  money,
  nightsText,
} from "../lib/format";
import { changeTicket, schedule, selectFlyaiTrain, selectFlyaiFlight, totals, travelMinutes } from "../lib/planner";
import { trainQuoteKey } from "../../shared/flyai";
import { chinaStartDate } from "../lib/journey";
import type { RoutePlan, TripInput } from "../types";
import Modal from "./Modal";
import HotelOffers from "./HotelOffers";

export default function OfferPicker({
  type,
  index,
  input,
  plan,
  onClose,
  onChange,
  onDates,
}: {
  type: "hotel" | "ticket";
  index: number;
  input: TripInput;
  plan: RoutePlan;
  onClose: () => void;
  onDates?: () => void;
  onChange: (plan: RoutePlan, notice: string) => void;
}) {
  const row = schedule(plan, input)[index];
  const [source, setSource] = useState<"demo" | "railgo" | "flyai">(input.transport === "air" || row.ticket?.mode === "air" ? "flyai" : "railgo");
  const title =
    type === "hotel"
      ? `Гостиницы · ${cities[row.city].name}`
      : `${cities[plan.cities[index]].name} → ${cities[plan.cities[index + 1]].name}`;
  if (type === "hotel" && !row.nights) return <Modal title={title} onClose={onClose}><p>В этой остановке ночёвка не нужна.</p></Modal>;
  if (!hasExactDates(input)) return <Modal title={title} onClose={onClose}><p className="tv-picker-intro">Для поиска предложений нужны точные даты. Предварительная стоимость уже учтена в маршруте.</p><button className="tv-button tv-primary" onClick={onDates ?? onClose}>Указать даты поездки</button></Modal>;
  return (
    <Modal title={title} onClose={onClose}>
      <p className="tv-picker-intro">
        {type === "hotel"
          ? `${displayDate(addDays(chinaStartDate(input), row.checkIn))} — ${displayDate(addDays(chinaStartDate(input), row.checkOut))} · ${nightsText(row.nights)} · один человек`
          : `${displayDate(addDays(chinaStartDate(input), row.transferStart))} · один пассажир`}
      </p>
      {type === "ticket" && <div className="tv-hotel-sources" role="group" aria-label="Источник билетов">
        <button aria-pressed={source === "demo"} onClick={() => setSource("demo")}>Оценка переезда</button>
        {input.transport !== "air" && <button aria-pressed={source === "railgo"} onClick={() => setSource("railgo")}>RailGo · до 2 часов</button>}
        {input.transport !== "train" && <button aria-pressed={source === "flyai"} onClick={() => setSource("flyai")}>Поиск рейсов</button>}
      </div>}
      {type === "ticket" && source === "demo" && <p className="tv-demo-note">
        Ориентировочные варианты для планирования бюджета. Расписание, тариф и
        условия уточняются при поиске билетов.
      </p>}
      <div className="tv-offers">
        {type === "hotel"
          ? <HotelOffers index={index} input={input} plan={plan} onChange={onChange} onClose={onClose} />
          : source === "flyai" ? <FlightOffers query={{ from: row.city, to: plan.cities[index + 1], date: addDays(chinaStartDate(input), row.transferStart) }} selected={row.flightQuote} onDates={onDates}
              preview={quote => { const next = selectFlyaiFlight(plan, input, index, quote); return next ? totals(next, input) : null; }}
              onSelect={quote => { const next = selectFlyaiFlight(plan, input, index, quote); if (!next) return; onChange(next, `Рейс ${quote.flightNumber} добавлен в план. Учтён тариф FlyAI на одного пассажира; сборы и окончательная сумма требуют проверки.`); onClose(); }} />
          : source === "railgo" ? <RailgoOffers
              query={{ from: plan.cities[index], to: plan.cities[index + 1], date: addDays(chinaStartDate(input), row.transferStart) }}
              selectedKey={row.trainQuote ? trainQuoteKey(row.trainQuote) : undefined}
              preview={quote => {
                const next = selectFlyaiTrain(plan, input, index, quote);
                if (!next) return null;
                const t = totals(next, input);
                return { total: t.total, changed: next.days.some((days, i) => days !== plan.days[i]) };
              }}
              onSelect={quote => {
                const next = selectFlyaiTrain(plan, input, index, quote);
                if (!next) return;
                onChange(next, `Поезд ${quote.trainNumber} добавлен по расписанию RailGo. Стоимость билета ориентировочная; наличие мест неизвестно. Время местное, Китай.`);
                onClose();
              }} />
          : ticketsBetween(plan.cities[index], plan.cities[index + 1])
              .filter(
                (ticket) =>
                  (input.transport === "mixed" || ticket.mode === input.transport)
                  && (ticket.mode !== "train" || input.maxTrainMinutes === undefined || ticket.minutes <= input.maxTrainMinutes),
              )
              .map((ticket) => {
                const selected = plan.tickets[index] === ticket.id && !row.trainQuote && !row.flightQuote;
                const next = changeTicket(plan, input, index, ticket.id);
                const overnight = Math.floor(
                  (ticket.departure + ticket.minutes) / 1440,
                );
                return (
                  <article
                    className={`tv-offer ${selected ? "tv-offer-selected" : ""}`}
                    key={ticket.id}
                  >
                    <div className="tv-offer-top">
                      <span className="tv-offer-symbol">
                        {ticket.mode === "air" ? <Plane /> : <TrainFront />}
                      </span>
                      <div>
                        <h3>
                          {ticket.mode === "air" ? "Перелёт" : "Переезд на поезде"}
                        </h3>
                        <p>{ticket.detail}</p>
                      </div>
                    </div>
                    <div className="tv-ticket-time">
                      <strong>{clockTime(ticket.departure)}</strong>
                      <span>
                        <span>{duration(ticket.minutes)} в пути</span>
                        <span className="tv-ticket-line" />
                      </span>
                      <strong>
                        {clockTime(ticket.departure + ticket.minutes)}
                        {overnight > 0 && <small> +{overnight} д.</small>}
                      </strong>
                    </div>
                    <p className="tv-hint">
                      Всего с запасом на вокзал или аэропорт:{" "}
                      {duration(travelMinutes(ticket))}.
                    </p>
                    {!next && (
                      <p className="tv-over-budget">
                        Не хватает дней на такой переезд. Измените длительность
                        поездки.
                      </p>
                    )}
                    <div className="tv-offer-bottom">
                      <div>
                        <strong>{money(ticket.price)}</strong>
                        <small>
                          {next
                            ? `Вся поездка ${money(totals(next, input).total)}`
                            : "Билет на одного человека"}
                        </small>
                      </div>
                      <button
                        className={`tv-button ${selected ? "tv-secondary" : "tv-primary"}`}
                        disabled={selected || !next}
                        onClick={() => {
                          if (next) {
                            onChange(
                              next,
                              `Переезд добавлен в план. Бюджет и длительность остановок пересчитаны.`,
                            );
                            onClose();
                          }
                        }}
                      >
                        {selected ? (
                          <>
                            <Check />В плане
                          </>
                        ) : (
                          "Выбрать"
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
      </div>
    </Modal>
  );
}
