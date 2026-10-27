import { createContext, useContext } from "react";
import { CalendarDays, ChevronDown, RefreshCw } from "lucide-react";
import { currentEventsForStay, type OfficialEventResult } from "../../shared/events";
import type { CityId } from "../types";
import { periodLabel } from "../lib/travel-calendar";
import { cities } from "../data/catalog";

export interface EventState { status: "idle" | "loading" | "done" | "error"; result?: OfficialEventResult; error?: string; retry?: () => void }
export const OfficialEventsContext = createContext<EventState>({ status: "idle" });
export const useOfficialEvents = () => useContext(OfficialEventsContext);
export function RouteEventStatus({ exact }: { exact: boolean }) {
  const state = useOfficialEvents();
  if (!exact || state.status === "idle") return null;
  const events = state.result?.events ?? [];
  return <details className="route-event-status"><summary><CalendarDays />{state.status === "loading" ? "Проверяем официальную афишу…" : state.status === "error" ? "Афиша сейчас недоступна" : `События на ваши даты: ${events.length}`}<ChevronDown /></summary>
    {state.status === "done" && <><p>Учитываем только события, заново проверенные по первоисточнику и совпавшие с датами остановки. Они дают небольшой дополнительный вес; срок, бюджет и обязательные места сохраняются.</p><p>Подключены источники: {state.result!.supportedCities.map(id => cities[id].name).join(", ")}. Это выборочная афиша, а не полный список мероприятий Китая.</p><small>Проверка {new Date(state.result!.searchedAt).toLocaleString("ru-RU")}. Источники обновляются при запросе, кеш — 30 минут.</small></>}
    {state.error && <p>{state.error} Маршруты доступны без событий.</p>}{state.result?.warnings.map(item => <p key={item}>{item}</p>)}
    {state.retry && <button className="tv-button tv-secondary" disabled={state.status === "loading"} onClick={state.retry}><RefreshCw />Проверить афишу</button>}
  </details>;
}
export function CityEventPreview({ city, start, end }: { city: CityId; start: string; end: string }) {
  const state = useOfficialEvents(), matches = currentEventsForStay(state.result?.events ?? [], city, start, end);
  return matches.length ? <p className="route-event-preview"><CalendarDays />На эти дни: {matches.slice(0, 2).map(event => event.title).join(" · ")}</p> : null;
}
export function CityOfficialEvents({ city, start, end }: { city: CityId; start: string; end: string }) {
  const state = useOfficialEvents(), matches = currentEventsForStay(state.result?.events ?? [], city, start, end);
  if (state.status === "idle") return null;
  return <details className="city-official-events"><summary><CalendarDays />Актуальная афиша{matches.length > 0 && ` · ${matches.length}`}<ChevronDown /></summary>
    {state.status === "loading" && <p>Проверяем даты по официальным источникам…</p>}
    {state.status === "error" && <p>Источники сейчас недоступны. События не добавлены к рекомендации.</p>}
    {state.status === "done" && !matches.length && <p>{state.result?.checkedCities.includes(city) ? "В проверенных источниках нет событий на дни этой остановки. Это не означает, что мероприятий в городе нет." : "Для этого города пока нет успешно проверенной афиши. Достопримечательности доступны в плане по дням."}</p>}
    {matches.map(event => <article key={event.id}><h4>{event.title}</h4><span>{periodLabel(event.dates)}</span><p>{event.venue ?? "Площадку уточните в программе организатора"}. {event.registration === "required" ? "Нужна регистрация." : event.registration === "not_required" ? "По источнику регистрация не требуется." : "Необходимость регистрации неизвестна."} Наличие билетов неизвестно.</p><p>{event.description}</p><p>{event.advice}</p><a href={event.source.url} target="_blank" rel="noopener noreferrer">{event.source.title}</a><small>Даты проверены {new Date(event.verifiedAt).toLocaleString("ru-RU")}. Билеты и конкретные сеансы уточняются отдельно.</small></article>)}
  </details>;
}
