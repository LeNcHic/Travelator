import { hasExactDates } from "../lib/trip-timing";
import { ArrowRight, Check, Clock3, Pin } from "lucide-react";
import { attractionById } from "../data/attractions";
import { addDays, displayDate, duration } from "../lib/format";
import { placesFor } from "../lib/journey";
import { visitMoveOptions } from "../lib/city-day-overview";
import { schedule } from "../lib/planner";
import type { RoutePlan, TripInput } from "../types";
import Modal from "./Modal";

export default function VisitMoveDialog({ plan, input, index, id, onChoose, onClose }: {
  plan: RoutePlan; input: TripInput; index: number; id: string;
  onChoose: (day: number | null) => void; onClose: () => void;
}) {
  const city = plan.cities[index], place = attractionById(id)!;
  const row = schedule(plan, input)[index];
  const required = placesFor(input, city).some(item => item.id === id);
  const options = visitMoveOptions(plan, input, city, id);
  return <Modal title="В какой день?" eyebrow="ПЕРЕНОС МЕСТА" onClose={onClose} className="cp-move-dialog">
    <p className="cp-moving-place"><strong>{place.name}</strong><span><Clock3 />≈ {duration(place.minutes)} на посещение</span></p>
    <p className="cp-move-hint">Выберите день — место перенесётся сразу. Ниже показана нагрузка с учётом этого посещения.</p>
    <div className="cp-move-days" aria-label="Дни для переноса">
      {options.map(option => <button key={option.day} disabled={option.current} className={option.overloaded ? "cp-busy-option" : ""}
        aria-label={`День ${option.day + 1}, ${hasExactDates(input) ? displayDate(addDays(row.date, option.day)) : `день ${row.first + option.day + 1} поездки`}${option.current ? ", сейчас здесь" : `, после переноса ${duration(option.minutes)}${option.overloaded ? ", насыщенный день" : ""}`}`}
        onClick={() => onChoose(option.day)}>
        <span><strong>День {option.day + 1} <small>{hasExactDates(input) ? displayDate(addDays(row.date, option.day)) : `День ${row.first + option.day + 1} поездки`}</small></strong>
          <span>{option.current ? "Сейчас здесь" : `Будет ≈ ${duration(option.minutes)}`}{option.day === 0 && row.arrival ? " · день приезда" : ""}</span>
          {!option.current && option.overloaded && <em>{option.capacity ? `Больше ориентира ${duration(option.capacity)}` : "Время оставлено на заселение и отдых"}</em>}
        </span>{option.current ? <Check /> : <ArrowRight />}
      </button>)}
    </div>
    {required ? <p className="cp-move-required"><Pin />Обязательное место можно перенести, оно останется в поездке.</p>
      : <button className="cp-unassign" onClick={() => onChoose(null)}>Пока оставить без дня</button>}
    <p className="cp-move-hint">Время ориентировочное; между местами заложено по 30 минут. Перенос можно отменить.</p>
  </Modal>;
}
