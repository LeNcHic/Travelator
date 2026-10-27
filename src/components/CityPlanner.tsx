import { CityOfficialEvents } from "./OfficialEvents";
import { hasExactDates, tripDayOffset } from "../lib/trip-timing";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { placesFor } from "../lib/journey";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  Clock3,
  ChevronDown,
  MapPin,
  Pin,
  Plus,
  RotateCcw,
  Undo2,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { cities } from "../data/catalog";
import { attractionById, attractionsIn } from "../data/attractions";
import { addDays, clockTime, daysText, displayDate, duration, plural } from "../lib/format";
import {
  assignVisit,
  cityDays,
  cityDayCapacity,
  reorderVisit,
} from "../lib/city-planner";
import { schedule } from "../lib/planner";
import type { Attraction, CityId, RoutePlan, TripInput } from "../types";
import TravelMoments from "./TravelMoments";
import { momentsForPeriod, periodLabel } from "../lib/travel-calendar";
import { dayOverview } from "../lib/city-day-overview";
import VisitMoveDialog from "./VisitMoveDialog";

function PlacesMap({
  city,
  ids,
  assigned,
  selected,
  onSelect,
}: {
  city: CityId;
  ids: string[];
  assigned: string[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const places = attractionsIn(city);
  const lon = places.map((p) => p.point[0]),
    lat = places.map((p) => p.point[1]);
  const middleLat = (Math.min(...lat) + Math.max(...lat)) / 2;
  const cos = Math.cos((middleLat * Math.PI) / 180);
  const spanX = (Math.max(...lon) - Math.min(...lon)) * cos;
  const spanY = Math.max(...lat) - Math.min(...lat);
  const scale = Math.min(76 / spanX, 76 / spanY);
  const centreX = (Math.min(...lon) + Math.max(...lon)) / 2;
  const position = (p: Attraction) => [
    50 + (p.point[0] - centreX) * cos * scale,
    50 - (p.point[1] - middleLat) * scale,
  ];
  const path = ids
    .map((id) => position(attractionById(id)!).join(","))
    .join(" ");
  return (
    <div
      className="tv-city-map"
      role="group"
      aria-label={`Карта достопримечательностей: ${cities[city].name}`}
    >
      <span className="tv-map-north">С ↑</span>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {[20, 40, 60, 80].map((n) => (
          <path
            key={n}
            d={`M ${n} 0 V 100 M 0 ${n} H 100`}
            className="tv-city-gridline"
          />
        ))}
        <polyline points={path} className="tv-city-path" />
      </svg>
      {places.map((place) => {
        const [x, y] = position(place),
          order = ids.indexOf(place.id);
        return (
          <button
            key={place.id}
            type="button"
            className={`tv-attraction-pin ${order >= 0 ? "tv-today-pin" : ""}`}
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-pressed={selected === place.id}
            aria-label={`На карте: ${place.name}${order >= 0 ? `, посещение ${order + 1}` : ""}`}
            title={place.name}
            onClick={() => onSelect(place.id)}
          >
            {order >= 0 ? order + 1 : assigned.includes(place.id) ? "•" : "+"}
          </button>
        );
      })}
      <span className="tv-city-map-caption">
        {cities[city].en} · схема по координатам
      </span>
    </div>
  );
}

function VisitCard({ item, order, required, onMove, onEarlier, onLater, onMap, onRemove }: {
  item: Attraction; order: number; required: boolean; onMove: () => void;
  onEarlier?: () => void; onLater?: () => void; onMap: () => void; onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return <article className="cp-visit" aria-labelledby={`cp-place-${item.id}`}>
    <div className="cp-visit-heading"><span className="cp-visit-number">{order + 1}</span>
      <div><h4 id={`cp-place-${item.id}`} tabIndex={-1}>{item.name}</h4><p>{item.category}{required && <span><Pin />Обязательное место</span>}</p></div>
      <span className="cp-visit-time"><Clock3 />≈ {duration(item.minutes)}</span>
    </div>
    <div className="cp-visit-actions">
      <button className="cp-move-button" aria-label={`Перенести: ${item.name}`} onClick={onMove}><ArrowRightLeft />Перенести</button>
      <button className="cp-place-more" aria-expanded={expanded} aria-controls={`cp-info-${item.id}`} aria-label={`О месте: ${item.name}`} onClick={() => setExpanded(!expanded)}>О месте<ChevronDown /></button>
      {(onEarlier || onLater) && <div className="cp-order-buttons" role="group" aria-label={`Порядок: ${item.name}`}>
        <button aria-label={`Раньше: ${item.name}`} disabled={!onEarlier} onClick={onEarlier}><ArrowUp /></button>
        <button aria-label={`Позже: ${item.name}`} disabled={!onLater} onClick={onLater}><ArrowDown /></button>
      </div>}
    </div>
    {expanded && <div id={`cp-info-${item.id}`} className="cp-place-info"><p>{item.description}</p><div>
      <button onClick={onMap}><MapPin />Показать на карте</button>
      {!required && <button onClick={onRemove}>Убрать из дня</button>}
    </div></div>}
  </article>;
}

export default function CityPlanner({ input, plan, index, onCity, onChange, onBack }: {
  input: TripInput; plan: RoutePlan; index: number; onCity: (index: number) => void;
  onChange: (plan: RoutePlan, notice: string) => void; onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null), dayHeading = useRef<HTMLHeadingElement>(null);
  const dayNav = useRef<HTMLDivElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "start" });
  }, []);
  const city = plan.cities[index], places = attractionsIn(city), days = cityDays(plan, input, city);
  const [chosenDay, setChosenDay] = useState(0);
  const day = Math.min(chosenDay, days.length - 1), ids = days[day];
  useEffect(() => {
    const nav = dayNav.current;
    const active = nav?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!nav || !active) return;
    const viewport = nav.getBoundingClientRect(), tab = active.getBoundingClientRect();
    // Scroll only the strip so opening a day never shifts the whole page.
    if (tab.left < viewport.left) nav.scrollBy({ left: tab.left - viewport.left });
    else if (tab.right > viewport.right) nav.scrollBy({ left: tab.right - viewport.right });
  }, [day]);
  const [selected, setSelected] = useState(ids[0] ?? places[0].id);
  const [mapOpen, setMapOpen] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [destination, setDestination] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ days: string[][]; day: number } | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const row = schedule(plan, input)[index];
  const date = (local: number) => hasExactDates(input) ? displayDate(addDays(row.date, local)) : `день ${row.first + local + 1} поездки`;
  const dateIso = (local: number) => addDays(row.date, local);
  const assigned = days.flat(), unplanned = places.filter(place => !assigned.includes(place.id));
  const required = new Set<string>(placesFor(input, city).map(place => place.id));
  const place = attractionById(selected) ?? places[0], placeDay = days.findIndex(list => list.includes(place.id));
  const load = dayOverview(ids, cityDayCapacity(plan, input, index, day));
  const dayPeriod = { start: dateIso(day), end: dateIso(day) };
  const dayEvents = (hasExactDates(input) ? momentsForPeriod(dayPeriod, city) : []).filter(match => match.moment.kind !== "season");

  function focusDay() {
    requestAnimationFrame(() => {
      dayHeading.current?.focus({ preventScroll: true });
      dayHeading.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  function apply(next: RoutePlan | null, message: string, target: number | null = null) {
    if (!next) return;
    setUndo({ days: days.map(list => [...list]), day });
    setFeedback(message); setDestination(target);
    onChange(next, message);
  }
  function move(id: string, target: number | null) {
    const next = assignVisit(plan, input, city, id, target);
    if (!next) return;
    const projected = target === null ? null : dayOverview(cityDays(next, input, city)[target], cityDayCapacity(next, input, index, target));
    const message = target === null ? `«${attractionById(id)!.name}» теперь без дня.`
      : `«${attractionById(id)!.name}» — день ${target + 1}, ${date(target)} · всего ≈ ${duration(projected!.minutes)}${projected!.overloaded ? "; больше выбранного темпа" : ""}.`;
    apply(next, message, target);
    setMoving(null); focusDay();
  }
  function reorder(id: string, order: number, delta: -1 | 1) {
    apply(reorderVisit(plan, input, city, day, order, delta), "Порядок посещений изменён.");
    requestAnimationFrame(() => document.getElementById(`cp-place-${id}`)?.focus({ preventScroll: true }));
  }
  function showMap(id: string) {
    setSelected(id); setMapOpen(true);
    requestAnimationFrame(() => {
      const detail = document.getElementById(`cp-map-place-${city}`);
      detail?.focus({ preventScroll: true }); detail?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  function chooseDay(next: number) { setChosenDay(next); setSelected(days[next][0] ?? places[0].id); }
  function navigateDays(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? days.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + days.length) % days.length;
    chooseDay(next);
    document.getElementById(`cp-day-${city}-${next}`)?.focus();
  }

  return <section className="tv-city-planner city-day-planner" aria-label={`План посещений: ${cities[city].name}`}>
    <button className="cp-back" onClick={onBack}><ArrowLeft />К маршруту по городам</button>
    <header className="cp-heading"><p>ПЛАН ПО ДНЯМ</p><h2 ref={heading} tabIndex={-1}>{cities[city].name}</h2>
      <span>{hasExactDates(input) ? periodLabel({ start: row.date, end: row.endDate }) : "Даты уточним позже"} · {daysText(days.length)}</span>
    </header>
    {plan.cities.length > 1 && <div className="cp-cities" role="group" aria-label="Город для планирования">
      {plan.cities.map((id, i) => <button key={id} aria-pressed={i === index} onClick={() => onCity(i)}>{cities[id].name}</button>)}
    </div>}
    <div ref={dayNav} className="cp-day-nav" role="tablist" aria-label="Дни в городе">
      {days.map((list, i) => {
        const overview = dayOverview(list, cityDayCapacity(plan, input, index, i));
        return <button key={i} id={`cp-day-${city}-${i}`} role="tab" aria-selected={i === day} tabIndex={i === day ? 0 : -1}
          aria-controls={`cp-agenda-${city}`} aria-label={`День ${i + 1}, ${date(i)}, ${list.length ? `примерно ${duration(overview.minutes)}` : "без посещений"}${i === 0 && row.arrival ? ", день приезда" : ""}${overview.overloaded ? ", насыщенный" : ""}`}
          onClick={() => chooseDay(i)} onKeyDown={event => navigateDays(event, i)}>
          <strong>День {i + 1}<span>{date(i)}</span></strong><small>{i === 0 && row.arrival ? list.length ? "Приезд · " : "День приезда" : ""}{list.length ? `≈ ${duration(overview.minutes)}` : i === 0 && row.arrival ? "" : "Свободно"}{overview.overloaded && " · насыщенно"}</small>
        </button>;
      })}
    </div>
    <div className="cp-feedback" role="status" aria-live="polite">{feedback && <><span>{feedback}</span><div>
      {destination !== null && destination !== day && <button onClick={() => { chooseDay(destination); focusDay(); }}>Открыть день {destination + 1}<ArrowRight /></button>}
      {undo && <button onClick={() => {
        const next = { ...plan, visits: { ...plan.visits, [city]: undo.days } };
        setChosenDay(undo.day); setUndo(null); setDestination(null); setFeedback("Изменение отменено.");
        onChange(next, "Изменение плана дня отменено."); focusDay();
      }}><Undo2 />Отменить</button>}
    </div></>}</div>

    <div id={`cp-agenda-${city}`} role="tabpanel" aria-labelledby={`cp-day-${city}-${day}`} className="cp-agenda">
      <div className="cp-day-heading"><div><p>День {row.first + day + 1 + tripDayOffset(input)} поездки</p><h3 ref={dayHeading} tabIndex={-1}>День {day + 1}{hasExactDates(input) && ` · ${date(day)}`}</h3></div>
        <div className="cp-total"><strong>{ids.length ? `≈ ${duration(load.minutes)}` : day === 0 && row.arrival ? "День приезда" : "Свободный день"}</strong><span>{ids.length ? `${ids.length} ${plural(ids.length, ["место", "места", "мест"])} в плане` : "Посещений пока нет"}</span></div>
      </div>
      {ids.length > 0 && <p className="cp-time-breakdown">{duration(load.visits)} на посещения{load.transfers > 0 && ` + ${duration(load.transfers)} условно между местами`}</p>}
      {day === 0 && row.arrival && <p className="cp-arrival"><Clock3 /><span><strong>День приезда.</strong> {row.arrival.estimated ? "Ориентировочно в " : "Приезд в "}{clockTime(row.arrival.at)} из {cities[row.arrival.from].name}. {load.capacity ? `На прогулки — до ${duration(load.capacity)} после дороги и заселения.` : "Оставляем время на заселение и отдых."}</span></p>}
      {load.overloaded && <p className="cp-overloaded"><Info /><span>Насыщенный день: ≈ {duration(load.minutes)}{load.capacity ? ` при вашем темпе до ${duration(load.capacity)}` : "; свободного времени после переезда почти нет"}. Часть мест можно перенести.</span></p>}
      {!load.overloaded && ids.length > 0 && <p className="cp-pace-note">Укладывается в ваш темп · ориентир до {duration(load.capacity)} в день</p>}
      {ids.length === 0 ? <div className="cp-empty"><CalendarDays /><h4>{day === 0 && row.arrival ? "Время после дороги" : "День без спешки"}</h4>
        <p>Можно оставить для отдыха{unplanned.length > 0 ? " или добавить место из списка ниже." : ". Для переноса сюда откройте нужное место в другом дне."}</p>
      </div> : <ol className="cp-visits" aria-label="Посещения по порядку">
        {ids.map((id, order) => <li key={id}><VisitCard item={attractionById(id)!} order={order} required={required.has(id)}
          onMove={() => setMoving(id)} onEarlier={order > 0 ? () => reorder(id, order, -1) : undefined}
          onLater={order < ids.length - 1 ? () => reorder(id, order, 1) : undefined}
          onMap={() => showMap(id)} onRemove={() => move(id, null)} /></li>)}
      </ol>}
      <p className="cp-estimate">Время приблизительное. Часы работы и реальные дороги пока не проверяются.</p>
    </div>

    {unplanned.length > 0 && <details className="cp-catalogue" open={catalogueOpen} onToggle={event => setCatalogueOpen(event.currentTarget.open)}>
      <summary><Plus /><span>Добавить место в день {day + 1}<small>{unplanned.length} {plural(unplanned.length, ["место", "места", "мест"])} пока без дня</small></span><ChevronDown /></summary>
      <div className="cp-catalogue-list">{unplanned.map(item => <article key={item.id} className="cp-catalogue-place"><div><h4>{item.name}</h4><span>{item.category} · ≈ {duration(item.minutes)}</span><p>{item.description}</p></div>
        <button aria-label={`Добавить в день ${day + 1}: ${item.name}`} onClick={() => move(item.id, day)}><Plus />Добавить</button>
      </article>)}</div>
    </details>}

    <details className="cp-map-details" open={mapOpen} onToggle={event => setMapOpen(event.currentTarget.open)}>
      <summary><MapPin /><span>Места на карте</span><ChevronDown /></summary>
      {mapOpen && <div className="cp-map-content"><div><PlacesMap city={city} ids={ids} assigned={assigned} selected={selected} onSelect={setSelected} />
        <p className="cp-map-legend">Цифры — этот день · точка — другие дни · плюс — без дня</p>
        <p className="cp-estimate">Линии показывают порядок посещений. Маршрут по улицам может отличаться.</p></div>
        <div className="cp-map-place"><h4 id={`cp-map-place-${city}`} tabIndex={-1}>{place.name}</h4><p>{place.description}</p><span>≈ {duration(place.minutes)} · {placeDay < 0 ? "Без дня" : `День ${placeDay + 1}, ${date(placeDay)}`}</span>
          {placeDay === day ? <button onClick={() => setMoving(place.id)}><ArrowRightLeft />Перенести в другой день</button>
            : placeDay >= 0 ? <><button onClick={() => { chooseDay(placeDay); focusDay(); }}>Открыть день {placeDay + 1}<ArrowRight /></button><button onClick={() => setMoving(place.id)}>Перенести</button></>
              : <button onClick={() => move(place.id, day)}><Plus />Добавить в день {day + 1}</button>}
        </div></div>}
    </details>
    {hasExactDates(input) && <CityOfficialEvents city={city} start={dateIso(day)} end={dateIso(day)} />}
    {dayEvents.length > 0 && <details className="cp-events" key={dateIso(day)}><summary><CalendarDays /><span>События и праздники · {dayEvents.length}</span><ChevronDown /></summary>
      <TravelMoments period={dayPeriod} city={city} title={`Календарь на ${date(day)}`} datedOnly hideHeading compact />
      <p className="cp-estimate">События не добавляются в посещения автоматически.</p>
    </details>}
    <details className="cp-settings"><summary><SlidersHorizontal /><span>Настройки и расчёт времени</span><ChevronDown /></summary>
      <p>Время посещений рассчитано ориентировочно. Между посещениями заложено по 30 минут. Часы работы, билеты и фактический транспорт пока не учитываются; экскурсии не включены в стоимость поездки.</p>
      <p>Можно заново распределить места по дням с учётом темпа поездки. Ручной план этого города изменится; действие можно отменить.</p>
      <button onClick={() => {
        const visits = { ...plan.visits }; delete visits[city];
        apply({ ...plan, visits: { ...plan.visits, [city]: cityDays({ ...plan, visits }, input, city) } }, "Места распределены заново. Предыдущий план можно вернуть.");
        focusDay();
      }}><RotateCcw />Распределить заново</button>
    </details>
    {moving && <VisitMoveDialog plan={plan} input={input} index={index} id={moving} onChoose={target => move(moving, target)} onClose={() => setMoving(null)} />}
  </section>;
}
