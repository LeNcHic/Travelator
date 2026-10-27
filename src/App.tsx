import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  ChevronRight,
  FolderHeart,
  Route,
  Trash2,
  Compass,
} from "lucide-react";
import { cities, cityIds } from "./data/catalog";
import { addDays, daysText, displayDate, money } from "./lib/format";
import { defaultInput, totals } from "./lib/planner";
import { searchLiveRoutes } from "./lib/live-route-search";
import type { LiveRouteProgress, LiveRouteResult } from "../shared/live-routes";
import { automaticPreferences } from "./lib/automatic-preferences";
import { hasExactDates } from "./lib/trip-timing";
import { tripKey } from "../shared/trip-key";
import type { RouteAdjustment } from "./lib/route-adjustments";
import { reconcileCityPlans } from "./lib/city-planner";
import {
  DRAFT_KEY,
  parseDraft,
  parseSaved,
  readStorage,
  SAVED_KEY,
  writeStorage,
} from "./lib/storage";
import type {
  AppSnapshot,
  RoutePlan,
  SavedTrip,
  Screen,
  TripInput,
  CityId,
} from "./types";
import CreateScreen from "./components/CreateScreen";
import CompareScreen from "./components/CompareScreen";
import PlanScreen from "./components/PlanScreen";
import Modal from "./components/Modal";
import { OfficialEventsContext, type EventState } from "./components/OfficialEvents";
import { searchOfficialEvents } from "./lib/official-events";
import OfferPicker from "./components/OfferPicker";
import { WeatherContext, type WeatherState } from "./components/Weather";
import { searchWeather } from "./lib/weather-search";
import { usePlannerTask } from "./lib/use-planner-task";
import type { WeatherDay } from "../shared/weather";
import type { VerifiedEvent } from "../shared/events";

const screens: { id: Screen; label: string }[] = [
  { id: "discover", label: "Подбор маршрута" },
  { id: "create", label: "Ваши пожелания" },
  { id: "compare", label: "Варианты поездки" },
  { id: "plan", label: "План путешествия" },
];

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(
    () => ({ ...(parseDraft(readStorage(DRAFT_KEY)) ?? {
        version: 1,
        input: automaticPreferences({ ...defaultInput(), days: 10 }),
        plan: null,
        screen: "discover",
        routeSource: "flyai",
      }), screen: "discover" }),
  );
  const [savedTrips, setSavedTrips] = useState(() =>
    parseSaved(readStorage(SAVED_KEY)),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [picker, setPicker] = useState<{
    type: "hotel" | "ticket";
    index: number;
  } | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [removed, setRemoved] = useState<SavedTrip | null>(null);
  const main = useRef<HTMLElement>(null);
  const { input, screen, plan } = snapshot;
  const routeSource = snapshot.routeSource ?? "flyai";
  const liveController = useRef<AbortController | null>(null);
  const [live, setLive] = useState<{
    key: string; status: "idle" | "loading" | "done" | "error" | "cancelled";
    progress?: LiveRouteProgress; result?: LiveRouteResult; error?: string;
  }>({ key: "", status: "idle" });
  const [routeUndo, setRouteUndo] = useState<{ snapshot: AppSnapshot; result?: LiveRouteResult; message: string; appliedKey: string } | null>(null);
  const [eventState, setEventState] = useState<EventState & { key: string; attempt?: number }>({ key: "", status: "idle" });
  const [eventAttempt, setEventAttempt] = useState(0);
  const eventKey = hasExactDates(input) ? JSON.stringify([input.startDate, input.days]) : "";
  const matchingEvents = eventState.key === eventKey ? eventState : { status: "idle" as const, key: eventKey };
  const conditionsKey = tripKey(input);
  const [appliedConditions, setAppliedConditions] = useState<{ key: string; dataKey: string; events: VerifiedEvent[]; weather: WeatherDay[] }>({ key: "", dataKey: "", events: [], weather: [] });
  const comparing = screen === "compare";
  const conditionsVisible = comparing || screen === "plan";
  const preliminaryTask = usePlannerTask({ kind: "routes", input }, comparing);
  const conditionsTask = usePlannerTask({ kind: "routes", input, events: appliedConditions.events, weather: appliedConditions.weather }, comparing && appliedConditions.key === conditionsKey);
  const preliminary = preliminaryTask.result ?? { plans: [], errors: [] };
  const localTask = appliedConditions.key === conditionsKey ? conditionsTask : preliminaryTask;
  const generated = appliedConditions.key === conditionsKey ? conditionsTask.result ?? preliminary : preliminary;
  const [weatherState, setWeatherState] = useState<WeatherState & { key: string; attempt?: number }>({ key: "", status: "idle" });
  const [weatherAttempt, setWeatherAttempt] = useState(0);
  const weatherCities = [...new Set([...preliminary.plans.flatMap(option => option.cities), ...(plan?.cities ?? []), ...input.required])].sort().slice(0,20);
  const weatherKey = hasExactDates(input) && weatherCities.length && (!comparing || preliminaryTask.status === "done") ? JSON.stringify({ cities: weatherCities, start: input.startDate, end: addDays(input.startDate, input.days - 1) }) : "";
  const matchingWeather = weatherState.key === weatherKey ? weatherState : { key: weatherKey, status: "idle" as const };
  const conditionsDataKey = JSON.stringify([matchingWeather.result?.updatedAt, matchingEvents.result?.searchedAt]);
  useEffect(() => {
    if (!weatherKey || !conditionsVisible) return;
    if (weatherState.key === weatherKey && weatherState.status === "done" && weatherState.attempt === weatherAttempt) return;
    const controller = new AbortController();
    setWeatherState(previous => ({ key: weatherKey, status: "loading", attempt: weatherAttempt, ...(previous.key === weatherKey ? { result: previous.result } : {}) }));
    void searchWeather(JSON.parse(weatherKey), controller.signal)
      .then(result => { if (!controller.signal.aborted) setWeatherState({ key: weatherKey, status: "done", result, attempt: weatherAttempt }); })
      .catch(error => { if (!controller.signal.aborted) setWeatherState({ key: weatherKey, status: "error", error: error instanceof Error && !["TypeError", "TimeoutError"].includes(error.name) ? error.message : "Не удалось получить погоду. Попробуйте позже." }); });
    return () => controller.abort();
  }, [weatherKey, conditionsVisible, weatherAttempt]);
  useEffect(() => {
    if (!eventKey || !conditionsVisible) return;
    if (eventState.key === eventKey && eventState.status === "done" && (eventState.attempt ?? 0) === eventAttempt) return;
    const controller = new AbortController(); setEventState(previous => ({ key: eventKey, status: "loading", attempt: eventAttempt, ...(previous.key === eventKey ? { result: previous.result } : {}) }));
    void searchOfficialEvents({ cities: cityIds, start: input.startDate, end: addDays(input.startDate, input.days - 1) }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setEventState({ key: eventKey, status: "done", result, attempt: eventAttempt }); })
      .catch(error => { if (!controller.signal.aborted) setEventState({ key: eventKey, status: "error", error: error instanceof Error && error.name !== "TypeError" ? error.message : "Не удалось проверить официальную афишу." }); });
    return () => controller.abort();
  }, [eventKey, conditionsVisible, eventAttempt]);
  const matchingLive = live.key === tripKey(input);
  const liveResult = matchingLive ? live.result : undefined;
  const fingerprint = JSON.stringify({ input, plan });
  const saved = savedTrips.some(
    (trip) =>
      JSON.stringify({ input: trip.input, plan: trip.plan }) === fingerprint,
  );

  useEffect(() => {
    if (!writeStorage(DRAFT_KEY, snapshot))
      setStorageWarning(
        "Браузер не разрешает сохранение. Изменения доступны до закрытия вкладки.",
      );
  }, [snapshot]);
  useEffect(() => {
    document.title = `${screens.find((s) => s.id === screen)!.label} — Travelator`;
    window.scrollTo({ top: 0, behavior: "instant" });
    main.current?.focus({ preventScroll: true });
  }, [screen]);
  useEffect(() => () => liveController.current?.abort(), []);

  async function startLiveSearch(searchInput: TripInput = input) {
    if (!hasExactDates(searchInput)) { setSnapshot(s => ({ ...s, screen: "create" })); return; }
    setSnapshot(s => ({ ...s, routeSource: "flyai" }));
    liveController.current?.abort();
    const controller = new AbortController();
    liveController.current = controller;
    const key = tripKey(searchInput);
    setLive({ key, status: "loading" });
    try {
      const result = await searchLiveRoutes(searchInput, controller.signal, progress => {
        if (!controller.signal.aborted) setLive({ key, status: "loading", progress });
      });
      if (!controller.signal.aborted) setLive({ key, status: "done", result });
    } catch (error) {
      if (!controller.signal.aborted) setLive({ key, status: "error", error: error instanceof Error && !["TypeError", "TimeoutError"].includes(error.name)
        ? error.message : "Поиск не ответил. Проверьте соединение и повторите попытку." });
    }
  }
  function cancelLiveSearch() {
    liveController.current?.abort();
    setLive(s => ({ key: s.key, status: "cancelled" }));
  }
  function changeRouteSource(source: "demo" | "flyai") {
    if (source === routeSource) return;
    liveController.current?.abort();
    setLive({ key: "", status: "idle" });
    setSnapshot(s => ({ ...s, routeSource: source }));
    setErrors([]);
  }

  function navigate(target: Screen, requested: TripInput = input) {
    const sameInput = tripKey(input) === tripKey(requested);
    setNotice("");
    if (target === "create" || target === "discover") {
      if (live.status === "loading") cancelLiveSearch();
      setSnapshot((s) => ({ ...s, screen: target }));
      return;
    }
    if (target === "plan" && plan && sameInput) {
      if (live.status === "loading") cancelLiveSearch();
      setSnapshot(s => ({ ...s, screen: "plan" }));
      return;
    }
    // Open comparison immediately. Validation and route search run in a cancellable worker.
    setErrors([]);
    setSnapshot(s => ({ ...s, input: requested, screen: "compare", plan: sameInput ? s.plan : null }));
  }

  function editInput(next: TripInput) {
    // Applying the same dates/preferences must not discard an already edited plan.
    if (tripKey(next) === tripKey(input)) return;
    liveController.current?.abort();
    setLive({ key: "", status: "idle" });
    setSnapshot((s) => ({ ...s, input: next, plan: null }));
    setErrors([]);
    setNotice("");
    setRouteUndo(null);
  }
  function adjustRoute(change: Pick<RouteAdjustment, "input" | "message">) {
    if (!change.input) return;
    liveController.current?.abort();
    setRouteUndo({ snapshot, result: matchingLive ? liveResult : undefined, message: change.message ?? "Пожелания обновлены.", appliedKey: tripKey(change.input) });
    setLive({ key: "", status: "idle" });
    setErrors([]);
    setNotice("");
    setSnapshot(s => ({ ...s, input: change.input!, plan: null, screen: "compare" }));
  }
  function undoRouteAdjustment() {
    if (!routeUndo || routeUndo.appliedKey !== tripKey(input)) return;
    liveController.current?.abort();
    setSnapshot({ ...routeUndo.snapshot, screen: "compare" });
    setLive(routeUndo.result ? { key: tripKey(routeUndo.snapshot.input), status: "done", result: routeUndo.result } : { key: "", status: "idle" });
    setRouteUndo(null);
    setNotice("");
    setErrors([]);
    requestAnimationFrame(() => { main.current?.focus({ preventScroll: true }); main.current?.scrollIntoView({ block: "start" }); });
  }
  function updatePlan(next: RoutePlan, message: string) {
    setSnapshot((s) => ({
      ...s,
      plan: reconcileCityPlans(next, s.input, s.plan?.visits),
    }));
    setNotice(message);
  }
  const choosePlan = useCallback((next: RoutePlan) => {
    liveController.current?.abort();
    setLive(previous => previous.status === "loading" ? { key: previous.key, status: "cancelled" } : previous);
    setSnapshot(previous => ({ ...previous, plan: reconcileCityPlans(next, previous.input), screen: "plan" }));
    setNotice("");
  }, []);
  function persistSaved(next: SavedTrip[]) {
    if (next.length > 20) {
      setNotice(
        "Можно хранить до 20 поездок. Сначала удалите ненужную поездку.",
      );
      return false;
    }
    if (!writeStorage(SAVED_KEY, next)) {
      setStorageWarning(
        "Не удалось сохранить поездку: хранилище браузера недоступно или заполнено.",
      );
      return false;
    }
    setSavedTrips(next);
    return true;
  }
  function savePlan() {
    if (!plan) return;
    if (saved) {
      setSavedOpen(true);
      return;
    }
    const entry: SavedTrip = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      input,
      plan,
    };
    if (savedTrips.length >= 20) {
      setNotice(
        "Можно хранить до 20 поездок. Удалите ненужную поездку в разделе «Мои поездки».",
      );
      setSavedOpen(true);
      return;
    }
    if (persistSaved([entry, ...savedTrips]))
      setNotice(
        "Поездка сохранена в этом браузере. Она доступна в разделе «Мои поездки».",
      );
  }
  return (
    <div id="travelator-screens">
      <a className="tv-skip-link" href="#main">
        Перейти к содержимому
      </a>
      <header className="tv-header">
        <button
          className="tv-logo"
          onClick={() => navigate("discover")}
          aria-label="Travelator — составить маршрут"
        >
          <Compass />
          <span>
            travelator<span className="tv-logo-dot">.</span>
          </span>
        </button>
        <nav className="app-navigation" aria-label="Основная навигация"><button aria-current={screen === "discover" || screen === "create" ? "page" : undefined} onClick={() => navigate("discover")}>Составить маршрут</button><button aria-current={screen === "plan" ? "page" : undefined} onClick={() => navigate(plan ? "plan" : "create")}>Моя поездка</button></nav>
        <button
          className="tv-button tv-header-saved"
          onClick={() => setSavedOpen(true)}
        >
          <FolderHeart />
          <span>Сохранённое</span>
          {savedTrips.length > 0 && (
            <span className="tv-count">{savedTrips.length}</span>
          )}
        </button>
      </header>
      {storageWarning && (
        <div className="tv-storage-warning" role="alert">
          {storageWarning}
        </div>
      )}
      <OfficialEventsContext value={{ ...matchingEvents, retry: () => setEventAttempt(value => value + 1) }}>
      <WeatherContext value={{ ...matchingWeather, applied: appliedConditions.key === conditionsKey && Boolean(conditionsTask.result) && appliedConditions.dataKey === conditionsDataKey, calculating: comparing && appliedConditions.key === conditionsKey && conditionsTask.status === "loading", retry: () => setWeatherAttempt(value => value + 1), apply: () => {
        if (live.status === "loading") cancelLiveSearch();
        setAppliedConditions({ key: conditionsKey, dataKey: conditionsDataKey, events: matchingEvents.result?.events ?? [], weather: matchingWeather.result?.days ?? [] });
        setSnapshot(previous => ({ ...previous, screen: "compare", routeSource: "demo" }));
        setNotice("Показаны новые предварительные рекомендации. Выбранный план сохранён; цены можно уточнить отдельно.");
        requestAnimationFrame(() => main.current?.scrollIntoView({ block: "start" }));
      } }}>
      <main id="main" ref={main} tabIndex={-1}>
        {(screen === "compare" || screen === "plan") && <nav className="trip-stage-nav" aria-label="Этапы поездки">{([
          ["create", "Пожелания"], ["compare", "Маршруты"], ["plan", "Мой план"],
        ] as const).map(([id, label], index) => <button key={id} type="button" aria-current={screen === id ? "step" : undefined} disabled={id === "plan" && !plan} onClick={() => navigate(id)}><span>{index + 1}</span>{label}{index < 2 && <ChevronRight />}</button>)}</nav>}
        {(screen === "create" || screen === "discover") && (
          <CreateScreen
            key={screen}
            home={screen === "discover"}
            onContinue={plan ? () => navigate("plan") : undefined}
            input={input}
            onChange={editInput}
            errors={errors}
            onSubmit={(next) => navigate("compare", next)}
            onRecover={adjustRoute}
            routeSource={routeSource}
            onRouteSource={changeRouteSource}
          />
        )}
        {screen === "compare" && (
          <CompareScreen
            input={input}
            plans={routeSource === "flyai" && liveResult?.plans.length ? liveResult.plans : generated.plans}
            currentPlan={plan}
            errors={routeSource === "flyai" ? [...generated.errors, ...(matchingLive && live.error ? [live.error] : liveResult?.errors ?? [])] : generated.errors}
            routeSource={routeSource}
            onRouteSource={changeRouteSource}
            calculationStatus={localTask.status === "idle" ? "loading" : localTask.status}
            calculationError={localTask.error}
            onRetryCalculation={localTask.retry}
            liveStatus={matchingLive ? live.status : "idle"}
            liveProgress={matchingLive ? live.progress : undefined}
            liveResult={liveResult}
            onSearch={() => void startLiveSearch()}
            onCancel={cancelLiveSearch}
            onEdit={() => navigate("create")}
            onAdjust={adjustRoute}
            onRecover={adjustRoute}
            adjustmentNotice={routeUndo?.appliedKey === tripKey(input) ? routeUndo.message : undefined}
            onUndoAdjustment={undoRouteAdjustment}
            onSelect={choosePlan}
          />
        )}
        {screen === "plan" && plan && (
          <PlanScreen
            input={input}
            plan={plan}
            saved={saved}
            onBack={() => navigate("compare")}
            onSave={savePlan}
            onChange={updatePlan}
            onHotel={(index) => setPicker({ type: "hotel", index })}
            onTicket={(index) => setPicker({ type: "ticket", index })}
            notice={notice}
          />
        )}
      </main>
      </WeatherContext>
      </OfficialEventsContext>
      <footer className="tv-app-footer">
        <div><strong>travelator.</strong><span>Маршруты под ваши пожелания.</span></div>
        <div><a href="/images/china/credits.html" target="_blank" rel="noopener noreferrer">Авторы фотографий</a><details><summary>О данных поездки</summary><p>Travelator помогает спланировать поездку. Стоимость первых вариантов ориентировочная. Расписания можно проверить через <a href="https://api.railgo.dev/" target="_blank" rel="noopener noreferrer">RailGo</a>, гостиницы — через Fliggy. Тарифы поездов оценочные; авиабилеты используют поисковую цену, если выбран реальный рейс. Бронирование и условия — на сайте поставщика.</p><p>Справочник станций — <a href="https://kyfw.12306.cn/otn/resources/js/framework/station_name.js" target="_blank" rel="noopener noreferrer">12306</a>. Справочник аэропортов — <a href="https://openflights.org/data.html" target="_blank" rel="noopener noreferrer">OpenFlights</a>, ODbL. Справочники не подтверждают наличие рейсов. Погода — <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>, CC BY 4.0. Координаты мест, длительность программы, цены и связи предварительного каталога — ориентировочные оценки.</p></details></div>
      </footer>
      {picker && plan && (
        <OfferPicker
          {...picker}
          input={input}
          plan={plan}
          onClose={() => setPicker(null)}
          onDates={() => { setPicker(null); navigate("create"); }}
          onChange={updatePlan}
        />
      )}
      {savedOpen && (
        <Modal title="Мои поездки" onClose={() => setSavedOpen(false)}>
          <p className="tv-picker-intro">
            Сохраняются только в этом браузере. Очистка данных сайта удалит
            сохранённые поездки.
          </p>
          {removed && (
            <p className="tv-undo">
              Поездка удалена.
              <button
                onClick={() => {
                  if (persistSaved([removed, ...savedTrips])) setRemoved(null);
                }}
              >
                Отменить
              </button>
            </p>
          )}
          {savedTrips.length === 0 ? (
            <div className="tv-empty">
              <Bookmark />
              <h3>Здесь будут ваши путешествия</h3>
              <p>Создайте маршрут и нажмите «Сохранить план».</p>
              <button
                className="tv-button tv-primary"
                onClick={() => {
                  setSavedOpen(false);
                  navigate("create");
                }}
              >
                Создать поездку
                <ArrowRight />
              </button>
            </div>
          ) : (
            <div className="tv-saved-list">
              {savedTrips.map((trip) => (
                <article className="tv-saved-card" key={trip.id}>
                  <div>
                    <p className="tv-eyebrow">
                      {hasExactDates(trip.input) ? displayDate(trip.input.startDate) : "Без точных дат"} ·{" "}
                      {daysText(trip.input.days)}
                    </p>
                    <h3>
                      {trip.plan.cities
                        .map((id) => cities[id].name)
                        .join(" → ")}
                    </h3>
                    <p>
                      {money(totals(trip.plan, trip.input).total)} · сохранено{" "}
                      {new Date(trip.savedAt).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <div className="tv-saved-actions">
                    <button
                      className="tv-button tv-secondary"
                      onClick={() => {
                        liveController.current?.abort();
                        setLive({ key: "", status: "idle" });
                        setRouteUndo(null);
                        setSnapshot({
                          version: 1,
                          input: trip.input,
                          plan: trip.plan,
                          screen: "plan",
                          routeSource,
                        });
                        setSavedOpen(false);
                        setNotice("Открыта сохранённая поездка.");
                      }}
                    >
                      Открыть
                      <ArrowRight />
                    </button>
                    <button
                      className="tv-icon-button"
                      aria-label={`Удалить поездку от ${displayDate(trip.input.startDate)}`}
                      onClick={() => {
                        if (
                          persistSaved(
                            savedTrips.filter((t) => t.id !== trip.id),
                          )
                        )
                          setRemoved(trip);
                      }}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
