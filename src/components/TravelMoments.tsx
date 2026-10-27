import { useId } from "react";
import { ArrowRight, CalendarDays, ChevronDown, ExternalLink, Leaf } from "lucide-react";
import { cities } from "../data/catalog";
import { eventCoverageYears } from "../data/travel-moments";
import { missingCalendarYears, momentsForPeriod, periodLabel, type DatePeriod, type MomentMatch } from "../lib/travel-calendar";
import type { CityId } from "../types";

const labels = { event: "Событие", holiday: "Праздничные дни", season: "Идея для сезона" };

export function MomentCard({ match, onExplore }: {
  match: MomentMatch; onExplore?: (city: CityId) => void;
}) {
  const { moment, overlap } = match;
  return <article className={`moment-card moment-${moment.kind}`}>
    <div className="moment-content">
      <p className="moment-kind">{moment.kind === "season" ? <Leaf /> : <CalendarDays />}{labels[moment.kind]}{moment.city && <span>· {cities[moment.city].name}</span>}</p>
      <h3>{moment.title}</h3>
      <span className="moment-date">{moment.dates ? periodLabel(moment.dates) : `Идея на ${periodLabel(overlap)} · без фиксированного расписания`}</span>
      {moment.dates && <small className="moment-overlap">Совпадает с поездкой: {periodLabel(overlap)}</small>}
      <p className="moment-description">{moment.description}</p>
      <details className="moment-details"><summary>Детали и источник <ChevronDown /></summary><p>{moment.advice}</p>
        {moment.kind === "season" && <p>Месяцы выбраны редакционно. Ссылка описывает место; она не подтверждает погоду и доступность на ваши даты.</p>}
        <a href={moment.source.url} target="_blank" rel="noreferrer">{moment.source.title} <ExternalLink /></a>
        <small>Проверено {moment.checkedAt.split("-").reverse().join(".")}. Билеты, часы работы и доступность требуют уточнения.</small>
      </details>
      {onExplore && moment.city && <button type="button" className="moment-explore" onClick={() => onExplore(moment.city!)}>Открыть {cities[moment.city].name}<ArrowRight /></button>}
    </div>
  </article>;
}

export default function TravelMoments({ period, city, onlyCities, datedOnly = false, hideHeading = false, title = "На ваши даты", compact = false, onExplore }: {
  period: DatePeriod | null; city?: CityId; title?: string; compact?: boolean; onExplore?: (city: CityId) => void;
  onlyCities?: CityId[];
  datedOnly?: boolean;
  hideHeading?: boolean;
}) {
  const heading = useId();
  if (!period) return null;
  const matches = momentsForPeriod(period, city).filter(match => (!datedOnly || match.moment.kind !== "season") && (!onlyCities?.length || !match.moment.city || onlyCities.includes(match.moment.city)));
  const dated = matches.filter(match => match.moment.kind !== "season");
  const seasons = matches.filter(match => match.moment.kind === "season");
  const featured = [...dated.slice(0, 3)];
  const categories = new Set<string>(featured.flatMap(match => match.moment.city ? [cities[match.moment.city].interest] : []));
  for (const match of seasons) {
    const category = match.moment.city ? cities[match.moment.city].interest : "";
    if (featured.length < 3 && !categories.has(category)) { featured.push(match); categories.add(category); }
  }
  for (const match of seasons) if (featured.length < 3 && !featured.includes(match)) featured.push(match);
  const visible = compact && city ? [...dated.slice(0, 2), ...seasons.slice(0, 1)] : featured;
  const extra = matches.filter(match => !visible.includes(match));
  const missingYears = missingCalendarYears(period, eventCoverageYears);
  return <section className={`travel-moments ${compact ? "moments-compact" : ""}`} aria-labelledby={hideHeading ? undefined : heading} aria-label={hideHeading ? title : undefined}>
    {!hideHeading && <div className="moments-heading"><div><p className="new-eyebrow">ВПЕЧАТЛЕНИЯ И КАЛЕНДАРЬ</p><h2 id={heading}>{title}</h2></div><span>{periodLabel(period)}</span></div>}
    <div className="moments-grid">{visible.map(match => <MomentCard key={match.moment.id} match={match} onExplore={onExplore} />)}</div>
    {!matches.length && <p className="moments-empty">В нашем небольшом календаре пока нет идей на этот период. Посмотрите достопримечательности города — отсутствие записи не означает, что событий нет.</p>}
    {extra.length > 0 && <details className="moments-more"><summary>Ещё идеи на эти даты ({extra.length}) <ChevronDown /></summary><div className="moments-grid">{extra.map(match => <MomentCard key={match.moment.id} match={match} onExplore={onExplore} />)}</div></details>}
    <p className="moments-note">{missingYears.length ? `На ${missingYears.join(", ")} ${missingYears.length === 1 ? "год" : "годы"} датированные события и праздники пока не добавлены. Сезонные идеи не являются афишей.` : dated.length ? "Даты из открытых источников. Конкретную программу и билеты проверяйте у организатора." : "Подтверждённых событий на этот период в нашем календаре пока нет. Показаны идеи для знакомства с местами."}</p>
  </section>;
}
