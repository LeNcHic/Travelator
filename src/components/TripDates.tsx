import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, daysText } from "../lib/format";
import { dateRangeDays, editableDate, parseEditableDate, monthCells, moscowToday, rangeError, shiftMonth, shiftCalendarDate } from "../lib/date-range";
import { periodLabel } from "../lib/travel-calendar";
import Modal from "./Modal";

export default function TripDates({ startDate, days, exact, onApply, onClear, onClose }: {
  startDate: string; days: number; exact: boolean; onApply: (start: string, days: number) => void; onClear: () => void; onClose: () => void;
}) {
  const today = moscowToday();
  const [start, setStart] = useState(exact ? startDate : ""), [end, setEnd] = useState(exact ? addDays(startDate, days - 1) : "");
  const [startText, setStartText] = useState(editableDate(start)), [endText, setEndText] = useState(editableDate(end));
  const [month, setMonth] = useState((startDate >= today ? startDate : today).slice(0, 7) + "-01");
  const [focused, setFocused] = useState(start || today), [months, setMonths] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 600px)").matches ? 1 : 2);
  const error = rangeError(start, end, today), count = dateRangeDays(start, end);
  const calendarMonths = useMemo(() => {
    const dayLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
    return Array.from({ length: months }, (_, i) => shiftMonth(month, i)).map(current => {
      const cells = monthCells(current);
      return { current, label: monthLabel.format(new Date(`${current}T12:00:00Z`)), firstAvailable: cells.find(value => value && value >= today),
        cells: cells.map(value => value ? { value, label: dayLabel.format(new Date(`${value}T12:00:00Z`)) } : null) };
    });
  }, [month, months, today]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const update = () => setMonths(media.matches ? 1 : 2);
    update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update);
  }, []);
  function choose(value: string) {
    setFocused(value);
    if (!start || end || value < start) { setStart(value); setStartText(editableDate(value)); setEnd(""); setEndText(""); }
    else { setEnd(value); setEndText(editableDate(value)); }
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, value: string) {
    let next: string;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) next = addDays(value, ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 })[event.key]!);
    else if (event.key === "Home" || event.key === "End") {
      const weekday = (new Date(`${value}T12:00:00Z`).getUTCDay() + 6) % 7;
      next = addDays(value, event.key === "Home" ? -weekday : 6 - weekday);
    } else if (event.key === "PageUp" || event.key === "PageDown") next = shiftCalendarDate(value, event.key === "PageUp" ? -1 : 1);
    else return;
    event.preventDefault(); if (next < today) next = today;
    setFocused(next);
    if (next < month || next >= shiftMonth(month, months)) setMonth(next.slice(0, 7) + "-01");
    requestAnimationFrame(() => document.getElementById(`trip-date-${next}`)?.focus());
  }
  return <Modal title="Когда поедем?" eyebrow="ДАТЫ ПОЕЗДКИ" onClose={onClose} className="simple-dates-dialog">
    <div className="simple-range-inputs"><label>Начало<input type="text" inputMode="numeric" placeholder="ДД.ММ.ГГГГ" value={startText} onChange={event => { setStartText(event.target.value); const date = parseEditableDate(event.target.value); setStart(date); if (date) { setFocused(date); setMonth(date.slice(0,7) + "-01"); } }} /></label><span>—</span><label>Конец<input type="text" inputMode="numeric" placeholder="ДД.ММ.ГГГГ" value={endText} onChange={event => { setEndText(event.target.value); setEnd(parseEditableDate(event.target.value)); }} /></label></div>
    <div className="simple-calendar-nav"><button aria-label="Предыдущий месяц" disabled={month <= today.slice(0, 7) + "-01"} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></button><span>{!start || end ? "Выберите начало поездки" : "Теперь выберите последний день"}</span><button aria-label="Следующий месяц" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></button></div>
    <div className="simple-calendars">{calendarMonths.map(({ current, label, cells, firstAvailable }) => <div className="simple-calendar-month" key={current}>
      <h3>{label}</h3>
      <div className="simple-weekdays" aria-hidden="true">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => <span key={day}>{day}</span>)}</div>
      <div className="simple-date-grid" role="group" aria-label={`Календарь ${current.slice(0, 7)}`}>{cells.map((cell, index) => cell ? <button key={cell.value} id={`trip-date-${cell.value}`} type="button" disabled={cell.value < today} tabIndex={cell.value === focused || focused.slice(0, 7) !== current.slice(0, 7) && cell.value === firstAvailable ? 0 : -1}
        aria-label={cell.label} aria-pressed={cell.value === start || cell.value === end} aria-current={cell.value === today ? "date" : undefined}
        className={`${cell.value === start || cell.value === end ? "is-endpoint" : ""} ${start && end && cell.value > start && cell.value < end ? "in-range" : ""}`}
        onClick={() => choose(cell.value)} onKeyDown={event => navigate(event, cell.value)}>{Number(cell.value.slice(8))}</button> : <span key={`empty-${index}`} />)}</div>
    </div>)}</div>
    <div className="simple-range-result" role="status">{start && end && !error ? <><strong>{periodLabel({ start, end })}</strong><span>{daysText(count!)}</span></> : <span>{startText && endText ? error : "Выберите период от 5 до 28 дней."}</span>}</div>
    <div className="simple-date-actions"><button type="button" onClick={onClear}>Пока без дат</button><button className="tv-button tv-primary" disabled={Boolean(error)} onClick={() => onApply(start, count!)}>Применить даты</button></div>
  </Modal>;
}
