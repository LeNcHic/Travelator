import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, Undo2 } from "lucide-react";
import { cities, cityIds } from "../data/catalog";
import { holidayPeriod, isCalendarDate, periodLabel, type DatePeriod } from "../lib/travel-calendar";
import { isoDate } from "../lib/format";
import type { CityId } from "../types";
import TravelMoments from "./TravelMoments";

export default function DateDiscovery({ startDate, days, onApply, onPreviewPeriod, onExplore }: {
  startDate: string; days: number; onApply: (start: string, days: number) => void;
  onPreviewPeriod: (period: DatePeriod | null) => void; onExplore: (city: CityId) => void;
}) {
  const [start, setStart] = useState(startDate), [length, setLength] = useState(days);
  const [city, setCity] = useState<CityId | "all">("all");
  const [open, setOpen] = useState(false);
  const periodButton = useRef<HTMLButtonElement>(null);
  const period = holidayPeriod(start, length), today = isoDate(new Date());
  const invalid = !period || start < today;
  const different = start !== startDate || length !== days;
  useEffect(() => {
    setStart(startDate); setLength(days);
    onPreviewPeriod(holidayPeriod(startDate, days));
  }, [startDate, days, onPreviewPeriod]);
  function change(nextStart: string, nextDays: number) {
    setStart(nextStart); setLength(nextDays);
    onPreviewPeriod(holidayPeriod(nextStart, nextDays));
  }
  return <section className="date-discovery discovery-section" id="trip-calendar" aria-label="Идеи на даты отдыха">
    <div className="date-discovery-intro"><div><p className="new-eyebrow">ВЫБИРАЙТЕ НЕ ТОЛЬКО МЕСТО, НО И МОМЕНТ</p><h2>Что ждёт вас в поездке?</h2><p>Посмотрите события и идеи для прогулок на время отпуска.</p></div>
      <button ref={periodButton} type="button" className="date-period-toggle" aria-expanded={open} aria-controls="discovery-period" onClick={() => setOpen(!open)}><CalendarDays /><span><small>{different ? "Просмотр других дат · поездка без изменений" : "Предполагаемые дни в Китае"}</small><strong>{period ? periodLabel(period) : "Выберите даты"}</strong></span><ChevronDown /></button>
    </div>
    {open && <div className="date-discovery-controls" id="discovery-period">
      <label>Вылет из Москвы<input type="date" min={today} value={start} onChange={event => change(event.target.value, length)} /></label>
      <label>Весь отпуск, дней<input type="number" min={5} max={28} value={Number.isFinite(length) ? length : ""} onChange={event => change(start, event.target.valueAsNumber)} /></label>
      <div className="date-apply"><button type="button" className="tv-button tv-secondary" disabled={invalid || !different} onClick={() => { if (!invalid) onApply(start, length); }}>{different ? "Взять эти даты для поездки" : <><Check />Даты вашей поездки</>}</button><small>{different ? "После применения соберём маршрут заново. " : "Просмотр не меняет маршрут. "}По одному дню оставляем на вылет и возвращение.</small></div>
      {invalid && <p className="date-input-error" role="status">{!isCalendarDate(start) || start < today ? "Выберите будущую дату вылета." : "Укажите от 5 до 28 дней отпуска."}</p>}
    </div>}
    {different && <div className="date-preview-notice" role="status"><span>Сейчас смотрим другой период. Даты вашей поездки пока не менялись.</span><button type="button" onClick={() => { change(startDate, days); periodButton.current?.focus({ preventScroll: true }); }}><Undo2 />Вернуть даты поездки</button></div>}
    <div className="date-city-filter"><label>Где искать идеи<select value={city} onChange={event => setCity(event.target.value as CityId | "all")}><option value="all">По всему Китаю</option>{cityIds.map(id => <option key={id} value={id}>{cities[id].name}</option>)}</select></label><span>События, праздники и сезонные маршруты</span></div>
    <TravelMoments period={period} city={city === "all" ? undefined : city} title={city === "all" ? "На ваши даты" : `${cities[city].name} на ваши даты`} onExplore={onExplore} />
  </section>;
}
