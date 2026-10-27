import { countries, baseCatalog, publishedBaseIds } from "../data/destination-catalog";
import { useState } from "react";
import { ArrowRight, Building2, CalendarDays, Check, ChevronDown, Leaf, MapPin, Plus, Umbrella, X } from "lucide-react";
import { cities, cityIds } from "../data/catalog";
import { addDays, daysText } from "../lib/format";
import { mandatoryCities, requiredPlaces } from "../lib/journey";
import { automaticPreferences, toggleAutomaticPlace } from "../lib/automatic-preferences";
import { hasExactDates } from "../lib/trip-timing";
import { moscowToday } from "../lib/date-range";
import { periodLabel } from "../lib/travel-calendar";
import type { Interest, TripInput } from "../types";
import type { RouteRecovery } from "../lib/route-recovery";
import RouteRecoveryOptions from "./RouteRecoveryOptions";
import TripDates from "./TripDates";

const interests = [
  { id: "city", label: "Города и достопримечательности", icon: Building2 },
  { id: "nature", label: "Природа и прогулки", icon: Leaf },
  { id: "sea", label: "Море и пляжи", icon: Umbrella },
] as const;
const paces = [{ id: "slow", label: "Спокойный", hint: "Больше времени на месте" }, { id: "balanced", label: "Умеренный", hint: "Впечатления и отдых" }, { id: "active", label: "Насыщенный", hint: "Больше разных мест" }] as const;

export default function CreateScreen({ input, onChange, errors, onSubmit, onRecover, home = false, onContinue }: {
  input: TripInput; onChange: (input: TripInput) => void; errors: string[]; onSubmit: (input: TripInput) => void;
  routeSource: "demo" | "flyai"; onRouteSource: (source: "demo" | "flyai") => void;
  onRecover?: (change: RouteRecovery) => void; home?: boolean; onContinue?: () => void;
}) {
  const trip = automaticPreferences(input), chosen = mandatoryCities(trip);
  const selectedPlaces = trip.required.length + trip.journey!.requiredPlaces.length;
  const [query, setQuery] = useState(""), [showDates, setShowDates] = useState(false);
  const [customDays, setCustomDays] = useState(![7, 10, 14, 21].includes(trip.days));
  const exact = hasExactDates(trip);
  const invalid = !Number.isInteger(trip.days) || trip.days < 5 || trip.days > 28 || !trip.interests.length;
  const choices = [
    ...cityIds.filter(id => baseCatalog[id].status === "published" && baseCatalog[id].country === (trip.country ?? "CN") && !trip.required.includes(id)).map(id => ({ id, name: cities[id].name, city: id, place: false })),
    ...requiredPlaces.filter(place => baseCatalog[place.city].status === "published" && baseCatalog[place.city].country === (trip.country ?? "CN") && !trip.journey!.requiredPlaces.includes(place.id)).map(place => ({ ...place, place: true })),
  ].filter(item => query.trim().toLocaleLowerCase("ru").split(/\s+/).every(token => `${item.name} ${cities[item.city].name} ${cities[item.city].cn} ${cities[item.city].en}`.toLocaleLowerCase("ru").includes(token))).slice(0, query ? 30 : 6);
  function choosePlace(item: typeof choices[number]) {
    if (!chosen.includes(item.city) && chosen.length >= 5) return;
    onChange(toggleAutomaticPlace(trip, item.id, item.city, item.place)); setQuery("");
  }
  function duration(days: number) { onChange(automaticPreferences(trip, { days })); }
  function toggleInterest(kind: Interest) { onChange(automaticPreferences(trip, { interests: trip.interests.includes(kind) ? trip.interests.filter(id => id !== kind) : [...trip.interests, kind] })); }
  return <section className={`simple-trip-form ${home ? "simple-home" : ""}`} aria-label={home ? "Подбор путешествия" : "Создание поездки"}>
    <header className="simple-trip-heading"><p className="simple-eyebrow">ВАШИ ПОЖЕЛАНИЯ — ГОТОВЫЙ МАРШРУТ</p><h1>{home ? "Спланируйте путешествие под себя" : "Что учесть в вашей поездке?"}</h1><p>Выберите срок, интересы и комфортный темп. Города и дни подберём сами.</p></header>
    {onContinue && <div className="simple-resume"><span>У вас есть начатый план.</span><button onClick={onContinue}>Вернуться к поездке <ArrowRight /></button></div>}
    <form noValidate onSubmit={event => { event.preventDefault(); if (!invalid) onSubmit(trip); }}>
      <div className="simple-trip-basics"><div className="simple-field"><label htmlFor="trip-country">Куда хотите поехать?</label><select id="trip-country" value={trip.country ?? "CN"} onChange={event => {
          const country = event.target.value, bases = publishedBaseIds.filter(id => baseCatalog[id].country === country);
          if (bases.length) onChange(automaticPreferences({ ...trip, country, start: bases[0], end: bases.at(-1)!, required: [], journey: { ...trip.journey!, requiredPlaces: [] } }));
        }}>{Object.values(countries).filter(country => publishedBaseIds.some(id => baseCatalog[id].country === country.id)).map(country => <option key={country.id} value={country.id}>{country.name}</option>)}</select><small>Первое доступное направление</small></div>
        <fieldset className="simple-duration"><legend>На сколько дней?</legend><div className="simple-duration-options">{[7, 10, 14, 21].map(days => <button key={days} type="button" aria-pressed={trip.days === days} onClick={() => { duration(days); setCustomDays(false); }}>{daysText(days)}</button>)}<button type="button" aria-pressed={customDays} onClick={() => setCustomDays(true)}>Свой срок</button></div>
          {customDays && <label className="simple-custom-days">Дней в поездке<input type="number" min={5} max={28} value={Number.isFinite(trip.days) ? trip.days : ""} onChange={event => duration(event.target.valueAsNumber)} /><span>от 5 до 28</span></label>}
          <button type="button" className="simple-dates-toggle" aria-haspopup="dialog" onClick={() => setShowDates(true)}><CalendarDays />{exact ? periodLabel({ start: trip.startDate, end: addDays(trip.startDate, trip.days - 1) }) : "Указать точные даты"}{exact ? <Check /> : <Plus />}</button>
        </fieldset>
      </div>
      <fieldset className="simple-interests"><legend>Что вам интересно в поездке?</legend><p>Можно выбрать несколько. Распределим дни автоматически.</p><div>{interests.map(item => <button type="button" key={item.id} aria-pressed={trip.interests.includes(item.id)} onClick={() => toggleInterest(item.id)}><item.icon /><span>{item.label}</span><span className="simple-choice-mark">{trip.interests.includes(item.id) && <Check />}</span></button>)}</div></fieldset>
      {!trip.interests.length && <p className="simple-form-error" role="status">Выберите хотя бы один интерес.</p>}
      <fieldset className="simple-paces"><legend>Какой темп вам подходит?</legend><div>{paces.map(pace => <button type="button" key={pace.id} aria-pressed={trip.pace === pace.id} onClick={() => onChange(automaticPreferences(trip, { pace: pace.id }))}><strong>{pace.label}</strong><small>{pace.hint}</small></button>)}</div></fieldset>
      <details className="simple-extra"><summary><span>Дополнительные пожелания{selectedPlaces > 0 && <small> · Выбрано: {selectedPlaces}</small>}</span><ChevronDown /></summary>
        <div className="simple-extra-body"><div className="simple-extra-fields"><label>Бюджет на жильё и переезды, ¥<input type="number" min={1000} max={100000} step={100} value={Number.isFinite(trip.budget) ? trip.budget : ""} onChange={event => onChange({ ...trip, budget: event.target.valueAsNumber })} /><small>На одного человека · без питания и экскурсий</small></label><label>Транспорт<select value={trip.transport} onChange={event => onChange({ ...trip, transport: event.target.value as TripInput["transport"] })}><option value="mixed">Короткие поезда и самолёты</option><option value="train">Только поезда до 2 часов</option><option value="air">Самолёты</option></select></label></div>
          <p className="simple-place-label">Есть места, которые нельзя пропустить?</p><div className="simple-required-places">{trip.required.map(id => <button key={id} type="button" aria-label={`Убрать обязательный город: ${cities[id].name}`} onClick={() => onChange(toggleAutomaticPlace(trip, id, id, false))}>{cities[id].name}<X /></button>)}{trip.journey!.requiredPlaces.map(id => { const place = requiredPlaces.find(item => item.id === id)!; return <button key={id} type="button" aria-label={`Убрать обязательное место: ${place.name}`} onClick={() => onChange(toggleAutomaticPlace(trip, id, place.city, true))}>{place.name}<X /></button>; })}</div>
          <label className="simple-place-search"><MapPin /><input aria-label="Найти обязательный город или место" value={query} placeholder="Например, Шанхай или Великая стена" onChange={event => setQuery(event.target.value)} onKeyDown={event => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (choices.length === 1) choosePlace(choices[0]);
          }} /></label>
          {chosen.length >= 5 && <p className="simple-extra-hint" role="status">Можно выбрать до пяти городов. Чтобы добавить другой город, уберите один из выбранных.</p>}
          <div className="simple-place-choices">{choices.map(item => <button key={item.id} type="button" disabled={!chosen.includes(item.city) && chosen.length >= 5} onClick={() => choosePlace(item)}><span>{item.name}<small>{item.place ? cities[item.city].name : "Город"}</small></span><Plus /></button>)}</div>{!choices.length && <p className="simple-extra-hint">Такого места пока нет в каталоге.</p>}
        </div>
      </details>
      {(!Number.isInteger(trip.days) || trip.days < 5 || trip.days > 28) && <p className="simple-form-error" role="status">Укажите срок от 5 до 28 дней.</p>}
      {errors.length > 0 && <div className="simple-form-error" role="alert">{errors.map(error => <p key={error}>{error}</p>)}</div>}
      {errors.length > 0 && onRecover && <RouteRecoveryOptions input={trip} onApply={onRecover} />}
      <div className="simple-trip-submit"><p>Весь срок — на путешествие.<br />Дорогу из дней не вычитаем.</p><button type="submit" className="tv-button tv-primary" disabled={invalid}>Подобрать маршрут<ArrowRight /></button></div>
    </form>
    <p className="simple-trip-footnote">Сначала покажем предварительные маршруты. Гостиницы и билеты можно уточнить в плане.</p>
    {showDates && <TripDates startDate={trip.startDate >= moscowToday() ? trip.startDate : moscowToday()} days={Number.isInteger(trip.days) ? trip.days : 10} exact={exact} onClose={() => setShowDates(false)} onClear={() => { onChange({ ...trip, journey: { ...trip.journey!, flexibleDates: true } }); setShowDates(false); }} onApply={(startDate, days) => { const next = automaticPreferences({ ...trip, startDate }, { days }); onChange({ ...next, journey: { ...next.journey!, flexibleDates: false } }); setCustomDays(![7,10,14,21].includes(days)); setShowDates(false); }} />}
  </section>;
}
