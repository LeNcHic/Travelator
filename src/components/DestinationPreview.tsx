import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, MapPin } from "lucide-react";
import { cities } from "../data/catalog";
import { attractionsIn } from "../data/attractions";
import { chinaKnowledge } from "../data/china-knowledge";
import { destinationImages, destinationNotes } from "../data/discovery";
import { requiredPlaces } from "../lib/journey";
import type { CityId } from "../types";
import Modal from "./Modal";
import TravelMoments from "./TravelMoments";
import { periodLabel, type DatePeriod } from "../lib/travel-calendar";

export default function DestinationPreview({ cityId, selected, atLimit, onSelect, onClose, period }: {
  cityId: CityId; selected: boolean; atLimit: boolean; onSelect: () => void; onClose: () => void;
  period?: DatePeriod | null;
}) {
  const city = cities[cityId], note = destinationNotes[cityId], knowledge = chinaKnowledge[cityId];
  const essentials = new Set<string>(requiredPlaces.filter(place => place.city === cityId).map(place => place.id));
  const places = [...attractionsIn(cityId)].sort((a, b) => Number(essentials.has(b.id)) - Number(essentials.has(a.id))).slice(0, 4);
  return <Modal title={city.name} eyebrow="ОТКРОЙТЕ КИТАЙ" className="destination-dialog" onClose={onClose}>
    <div className="destination-preview-scroll">
      <div className="destination-preview-photo"><img src={destinationImages[cityId]} alt={`${city.name} · ${note.title}`} /><span>{note.highlight}</span></div>
      <div className="destination-preview-body">
        <h3>{note.title}</h3><p className="destination-preview-description">{city.description}</p>
        <div className="destination-preview-facts"><span><Clock3 />Ориентир: {note.stay}</span><span>{knowledge.season}</span></div>
        <section className="destination-preview-places" aria-labelledby="destination-places-heading"><h3 id="destination-places-heading">Что посмотреть</h3><ul>{places.map(place => <li key={place.id}><MapPin aria-hidden="true" /><div><h4>{place.name}</h4><p>{place.description}</p></div></li>)}</ul></section>
        {period && <details className="destination-preview-calendar"><summary><CalendarDays /><span>На выбранные даты<small>{periodLabel(period)}</small></span><ChevronDown /></summary><TravelMoments period={period} city={cityId} compact hideHeading /></details>}
        <details className="destination-preview-practical"><summary>Что учесть перед поездкой <ChevronDown /></summary><p>{knowledge.practical}</p><ul>{knowledge.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>
      </div>
    </div>
    <footer className="destination-preview-footer">
      {atLimit && !selected && <p role="status">В поездке уже пять городов. Чтобы добавить {city.name}, сначала уберите один из выбранных.</p>}
      <div><button className="destination-preview-back" onClick={onClose}>Продолжить выбор</button><button className="tv-button tv-primary" disabled={selected || atLimit} onClick={onSelect}>{selected ? <><Check />Уже в поездке</> : <>Хочу сюда <ArrowRight /></>}</button></div>
    </footer>
  </Modal>;
}
