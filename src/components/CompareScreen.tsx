import { CityEventPreview } from "./OfficialEvents";
import { RecommendationRefresh, RouteConditionsReason, WeatherStay } from "./Weather";
import { hasExactDates, internationalDays, isAutomaticTrip } from "../lib/trip-timing";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { ArrowRight, Check, ChevronDown, Clock3, Leaf, MapPin, RefreshCw, Route, SlidersHorizontal, Umbrella, Undo2 } from "lucide-react";
import { cities } from "../data/catalog";
import { destinationImages } from "../data/discovery";
import { addDays, daysText, duration, money, plural } from "../lib/format";
import { routeSignature, totals } from "../lib/planner";
import { routeAdjustments, routeDifference, routeExplanation, type RouteAdjustment } from "../lib/route-adjustments";
import { stayNotes } from "../lib/route-quality";
import { routePreview } from "../lib/route-preview";
import { periodLabel } from "../lib/travel-calendar";
import { defaultVariant, groupRouteOptions, variantTitle, variantTradeoff, type RouteOptionGroup } from "../lib/route-options";
import type { RoutePlan, TripInput } from "../types";
import type { LiveRouteProgress, LiveRouteResult } from "../../shared/live-routes";
import { alternativeTitle, routeChoiceAssessment, stopReason } from "../lib/route-reasons";
import RouteMap from "./RouteMap";
import type { RouteRecovery } from "../lib/route-recovery";
import RouteRecoveryOptions from "./RouteRecoveryOptions";

function RouteOption({ group, input, recommended, reference, alternatives, checked, onSelect }: {
  group: RouteOptionGroup; input: TripInput; recommended: boolean; reference: RoutePlan; alternatives: RoutePlan[];
  checked: (plan: RoutePlan) => boolean; onSelect: (plan: RoutePlan) => void;
}) {
  const choiceId = useId(), preferred = defaultVariant(group, input.priority);
  const [selectedKey, setSelectedKey] = useState(preferred.key), [detailsOpen, setDetailsOpen] = useState(false);
  const selected = group.variants.find(variant => variant.key === selectedKey) ?? preferred, plan = selected.plan;
  const t = totals(plan, input), explanation = routeExplanation(plan, input), rows = routePreview(plan, input);
  const reasons = new Map(isAutomaticTrip(input) ? rows.map(row => [row.city, stopReason(plan, input, row.city)] as const) : []);
  const assessment = routeChoiceAssessment(plan, input, alternatives);
  const photo = plan.cities.find(city => cities[city].interest === "nature") ?? plan.cities[0];
  const title = recommended ? "Рекомендуемый маршрут" : isAutomaticTrip(input) ? alternativeTitle(reference, plan, input) : variantTitle(preferred);
  return <article className={`route-option ${recommended ? "route-option-recommended" : ""}`} aria-label={`Вариант маршрута: ${title}`}>
    <div className="route-option-body">
      <div className="route-option-content">
      <div className="route-option-heading"><img src={destinationImages[photo]} alt="" /><div><span>{recommended ? "Под ваши пожелания" : "Другой маршрут"}</span><h2>{title}</h2></div></div>
      <p className="route-option-purpose">{isAutomaticTrip(input) ? `${assessment.strength} ${assessment.tradeoff}` : recommended ? "Подобран под ваш срок, впечатления и ритм." : routeDifference(reference, plan, input)}</p>
      <RouteConditionsReason plan={plan} reference={reference} input={input} compact />
      <ol className="route-option-stops">{rows.map((row, index) => <li key={row.city}>
        <span>{index + 1}</span><div><div className="route-stop-title"><strong>{cities[row.city].name}</strong><b>{daysText(plan.days[index])}</b></div>
          <small className="route-stop-date">{hasExactDates(input) ? periodLabel({ start: row.date, end: row.endDate }) : `Дни ${row.first + 1}–${row.last + 1}`}{row.arrival && " · с днём приезда"}</small>
          <p className="route-stop-highlights">{row.highlights.length ? row.highlights.map(place => place.name).join(" · ") : "Свободное время и отдых"}</p>
          {isAutomaticTrip(input) && <details className="route-stop-reason"><summary>Почему здесь {daysText(plan.days[index])}?</summary><p>{reasons.get(row.city)!.why}</p><p>{reasons.get(row.city)!.daysReason}</p><p>{reasons.get(row.city)!.load}</p>{reasons.get(row.city)!.caveat && <p>{reasons.get(row.city)!.caveat}</p>}{hasExactDates(input) && <WeatherStay city={row.city} start={row.date} end={row.endDate} />}</details>}
          {hasExactDates(input) && <CityEventPreview city={row.city} start={row.date} end={row.endDate} />}
          {row.ticket && <small className="route-stop-transfer">{row.ticket.mode === "train" ? `Далее поезд · ${duration(row.ticket.minutes)}` : row.flightQuote ? `Далее самолёт · ${duration(row.ticket.minutes)} · FlyAI` : "Далее перелёт · оценка"}<ArrowRight /></small>}
        </div>
      </li>)}</ol>
      <div className="route-option-experiences" aria-label="Дни впечатлений">{explanation.experiences.map(item => <span key={item.kind}>{item.name} <b>{item.days} дн.</b></span>)}</div>
      </div>
      <div className="route-option-decision">
      {group.variants.length > 1 ? <fieldset className="route-variants" aria-describedby={`${choiceId}-hint`}><legend>Переезды и проживание</legend>
        <p id={`${choiceId}-hint`}>Города и даты одинаковые. Выберите удобный вариант.</p>
        <small className="route-variants-cost-note">На человека в Китае · проживание и переезды</small>
        {group.variants.map(variant => { const price = totals(variant.plan, input); return <label key={variant.key} className={`route-variant ${selected.key === variant.key ? "route-variant-selected" : ""}`}>
          <input type="radio" name={choiceId} checked={selected.key === variant.key} onChange={() => setSelectedKey(variant.key)} />
          <span><strong>{variantTitle(variant)}{variant.key === preferred.key && <em>Рекомендуем</em>}</strong>
            <span className="route-variant-facts"><b>≈ {money(price.total)}</b><span><Clock3 />{price.minutes ? duration(price.minutes) : "Без переездов"}</span></span>
            {variant.key !== preferred.key && <small>{variantTradeoff(preferred.plan, variant.plan, input)}</small>}
          </span>
        </label>; })}
      </fieldset> : <dl className="route-option-facts"><div><dt>На человека в Китае</dt><dd>≈ {money(t.total)}</dd></div><div><dt><Clock3 />Между городами</dt><dd>{t.minutes ? duration(t.minutes) : "Без переездов"}</dd></div></dl>}
      <button className={`tv-button ${recommended ? "tv-primary" : "tv-secondary"}`} aria-label={`Выбрать маршрут «${title}»`} onClick={() => onSelect(plan)}>Выбрать маршрут <ArrowRight /></button>
      <small className="route-option-source">{checked(plan) ? t.liveFlights > 0 ? "Гостиницы и рейсы проверены · поисковые тарифы" : "Гостиницы и расписания проверены · тарифы поездов оценочные" : "Предварительная оценка проживания и переездов"}</small>
      </div>
      <details className="route-option-details" onToggle={event => setDetailsOpen(event.currentTarget.open)}><summary><MapPin />Карта и объяснение маршрута <ChevronDown /></summary>
        <RouteConditionsReason plan={plan} reference={reference} input={input} />
        {detailsOpen && <RouteMap ids={plan.cities} plan={plan} mini modes={rows.flatMap(row => row.ticket ? [row.ticket.mode] : [])} />}
        <p>{isAutomaticTrip(input) ? "Это отдельная идея поездки с другим набором городов. Сначала соблюдаем срок, бюджет и обязательные места, затем сравниваем стоимость, дорогу и соответствие интересам; среди близких вариантов учитываем различие мест." : explanation.rationale}</p>
        {input.journey && <div className="route-fit-explanation"><strong>Почему подходят места</strong><p>Учитываем ваши интересы, срок, темп и разнообразие мест. Оценка этого маршрута — {Math.round(explanation.fit.total)} из 100 по учебной модели.</p><ul>{explanation.fit.locations.map(location => <li key={location.city}><b>{cities[location.city].name}</b> — {location.reason}.</li>)}</ul><small>Редакционные оценки приложения, не отзывы туристов. Обязательные места сохраняются независимо от оценки.</small></div>}
        <p>{explanation.order}</p><p>{explanation.calendar}.</p>{[...stayNotes(plan, input), ...explanation.seasonalNotes].map(note => <p key={note}>{note}</p>)}<p>{isAutomaticTrip(input) ? "Все дни распределены между остановками. Время переездов показано справочно и не вычитается из срока." : "Дни включают приезд. Время на прогулки в день переезда показано в подробном плане."}</p></details>
    </div>
  </article>;
}

export default function CompareScreen({ input, plans, errors, currentPlan, routeSource, liveStatus, liveResult, liveProgress, onSearch, onCancel, onEdit, onSelect, onAdjust, onRecover, adjustmentNotice, onUndoAdjustment }: {
  input: TripInput; plans: RoutePlan[]; errors: string[]; currentPlan?: RoutePlan | null;
  routeSource: "demo" | "flyai"; onRouteSource: (source: "demo" | "flyai") => void;
  liveStatus: "idle" | "loading" | "done" | "error" | "cancelled"; liveResult?: LiveRouteResult; liveProgress?: LiveRouteProgress;
  onSearch: () => void; onCancel: () => void; onEdit: () => void; onSelect: (plan: RoutePlan) => void;
  onAdjust?: (change: RouteAdjustment) => void; adjustmentNotice?: string; onUndoAdjustment?: () => void;
  onRecover?: (change: RouteRecovery) => void;
}) {
  const [toolsOpen, setToolsOpen] = useState(false), [offersOpen, setOffersOpen] = useState(false);
  const [unavailable, setUnavailable] = useState("");
  const [pendingLabel, setPendingLabel] = useState("");
  const [adjusting, startAdjustment] = useTransition();
  const feedback = useRef<HTMLDivElement>(null), options = useRef<HTMLDivElement>(null), offers = useRef<HTMLButtonElement>(null);
  const offersId = useId();
  const groups = groupRouteOptions(plans, input), main = groups[0];
  const mainPlan = main ? defaultVariant(main, input.priority).plan : undefined;
  const offerFailed = liveStatus === "error" || liveStatus === "done" && !liveResult?.plans.length;
  const offerError = offerFailed ? errors[0] || "Не удалось уточнить предложения. Предварительные варианты доступны." : "";
  const adjustments = useMemo(() => toolsOpen && mainPlan && onAdjust ? routeAdjustments(input, mainPlan) : [], [input, mainPlan, toolsOpen, Boolean(onAdjust)]);
  const checked = (plan: RoutePlan) => Boolean(routeSource === "flyai" && liveResult?.plans.some(candidate => routeSignature(candidate) === routeSignature(plan)));
  useEffect(() => {
    if (!adjustmentNotice) return;
    feedback.current?.focus({ preventScroll: true });
    feedback.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [adjustmentNotice]);
  useEffect(() => {
    if (offersOpen) offers.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [offersOpen]);
  function applyAdjustment(change: RouteAdjustment) {
    if (!change.input) {
      setUnavailable(`${change.label}: ${change.hint.toLocaleLowerCase("ru-RU")}. Измените дополнительные пожелания, чтобы подобрать другой вариант.`);
      return;
    }
    setUnavailable(""); setPendingLabel(change.label);
    startAdjustment(() => onAdjust?.(change));
  }
  return <section className="trip-results route-comparison" aria-label="Сравнение маршрутов">
    <div className="result-page-heading"><div><p className="new-eyebrow">ПОЕЗДКА, КОТОРАЯ ПОДХОДИТ ВАМ</p><h1>{!main ? "Немного уточним пожелания" : groups.length === 1 ? "Ваш маршрут по Китаю" : "Выберите маршрут"}</h1><p>{daysText(input.days)}{internationalDays(input) > 0 && " · из Москвы"} · {hasExactDates(input) ? periodLabel({ start: input.startDate, end: addDays(input.startDate, input.days - 1) }) : "Даты уточним позже"}</p></div><button className="tv-button tv-secondary" onClick={onEdit}><SlidersHorizontal />Изменить пожелания</button></div>
    <RecommendationRefresh exact={hasExactDates(input)} />
    {adjustmentNotice && <div className="route-adjustment-feedback" role="status" ref={feedback} tabIndex={-1}><div><strong>Маршруты обновлены</strong><p>{adjustmentNotice}</p><button type="button" className="route-show-updated" onClick={() => options.current?.scrollIntoView({ block: "start", behavior: "instant" })}>Посмотреть результат <ArrowRight /></button></div>{onUndoAdjustment && <button type="button" onClick={onUndoAdjustment}><Undo2 />Отменить изменение</button>}</div>}
    {currentPlan && <div className="route-current"><span>У вас уже есть план поездки.</span><button onClick={() => onSelect(currentPlan)}>Продолжить мой план <ArrowRight /></button></div>}
    {main ? <>
      <p className="route-comparison-guide">{groups.length === 1 ? "Для этих пожеланий найден один подходящий набор городов. Не создаём дубликаты ради выбора. После выбора откроем подробный план." : `${groups.length} ${plural(groups.length, ["маршрут", "маршрута", "маршрутов"])} под ваши пожелания. Сравните места и дни, затем выберите свой.`}</p>
      <div ref={options} className={`route-options route-options-${groups.length}`}>{groups.map(group => <RouteOption key={`${input.priority}:${group.key}`} group={group} input={input} recommended={group === main} reference={mainPlan!} alternatives={plans} checked={checked} onSelect={onSelect} />)}</div>
      <p className="route-comparison-caption">{groups.length === 1 && main.variants.length === 1 && main.variants[0].labels.length === 3 && "Один маршрут подошёл всем трём критериям. "}Международные билеты, питание и экскурсии в стоимость не входят. {internationalDays(input) > 0 ? "Москва → Китай → Москва; дни приезда входят в остановки." : "Дорогу из срока поездки не вычитаем."}</p>
      {onAdjust && <div className="route-refine"><button type="button" className="route-refine-toggle" aria-expanded={toolsOpen} aria-controls="route-refine-options" onClick={() => setToolsOpen(!toolsOpen)}><SlidersHorizontal />Подстроить варианты <ChevronDown /></button>{toolsOpen && <><div className="route-adjustment-options" id="route-refine-options" aria-busy={adjusting}>{adjustments.map(change => <button type="button" key={change.id} disabled={adjusting} data-unavailable={!change.input || undefined} aria-pressed={change.id === "sea-last" ? change.active : undefined} onClick={() => applyAdjustment(change)}>{change.id === "fewer-stops" ? <Route /> : change.id === "more-nature" ? <Leaf /> : change.active ? <Check /> : <Umbrella />}<span><strong>{change.label}</strong><small>{change.hint}</small></span></button>)}</div>{adjusting && <p className="route-refine-help" role="status">Пересчитываем маршруты: {pendingLabel.toLocaleLowerCase("ru-RU")}…</p>}{unavailable && <div className="route-refine-help" role="status"><p>{unavailable}</p><button type="button" className="tv-button tv-secondary" onClick={onEdit}>Изменить пожелания <ArrowRight /></button></div>}</>}</div>}
    </> : <div className="result-empty"><Route /><h2>Пока не удалось совместить все пожелания</h2><p>{errors[0] || "Попробуйте добавить пару дней, сократить число городов или разрешить перелёты."}</p>{onRecover && <RouteRecoveryOptions input={input} onApply={onRecover} />}<button className="tv-button tv-secondary" onClick={onEdit}>Изменить пожелания вручную <ArrowRight /></button></div>}
    <div className="route-offer-details"><button ref={offers} type="button" className="route-offer-toggle" aria-expanded={offersOpen} aria-controls={offersId} onClick={() => setOffersOpen(!offersOpen)}>Цены и актуальные предложения <ChevronDown /></button>
      <div id={offersId} hidden={!offersOpen}>
      {plans.length > 0 && <div className={`route-online-status${offerFailed ? " route-online-error" : ""}`} role={offerFailed ? "alert" : "status"} aria-live={offerFailed ? "assertive" : "polite"}>
        <div><strong>{liveStatus === "loading" ? "Уточняем предложения" : offerFailed ? "Не удалось уточнить предложения" : mainPlan && checked(mainPlan) ? "Расписания и гостиницы проверены" : "Сейчас показан предварительный расчёт"}</strong>
          <p>{liveStatus === "loading" ? liveProgress?.message || "План можно открыть во время проверки." : offerFailed ? offerError : !hasExactDates(input) ? "Для проверки гостиниц и расписаний нужны точные даты. Сейчас цены предварительные." : "Онлайн-проверка уточнит гостиницы, прямые авиарейсы и поезда до 2 часов на ваши даты. Тарифы поездов пока оценочные."}</p>
        </div>
        {!hasExactDates(input) ? <button className="tv-button tv-secondary" onClick={onEdit}>Указать даты</button> : liveStatus === "loading" ? <button className="tv-button tv-secondary" onClick={onCancel}>Остановить проверку</button> : <button className="tv-button tv-secondary" onClick={onSearch}><RefreshCw />{offerFailed ? "Повторить проверку" : mainPlan && checked(mainPlan) ? "Обновить предложения" : "Уточнить предложения"}</button>}
      </div>}
      <p>Что входит в расчёт: проживание и переезды внутри Китая для одного человека. Первые варианты — по учебному каталогу. При онлайн-проверке расписания поездов до 2 часов — RailGo, гостиницы и авиабилеты — поиск Fliggy через FlyAI. Гостиницы для подбора — с известным расположением в пределах 25 км от центра остановки по прямой. Тарифы поездов оценочные; наличие мест и итоговые сборы нужно уточнить.</p>
      {liveResult?.searchedAt && <p>Проверено {new Date(liveResult.searchedAt).toLocaleString("ru-RU")}.</p>}{[...new Set([...errors, ...(liveResult?.warnings ?? [])])].filter(message => message !== offerError || !plans.length).map(message => <p key={message}>{message}</p>)}
      </div>
    </div>
  </section>;
}
