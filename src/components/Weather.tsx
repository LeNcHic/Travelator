import { BusyIcon } from "./LoadingStatus";
import { createContext, useContext, useTransition } from "react";
import { ChevronDown, CloudSun, RefreshCw } from "lucide-react";
import { isFreshWeather, weatherKindLabel, weatherSuitability, type WeatherResult } from "../../shared/weather";
import type { CityId } from "../types";
import { displayDate } from "../lib/format";
import { cities } from "../data/catalog";
import type { RoutePlan, TripInput } from "../types";
import { conditionsEvaluator } from "../lib/route-conditions";
import { duration, money } from "../lib/format";
import { totals } from "../lib/planner";
import { weatherCoverage } from "../lib/weather-search";
import { interestNames } from "../lib/journey";
import { RouteEventStatus, useOfficialEvents } from "./OfficialEvents";

export interface WeatherState { status: "idle" | "loading" | "done" | "error"; result?: WeatherResult; error?: string; retry?: () => void; apply?: () => void; applied?: boolean; calculating?: boolean }
export const WeatherContext = createContext<WeatherState>({ status: "idle" });
export const useWeather = () => useContext(WeatherContext);
export function RouteConditionsReason({ plan, reference, input, compact = false }: { plan: RoutePlan; reference: RoutePlan; input: TripInput; compact?: boolean }) {
  const weather = useWeather(), events = useOfficialEvents();
  if (!weather.applied) return null;
  const evaluate = conditionsEvaluator(input,weather.result?.days,events.result?.events), current = evaluate(plan), other = evaluate(reference);
  const difference = current.favourable - other.favourable;
  const time = totals(plan,input).minutes - totals(reference,input).minutes, cost = totals(plan,input).total - totals(reference,input).total;
  if (compact) return <p className="route-condition-summary">{current.forecast === other.forecast && difference > 0 ? `На ${difference} больше подходящих дней по прогнозу.` : current.forecast ? `Прогноз: ${current.forecast} из ${input.days} дней.` : "Погода пока без прогноза."}{current.seasonal > 0 && ` Остальное — сезонный ориентир${current.unknown ? " или неизвестно" : ""}.`}</p>;
  return <div className="route-condition-reason">
    <p>{current.forecast === other.forecast && difference > 0 ? `По прогнозу на ${difference} больше дней, подходящих для выбранных занятий по модели приложения.` : current.forecast ? `Прогноз покрывает ${current.forecast} из ${input.days} дней; ${current.favourable} из них выглядят более подходящими для программы.` : "Для этого варианта пока нет прогноза на дни остановок."}</p>
    {current.seasonal > 0 && <p>{current.seasonal} дн. — сезонные данные, не прогноз.</p>}
    {current.unknown > 0 && <p>{current.unknown} дн. — погодные условия неизвестны.</p>}
    {current.matches.length > 0 && <p>На ваши даты: {current.matches.slice(0,2).map(event => event.title).join(" · ")}. {time > 0 ? `Дорога на ${duration(time)} дольше базового варианта. ` : ""}{cost > 0 ? `Оценка дороже на ${money(cost)}. ` : ""}Билеты на событие не подтверждены.</p>}
  </div>;
}
export function RecommendationRefresh({ exact }: { exact: boolean }) {
  const weather = useWeather(), events = useOfficialEvents(), [pending,startTransition] = useTransition();
  if (!exact || weather.status === "idle" && events.status === "idle") return null;
  const loading = weather.status === "loading" || events.status === "loading";
  const calculating = pending || weather.calculating;
  const usable = weather.result?.days.some(day => day.kind !== "unknown") || events.result?.events.length;
  return <div className="conditions-update" aria-busy={calculating || loading}>
    <div className="conditions-update-heading">{loading || calculating ? <BusyIcon /> : <CloudSun />}<div><strong>{calculating ? "Пересчитываем рекомендации…" : loading ? "Уточняем погоду и афишу" : weather.applied ? "Уточнение учтено в сравнении" : usable ? "Есть данные для уточнения маршрутов" : "Маршруты доступны без внешних данных"}</strong>
      <p>{loading ? "Предварительные варианты уже можно смотреть и выбирать." : "Выбранный план сохраняется. Новый вариант применится только после вашего выбора."}</p></div>
      {!loading && usable && weather.apply && <button type="button" className="tv-button tv-secondary" disabled={Boolean(calculating)} onClick={() => startTransition(() => weather.apply?.())}>{weather.applied ? "Обновить сравнение" : "Сравнить с учётом данных"}</button>}
    </div>
    <details><summary>Источники и покрытие <ChevronDown /></summary><div className="conditions-source-notes">
      <p>Для ближайших 16 календарных дней используем прогноз, дальше — сезонный ориентир по архиву трёх полных лет. Это не обещание конкретной погоды. Данные запрашиваются только для перспективных баз; покрытие каждой остановки видно в её деталях.</p>
      {weather.result && <p>Погодных баз проверено: {weather.result.points.length}. Получено {new Date(weather.result.updatedAt).toLocaleString("ru-RU")}. {weather.result.warnings.join(" ")}</p>}
      {weather.error && <p role="alert">{weather.error} Погода остаётся неизвестной.</p>}
      {weather.retry && <button type="button" className="tv-button tv-secondary" disabled={loading} onClick={weather.retry}><RefreshCw />Обновить погоду</button>}
      <RouteEventStatus exact={exact} /><p><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Погода: Open-Meteo</a> · CC BY 4.0. Кеш прогноза — 1 час, исторической выборки — 7 дней.</p>
    </div></details>
  </div>;
}
export function WeatherStay({ city, start, end }: { city: CityId; start: string; end: string }) {
  const state = useWeather();
  if (state.status === "idle") return null;
  const days = state.result?.days.filter(day => day.city === city && day.date >= start && day.date <= end).map(day => isFreshWeather(day) ? day : { ...day, kind: "unknown" as const }) ?? [];
  const coverage = weatherCoverage(days), point = state.result?.points.find(p => p.city === city);
  const favourable = days.filter(day => day.kind === "forecast" && (weatherSuitability(day,cities[city].interest) ?? 0) >= 65).length;
  return <details className="weather-stay"><summary><CloudSun /><span>Погода{state.status === "loading" ? " · проверяем…" : days.length ? ` · прогноз ${coverage.forecast} дн., сезонный ориентир ${coverage.seasonal} дн.` : " · нет данных по этой базе"}</span><ChevronDown /></summary><div>
    {state.status === "error" && <p>Источник недоступен. Хорошую погоду не предполагаем.</p>}
    {point && <p>Точка: {point.label}. Часовой пояс {point.timezone}. Погода на других выездах может отличаться, особенно в горах.</p>}
    {coverage.forecast > 0 && <p>По модели приложения {favourable} из {coverage.forecast} дней с прогнозом выглядят более подходящими для формата «{interestNames[cities[city].interest]}». Это оценка условий, а не вероятность хорошей погоды.</p>}
    {coverage.seasonal > 0 && <p>Сезонные значения — средние по окну ±7 дней за {days.find(d => d.kind === "seasonal")?.years}. Частота осадков в архиве не является прогнозом дождя на эту дату.</p>}
    {(coverage.unknown > 0 || !days.length) && <p>Часть условий неизвестна. Отсутствие данных не означает комфортную погоду.</p>}
    <div className="weather-table-scroll"><table><caption>Погодные данные на даты остановки</caption><thead><tr><th>Дата</th><th>Тип данных</th><th>Воздух, °C</th><th>Осадки, мм</th><th>Ветер, км/ч</th><th>Видимость, км</th></tr></thead><tbody>{days.map(day => <tr key={day.date}><td>{displayDate(day.date)}</td><td>{weatherKindLabel[day.kind]}</td><td>{day.low ?? "?"}…{day.high ?? "?"}</td><td>{day.rainMm ?? "?"}</td><td>{day.windKmh ?? "?"}</td><td>{day.visibilityKm === null ? "неизвестна" : Math.round(day.visibilityKm)}</td></tr>)}</tbody></table></div>
    {cities[city].interest === "sea" && <p>Указана температура воздуха, не воды. Купание, состояние моря и открытие пляжа нужно проверять отдельно.</p>}
    <small>Получено {days[0] ? new Date(days[0].updatedAt).toLocaleString("ru-RU") : "—"}. <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>, CC BY 4.0. Длительности программы и оценка комфорта — учебная модель.</small>
  </div></details>;
}
