import { useState } from "react";
import { ArrowDown, ArrowRight, Check, ChevronDown, Clock3, Compass, Search, X } from "lucide-react";
import { cities } from "../data/catalog";
import { destinationImages, destinationNotes, findDestinations, tripIdeas, type TripIdea } from "../data/discovery";
import { chinaKnowledge } from "../data/china-knowledge";
import type { CityId, Interest } from "../types";
import DestinationPreview from "./DestinationPreview";
import DateDiscovery from "./DateDiscovery";
import { holidayPeriod, type DatePeriod } from "../lib/travel-calendar";
import { addDays, isoDate, plural } from "../lib/format";

export default function DiscoverScreen({ selected, onToggleCity, onStart, onIdea, startDate = addDays(isoDate(new Date()), 14), days = 14, onDates }: {
  selected: CityId[]; onToggleCity: (city: CityId) => void; onStart: () => void; onIdea: (idea: TripIdea) => void;
  startDate?: string; days?: number; onDates?: (start: string, days: number) => void;
}) {
  const [filter, setFilter] = useState<Interest | "all">("all");
  const [query, setQuery] = useState(""), [showAll, setShowAll] = useState(false);
  const [preview, setPreview] = useState<CityId | null>(null);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [previewPeriod, setPreviewPeriod] = useState<DatePeriod | null>(() => holidayPeriod(startDate, days));
  const matches = findDestinations(filter, query);
  const visible = filter === "all" && !query.trim() && !showAll ? matches.slice(0, 6) : matches;
  return <div className={`discover-screen ${selected.length ? "has-selection" : ""}`}>
    <section className="discover-hero" aria-labelledby="discover-heading">
      <img className="discover-hero-image" src="/images/china/hero.jpg" alt="Река Ли среди карстовых гор в районе Гуйлиня" fetchPriority="high" />
      <div className="discover-hero-shade" />
      <div className="discover-hero-content"><span className="discover-kicker"><span />НАЧНИТЕ С ОТКРЫТИЯ</span>
        <h1 id="discover-heading">Один Китай.<br /><em>Тысячи впечатлений.</em></h1>
        <p>Небоскрёбы, горы и тёплое море.<br /> Найдите то, ради чего хочется отправиться в путь.</p>
        <div className="discover-hero-actions"><button className="tv-button tv-primary" onClick={onStart}>Подобрать путешествие <ArrowRight /></button><a href="#destinations">Сначала посмотреть места <ArrowDown /></a></div>
      </div>
      <div className="discover-photo-caption"><span>25° С. Ш. · 110° В. Д.</span>Гуйлинь · река Ли</div>
    </section>
    <nav className="country-section-nav" aria-label="Знакомство с Китаем"><a href="#destinations">Места и впечатления</a><a href="#trip-calendar">На мои даты</a><a href="#trip-ideas">Идеи маршрутов</a></nav>
    <section className="discovery-section" id="destinations" aria-labelledby="destinations-heading">
      <div className="discovery-section-heading"><div><p className="new-eyebrow">СТРАНА В ВАШЕМ РИТМЕ</p><h2 id="destinations-heading">Какой Китай вам ближе?</h2></div><p>Выберите места, которые нравятся.<br /> Мы свяжем их в одно путешествие.</p></div>
      <div className="discovery-filters" role="group" aria-label="Что посмотреть в Китае">{([
        ["all", "Весь Китай"], ["city", "Города и культура"], ["nature", "Горы и природа"], ["sea", "Отдых у моря"],
      ] as const).map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setShowAll(false); }}>{label}{key === "sea" && <span className="discovery-filter-count">{findDestinations("sea").length}</span>}</button>)}</div>
      <div className="destination-search"><label><Search /><input aria-label="Найти город или достопримечательность" placeholder="Город или место, например терракотовая армия" value={query} onChange={event => setQuery(event.target.value)} /></label><span>{Object.keys(cities).length} направлений для знакомства с Китаем</span></div>
      <div className="destination-grid">{visible.map(id => {
        const chosen = selected.includes(id), note = destinationNotes[id];
        return <article className={`destination-card ${chosen ? "is-chosen" : ""}`} key={id}>
          <div className="destination-photo"><img src={destinationImages[id]} alt={`${cities[id].name} · ${note.title}`} loading="lazy" /><span>{note.highlight}</span>{chosen && <span className="destination-selected"><Check />Выбрано</span>}</div>
          <div className="destination-copy"><h3>{cities[id].name}</h3><p>{note.line}</p><span className="destination-duration"><Clock3 />Ориентир: {note.stay}</span><small className="destination-season">{chinaKnowledge[id].season}</small><div className="destination-card-actions"><button className="destination-about-button" aria-haspopup="dialog" aria-label={`О месте: ${cities[id].name}`} onClick={() => setPreview(id)}>О месте</button><button disabled={!chosen && selected.length >= 5} aria-pressed={chosen} aria-label={`${chosen ? "Убрать" : "Добавить"} ${cities[id].name} ${chosen ? "из поездки" : "в поездку"}`} onClick={() => onToggleCity(id)}>{chosen ? <><Check />В моей поездке</> : <>Хочу сюда <ArrowRight /></>}</button></div></div>
        </article>;
      })}</div>
      {!matches.length && <div className="destination-no-results" role="status">Похожих мест не нашли. Попробуйте другое название или выберите «Весь Китай».</div>}
      {visible.length < matches.length && <button className="tv-button tv-secondary destination-show-more" onClick={() => setShowAll(true)}>Ещё {matches.length - visible.length} направлений <ArrowDown /></button>}
    </section>
    <DateDiscovery startDate={startDate} days={days} onApply={(start, length) => onDates?.(start, length)} onPreviewPeriod={setPreviewPeriod} onExplore={setPreview} />
    <section className="discovery-section idea-section" id="trip-ideas" aria-labelledby="ideas-heading"><div className="discovery-section-heading"><div><p className="new-eyebrow">ЕСЛИ ХОЧЕТСЯ НАЧАТЬ С ИДЕИ</p><h2 id="ideas-heading">У каждого путешествия — свой сюжет.</h2></div><p>Три отправные точки.<br /> Любую можно изменить под себя.</p></div>
      <div className="idea-grid">{tripIdeas.filter(idea => ["first", "eastern", "pandas"].includes(idea.id)).map(idea => <button className="idea-card" key={idea.id} onClick={() => onIdea(idea)}><img src={idea.image} alt="" loading="lazy" /><div className="idea-card-shade" /><span className="idea-days">Идея на {idea.days} дней</span><div className="idea-copy"><h3>{idea.title}</h3><p>{idea.description}</p><span>{idea.cities.map(id => cities[id].name).join(" → ")}</span><strong>Примерить маршрут <ArrowRight /></strong></div></button>)}</div>
    </section>
    <section className="discover-invitation"><span className="new-eyebrow">НЕ НУЖНО ЗНАТЬ КИТАЙ ЗАРАНЕЕ</span><h2>Ваши пожелания.<br />Наш первый маршрут.</h2><p>Выберите срок, впечатления и комфортный ритм.<br />Сначала покажем поездку целиком, затем разберём детали.</p><button className="tv-button tv-primary" onClick={onStart}>Собрать своё путешествие <ArrowRight /></button></section>
    {selected.length > 0 && <aside className="destination-selection-dock" aria-label="Выбранные направления">
      {selectionOpen && <div className="selection-dock-places" id="selected-destinations"><p>Обязательно включим в маршрут</p><div>{selected.map(id => <button type="button" key={id} aria-label={`Убрать ${cities[id].name} из выбранных направлений`} onClick={() => onToggleCity(id)}>{cities[id].name}<X /></button>)}</div>{selected.length >= 5 && <small>Выбрано максимум пять баз с ночёвкой.</small>}</div>}
      <div className="selection-dock-row"><button type="button" className="selection-dock-summary" aria-expanded={selectionOpen} aria-controls="selected-destinations" onClick={() => setSelectionOpen(!selectionOpen)}><Compass /><span><strong>{selected.length} {plural(selected.length, ["место", "места", "мест"])} для поездки</strong><small>{selected.map(id => cities[id].name).join(" · ")}</small></span><ChevronDown /></button><button className="tv-button tv-primary" onClick={onStart}>Собрать поездку <ArrowRight /></button></div>
    </aside>}
    {preview && <DestinationPreview cityId={preview} period={previewPeriod} selected={selected.includes(preview)} atLimit={selected.length >= 5} onClose={() => setPreview(null)} onSelect={() => { onToggleCity(preview); setPreview(null); }} />}
  </div>;
}
