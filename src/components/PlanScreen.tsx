import { baseCatalog, countries } from "../data/destination-catalog";
import { CityOfficialEvents } from "./OfficialEvents";
import { RecommendationRefresh, WeatherStay } from "./Weather";
import { hasExactDates, internationalDays, isAutomaticTrip, tripDayOffset } from "../lib/trip-timing";
import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BedDouble, Bookmark, CalendarDays, Check,
  ChevronDown, Clock3, Info, MapPinned, Minus, Pin, Plane, Plus,
  RefreshCw, TrainFront, Wallet,
} from "lucide-react";
import { cities } from "../data/catalog";
import { addDays, daysText, duration, money, nightsText, plural } from "../lib/format";
import { minimumDays, moveDay, replaceCity, schedule, totals, hotelStays } from "../lib/planner";
import type { CityId, RoutePlan, TripInput } from "../types";
import { ExperienceTags } from "./JourneyParts";
import { placesFor } from "../lib/journey";
import CityPlanner from "./CityPlanner";
import { destinationImages } from "../data/discovery";
import { chinaKnowledge, coastalSeasonNote } from "../data/china-knowledge";
import TravelMoments from "./TravelMoments";
import { periodLabel } from "../lib/travel-calendar";
import { planTransfer } from "../lib/plan-transfer";
import { stopReason } from "../lib/route-reasons";
import RouteMap from "./RouteMap";
import HotelSource from "./HotelSource";

export default function PlanScreen({ input, plan, saved, onBack, onSave, onChange, onHotel, onTicket, notice }: {
  input: TripInput;
  plan: RoutePlan;
  saved: boolean;
  onBack: () => void;
  onSave: () => void;
  onChange: (plan: RoutePlan, notice: string) => void;
  onHotel: (index: number) => void;
  onTicket: (index: number) => void;
  notice: string;
}) {
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<"overview" | "days">("overview");
  const [mapOpen, setMapOpen] = useState(false);
  const [openStops, setOpenStops] = useState<CityId[]>([]);
  const selectedIndex = Math.min(selected, plan.cities.length - 1);
  const rows = useMemo(() => schedule(plan, input), [plan, input]);
  const stays = useMemo(() => hotelStays(plan, input), [plan, input]);
  const t = useMemo(() => totals(plan, input), [plan, input]);
  const reasons = useMemo(() => new Map(isAutomaticTrip(input) ? openStops.filter(city => plan.cities.includes(city)).map(city => [city, stopReason(plan, input, city)] as const) : []), [plan, input, openStops]);
  const hasCheckedData = t.liveHotels > 0 || t.liveTrains > 0 || t.liveFlights > 0;
  const dayOffset = tripDayOffset(input), exact = hasExactDates(input);

  function openStop(index: number) {
    setSelected(index);
    setOpenStops(previous => previous.includes(plan.cities[index]) ? previous : [...previous, plan.cities[index]]);
    requestAnimationFrame(() => {
      const summary = document.getElementById(`tp-stop-${plan.cities[index]}`)?.querySelector("summary");
      summary?.focus({ preventScroll: true });
      summary?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function editDays(index: number, delta: number) {
    const next = moveDay(plan, input, index, delta);
    if (!next) return;
    const other = next.days.findIndex((n, i) => n !== plan.days[i] && i !== index);
    onChange(next, delta > 0
      ? `Добавили день в ${cities[plan.cities[index]].name}, сократив остановку «${cities[plan.cities[other]].name}». Общая длительность — ${daysText(input.days)}.`
      : `Перенесли день из остановки «${cities[plan.cities[index]].name}» в ${cities[plan.cities[other]].name}.`);
  }

  const flight = (returning = false) => {
    if (!internationalDays(input)) return null;
    const date = returning ? addDays(input.startDate, input.days - 1) : input.startDate;
    return <div className="tp-flight">
      <Plane aria-hidden="true" />
      <div><strong>{returning ? `${cities[plan.cities.at(-1)!].name} → Москва` : `Москва → ${cities[plan.cities[0]].name}`}</strong>
        <span>{periodLabel({ start: date, end: date })} · день {returning ? input.days : 1}</span></div>
      <small>Перелёт ещё не подобран</small>
    </div>;
  };

  return <section className="tv-screen trip-plan" aria-label="Подробный план поездки">
    <button className="tp-back" onClick={onBack}><ArrowLeft />К маршрутам</button>
    <header className="tp-heading">
      <div><p className="tp-kicker">ВАША ПОЕЗДКА</p><h1>Ваш маршрут · {countries[input.country ?? "CN"]?.name ?? "Путешествие"}</h1>
        <p className="tp-dates">{internationalDays(input) > 0 && "Из Москвы · "}{exact ? periodLabel({ start: input.startDate, end: addDays(input.startDate, input.days - 1) }) : "Даты уточним позже"}</p>
      </div>
      <button className="tv-button tv-primary" onClick={onSave}>{saved ? <Check /> : <Bookmark />}{saved ? "План сохранён" : "Сохранить поездку"}</button>
    </header>

    <div className="tp-facts" aria-label="Сводка поездки">
      <div><CalendarDays /><span><strong>{daysText(input.days)}</strong><small>{isAutomaticTrip(input) ? "на отдых и посещения" : input.journey ? "вместе с дорогой" : "в путешествии"}</small></span></div>
      <div><MapPinned /><span><strong>{plan.cities.length} {plural(plan.cities.length, ["город", "города", "городов"])}</strong><small>остановки с ночёвкой</small></span></div>
      <div><Clock3 /><span><strong>{t.minutes ? duration(t.minutes) : "Без переездов"}</strong><small>между городами Китая</small></span></div>
      <div><Wallet /><span><strong>≈ {money(t.total)}</strong><small>жильё и переезды · 1 человек</small></span></div>
    </div>
    <RecommendationRefresh exact={exact} />
    {t.outdatedHotels > 0 && <p className="tp-alert" role="status"><Info />Даты проживания изменились у {t.outdatedHotels} остановок. Выберите гостиницы заново: стоимость пока ориентировочная.</p>}
    {t.outdatedFlights > 0 && <p className="tp-alert" role="status"><Info />Даты авиабилетов изменились. Прежние тарифы сняты; выберите рейсы заново.</p>}
    {t.outdatedTrains > 0 && <p className="tp-alert" role="status"><Info />Даты {t.outdatedTrains} переездов изменились. Обновите билеты: прежние расписания сняты, стоимость пока ориентировочная.</p>}
    {t.total > input.budget && <p className="tp-alert" role="status"><Wallet />Выше бюджета на {money(t.total - input.budget)}. Можно выбрать другую гостиницу или билет.</p>}
    {view === "overview" && <div className="tp-notice" role="status" aria-live="polite">{notice}</div>}

    {view === "days" ? <div className="tp-day-planner">
      <CityPlanner key={plan.cities[selectedIndex]} input={input} plan={plan} index={selectedIndex} onCity={setSelected}
        onChange={onChange} onBack={() => { setView("overview"); openStop(selectedIndex); }} />
    </div> : <div className="tp-overview">
      <details className="tp-map-details" open={mapOpen} onToggle={event => setMapOpen(event.currentTarget.open)}>
        <summary><MapPinned /><span>Маршрут на карте</span><ChevronDown /></summary>
        {mapOpen && <div className="tp-map-card">
          <RouteMap ids={plan.cities} plan={plan} modes={rows.slice(0, -1).map(row => row.ticket!.mode)} selected={selectedIndex} onSelect={openStop} />
          <div className="tp-map-foot"><span>Выберите город, чтобы открыть его детали</span><a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">© Natural Earth</a></div>
        </div>}
      </details>

      <div className="tp-section-title"><h2>Города и переезды</h2><span>В порядке посещения</span></div>
      <div className="tp-timeline" aria-label="Последовательность поездки">
        {flight()}
        <ol className="tp-stops">{rows.map((row, index) => {
          const city = cities[row.city], hotel = stays[index], requiredPlaces = placesFor(input, row.city);
          const required = input.required.includes(row.city) || requiredPlaces.length > 0
            || (!input.journey && (index === 0 || index === rows.length - 1));
          const replacement = row.city === "zjj" ? "gui" : row.city === "gui" ? "zjj" : null;
          const transfer = planTransfer(row, input);
          const period = { start: row.date, end: row.endDate };
          return <li key={row.city}>
            <article className="tp-stop" aria-labelledby={`tp-city-${row.city}`}>
              <div className="tp-stop-main">
                <span className="tp-stop-number" aria-label={`Остановка ${index + 1}`}>{index + 1}</span>
                <img src={destinationImages[row.city]} alt="" loading="lazy" />
                <div className="tp-stop-heading"><h3 id={`tp-city-${row.city}`}>{city.name}</h3>
                  <p>{exact ? periodLabel(period) : "Даты уточним позже"}</p><small>{city.kind}{required && <Pin aria-label="Обязательная остановка" />}</small></div>
                <div className="tp-stop-duration"><strong>{daysText(plan.days[index])}</strong><small>{row.first === row.last ? `День ${row.first + 1 + dayOffset}` : `Дни ${row.first + 1 + dayOffset}–${row.last + 1 + dayOffset}`}</small></div>
              </div>
              {row.nights > 0 && <div className="tp-hotel-source"><span>Проживание</span><HotelSource source={hotel.outdated ? "outdated" : hotel.quote ? "flyai" : "demo"} checkedAt={hotel.quote?.searchedAt} /></div>}
              {row.arrival && <p className="tp-partial-day"><Clock3 />{row.arrival.availableMinutes > 0 ? "Первый день — переезд и свободное время после приезда" : "Первый день — переезд, заселение и отдых"}</p>}
              <details id={`tp-stop-${row.city}`} className="tp-stop-details" open={openStops.includes(row.city)} onToggle={event => {
                const open = event.currentTarget.open;
                setOpenStops(previous => previous.includes(row.city) === open ? previous : open ? [...previous, row.city] : previous.filter(id => id !== row.city));
              }}>
                <summary aria-label={`Что посмотреть и где жить: ${city.name}`}><span>Что посмотреть и где жить</span><ChevronDown /></summary>
                <div className="tp-stop-details-body">
                  <p className="tp-description">{city.description}</p>
                  {reasons.has(row.city) && <div className="tp-stop-reason"><strong>Почему {city.name} · {daysText(plan.days[index])}</strong><p>{reasons.get(row.city)!.why}</p><p>{reasons.get(row.city)!.daysReason}</p><p>{reasons.get(row.city)!.load}</p>{reasons.get(row.city)!.caveat && <p>{reasons.get(row.city)!.caveat}</p>}</div>}
                  {exact && <CityOfficialEvents city={row.city} start={row.date} end={row.endDate} />}
                  {exact && <WeatherStay city={row.city} start={row.date} end={row.endDate} />}
                  <ExperienceTags plan={plan} input={input} city={row.city} />
                  {requiredPlaces.length > 0 && <p className="tp-required"><Pin />Обязательно: {requiredPlaces.map(place => place.name).join(" · ")}</p>}
                  <button className="tp-plan-city" aria-label={`Спланировать дни: ${city.name}`} onClick={() => { setSelected(index); setView("days"); }}><CalendarDays />Что посмотреть по дням<ArrowRight /></button>
                  {!input.journey && <div className="tp-edit-days"><span>Время в городе</span><span>
                    <button aria-label={`Уменьшить время: ${city.name}`} disabled={plan.days[index] <= minimumDays(row.city, input)} onClick={() => editDays(index, -1)}><Minus /></button>
                    <strong>{daysText(plan.days[index])}</strong>
                    <button aria-label={`Добавить день: ${city.name}`} disabled={!moveDay(plan, input, index, 1)} onClick={() => editDays(index, 1)}><Plus /></button>
                  </span></div>}
                  {row.nights > 0 ? <button className="tp-offer" onClick={() => onHotel(index)} aria-label={`Выбрать гостиницу: ${city.name}`}>
                    <span className="tp-offer-icon"><BedDouble /></span><span className="tp-offer-copy"><small>ПРОЖИВАНИЕ · {nightsText(row.nights)}</small><strong>{hotel.name}</strong>
                      <span>{exact ? periodLabel({ start: hotel.checkIn, end: hotel.checkOut }) : "Даты уточним позже"} · {money(hotel.nightly)} / ночь</span>
                      <HotelSource source={hotel.outdated ? "outdated" : hotel.quote ? "flyai" : "demo"} checkedAt={hotel.quote?.searchedAt} />
                      {hotel.quote && <em>Предложение из поиска Fliggy · наличие и итоговая цена уточняются</em>}
                      {hotel.quote?.distanceKm !== undefined && <em>{hotel.quote.distanceKm.toLocaleString("ru-RU")} км от центра по прямой</em>}
                      </span><ArrowRight />
                  </button> : <p className="tp-description">В этой остановке ночёвка не нужна.</p>}
                  {!input.journey && !required && replacement && !plan.cities.includes(replacement) && <button className="tp-replace" onClick={() => {
                    const next = replaceCity(plan, input, index, replacement);
                    if (next) onChange(next, `Природная остановка заменена на ${cities[replacement].name}. Билеты для соседних переездов обновлены.`);
                  }} disabled={!replaceCity(plan, input, index, replacement)}><RefreshCw />Заменить на {cities[replacement].name}</button>}
                  <details className="tp-local-tips">
                    <summary>Сезон, события и полезное <ChevronDown /></summary>
                    {exact && coastalSeasonNote(row.city, row.date) && <p>{coastalSeasonNote(row.city, row.date)}</p>}
                    <p>{chinaKnowledge[row.city].season}</p><p>{chinaKnowledge[row.city].practical}</p>
                    {exact && <TravelMoments period={period} city={row.city} title={`${city.name}: в дни остановки`} compact />}
                    <ul>{chinaKnowledge[row.city].sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>
                    <p>{baseCatalog[row.city].region} · {baseCatalog[row.city].timezone}. База с ночёвкой; загородные места — отдельные выезды. Рекомендуемая остановка: {baseCatalog[row.city].stay.min}–{baseCatalog[row.city].stay.max} дн. {baseCatalog[row.city].stay.reason}</p><small>Справка обновлена {baseCatalog[row.city].reviewedAt}. {baseCatalog[row.city].referenceScope} {baseCatalog[row.city].estimates.join(", ")} — ориентировочные оценки.</small>
                  </details>
                </div>
              </details>
            </article>
            {row.ticket && transfer && <section className="tp-transfer" aria-label={`Переезд: ${city.name} — ${cities[row.ticket.to].name}`}>
              <div className="tp-transfer-main">
                <span className="tp-transfer-icon">{row.ticket.mode === "air" ? <Plane /> : <TrainFront />}</span>
                <div><h3>{city.name} <ArrowRight aria-hidden="true" /> {cities[row.ticket.to].name}</h3>
                  <p>{row.ticket.mode === "air" ? "Самолёт" : "Поезд"} · {transfer.estimatedSchedule && "≈ "}{duration(transfer.rideMinutes)} {row.ticket.mode === "air" ? "в полёте" : "в пути"}</p>
                  <small>{exact ? periodLabel(transfer) : `После дня ${row.last + 1}`} · {transfer.source}</small>
                </div>
              </div>
              <details className="tp-ticket-details">
                <summary aria-label={`Билет и расписание: ${city.name} — ${cities[row.ticket.to].name}`}><span>Билет и расписание</span><ChevronDown /></summary>
                <div className="tp-ticket-body">
                  <p>{transfer.estimatedSchedule ? "Примерное расписание" : `${row.flightQuote?.flightNumber ?? row.trainQuote!.trainNumber} · время Китая`}: {transfer.departure} → {transfer.arrival}{exact && transfer.end !== transfer.start && ` · прибытие ${periodLabel({ start: transfer.end, end: transfer.end })}`}</p>
                  <p>{row.ticket.detail}. На весь переезд {transfer.estimatedSchedule && "≈ "}{duration(transfer.totalMinutes)}, включая {duration(row.ticket.overhead)} {row.ticket.mode === "air" ? "на аэропорты" : "на вокзалы"}.</p>
                  {(row.trainQuote || row.flightQuote) && <p>Проверено {new Date((row.flightQuote ?? row.trainQuote)!.searchedAt).toLocaleString("ru-RU")}. Наличие мест {transfer.estimatedPrice ? "и тариф требуют проверки" : "и итоговая сумма требуют проверки"}.</p>}
                  {row.flightQuote && <p>Тариф на одного пассажира. Багаж, сборы, возврат и окончательная сумма уточняются на Fliggy.</p>}
                  {row.outdatedFlight && <p className="tp-outdated">Даты изменились · обновите авиабилеты</p>}
                  {row.outdatedTrain && <p className="tp-outdated">Даты изменились · обновите расписание</p>}
                  <button className="tp-ticket-action" onClick={() => onTicket(index)} aria-label={`Выбрать билет: ${city.name} — ${cities[row.ticket.to].name}`}>
                    <span>{row.trainQuote || row.flightQuote ? "Посмотреть другие билеты" : "Посмотреть варианты билетов"}<small>{transfer.estimatedPrice ? "Оценка" : "Поисковая цена"}: {money(row.ticket.price)} / человек</small></span><ArrowRight />
                  </button>
                </div>
              </details>
            </section>}
          </li>;
        })}</ol>
        {flight(true)}
      </div>

      <details className="tp-budget">
        <summary><Wallet /><span>Стоимость и источники данных</span><strong>≈ {money(t.total)}</strong><ChevronDown /></summary>
        <div className="tp-budget-body">
          <dl><div><dt>Проживание · {nightsText(t.nights)}</dt><dd>{money(t.lodging)}</dd></div><div><dt>Переезды внутри Китая</dt><dd>{t.estimatedTickets > 0 ? "≈ " : ""}{money(t.transit)}</dd></div><div><dt>{t.total <= input.budget ? "Остаток вашего бюджета" : "Сверх вашего бюджета"}</dt><dd>{money(Math.abs(input.budget - t.total))}</dd></div></dl>
          <div className="tp-data-body">
            <p><strong>{hasCheckedData ? "Проверено частично" : "Предварительная оценка"}.</strong> Стоимость рассчитана для одного путешественника внутри Китая: гостиницы и междугородние переезды. Питание, экскурсии и международные перелёты не включены.</p>
            {t.liveFlights > 0 && <p>Авиабилеты FlyAI: {t.liveFlights} прямых рейсов с датированным расписанием и тарифом на одного пассажира. Сборы и условия перевозки требуют уточнения.</p>}
            {t.liveHotels > 0 && <p>Гостиницы Fliggy через FlyAI: {t.liveHotels} из {stays.length}. Поисковая цена за ночь умножена на число ночей. Состав номера, гостей и сборы нужно уточнить перед бронированием.</p>}
            {t.railgoTrains > 0 && <p>RailGo: расписание {t.railgoTrains} {plural(t.railgoTrains, ["поезда", "поездов", "поездов"])} на даты поездки. Тарифы и наличие мест неизвестны; цены билетов оценочные. Время указано по Китаю, с запасом 60 минут на вокзалы.</p>}
            {t.liveTrains > t.railgoTrains && <p>FlyAI: {t.liveTrains - t.railgoTrains} {plural(t.liveTrains - t.railgoTrains, ["расписание", "расписания", "расписаний"])} с поисковой ценой на одного пассажира. Наличие мест и итоговая сумма требуют проверки.</p>}
            {(t.demoHotels > 0 || t.demoTickets > 0) && <p>Часть стоимости рассчитана ориентировочно. Уточнить гостиницы и билеты можно в деталях города или переезда.</p>}
            {internationalDays(input) > 0 && <p>На вылет из Москвы и возвращение предусмотрено по одному дню. Международные билеты ещё не подобраны. Внутренние перелёты используют поисковый тариф, если рейс выбран; остальные отмечены как оценка.</p>}
            {isAutomaticTrip(input) && <p>Дорогу не вычитаем из срока. Время переездов показано справочно; международные перелёты не подбираем.</p>}
            <p>Поисковые цены и расписания могут измениться; это план поездки, а не подтверждение бронирования.</p>
          </div>
        </div>
      </details>
    </div>}
  </section>;
}
