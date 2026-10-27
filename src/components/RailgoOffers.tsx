import { BusyIcon } from "./LoadingStatus";
import { useEffect, useRef, useState } from "react";
import { Search, TrainFront } from "lucide-react";
import { trainQuoteKey, validTrainQuote, type RailgoTrainQuote } from "../../shared/flyai";
import type { RailgoQuery, RailgoResult } from "../../shared/railgo";
import { duration, money } from "../lib/format";

export default function RailgoOffers({ query, selectedKey, preview, onSelect }: {
  query: RailgoQuery; selectedKey?: string;
  preview: (quote: RailgoTrainQuote) => { total: number; changed: boolean } | null;
  onSelect: (quote: RailgoTrainQuote) => void;
}) {
  const [result, setResult] = useState<RailgoResult | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null), key = JSON.stringify(query);
  useEffect(() => { setResult(null); setError(""); setLoading(false); return () => controller.current?.abort(); }, [key]);
  const visible = result && JSON.stringify(result.query) === key ? result : null;
  async function search() {
    controller.current?.abort();
    const active = new AbortController(); controller.current = active;
    setLoading(true); setResult(null); setError("");
    try {
      const response = await fetch("/api/railgo/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: key,
        signal: AbortSignal.any([active.signal, AbortSignal.timeout(20000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Не удалось проверить расписание RailGo.");
      if (data?.source !== "railgo" || JSON.stringify(data.query) !== key || data.maxMinutes !== 120 || !Number.isFinite(Date.parse(data.searchedAt))
        || !Array.isArray(data.trains) || !data.trains.every((q: unknown) => validTrainQuote(q) && q.source === "railgo"
          && q.from === query.from && q.to === query.to && q.departure.startsWith(query.date + " "))) throw new Error("RailGo вернул неполное расписание. Повторите поиск.");
      if (!active.signal.aborted) setResult(data);
    } catch (err) { if (!active.signal.aborted) setError(err instanceof Error && !["TypeError", "TimeoutError"].includes(err.name) ? err.message : "Расписание пока недоступно. Повторите поиск позже."); }
    finally { if (!active.signal.aborted) setLoading(false); }
  }
  return <section className="tv-flyai" aria-label="Расписание поездов RailGo">
    <div className="tv-flyai-intro"><span className="tv-eyebrow">RAILGO · ПОЕЗДА ДО 2 ЧАСОВ</span><h3>Короткий переезд на поезде</h3>
      <p>Проверяем дни курсирования и расписание на вашу дату. Время местное, Китай. Ещё 60 минут закладываем на вокзалы.</p>
      <p>RailGo не возвращает цены и наличие мест. Сумма в бюджете — тестовый ориентир, её нужно уточнить перед покупкой. Расписание также может измениться.</p>
      <button className="tv-button tv-primary" disabled={loading} onClick={search}>{loading ? <BusyIcon /> : <Search />}{loading ? "Проверяем расписание…" : visible || error ? "Обновить расписание" : "Найти поезда до 2 часов"}</button>
    </div>
    <div aria-live="polite" aria-busy={loading}>
      {error && <p className="tv-hotel-state" role="alert">{error}</p>}
      {visible && <p className="tv-hint">Подходящих поездов: {visible.trains.length} · Проверено {new Date(visible.searchedAt).toLocaleString("ru-RU")}</p>}
      {visible?.trains.length === 0 && <p className="tv-hotel-state">Поездов до 2 часов на эту дату не найдено. Более долгие поезда не входят в подбор, а расписание на дальние даты может быть ещё не опубликовано.</p>}
    </div>
    <div className="tv-offers">{visible?.trains.slice(0, 20).map(quote => {
      const next = preview(quote), selected = trainQuoteKey(quote) === selectedKey;
      return <article className={`tv-offer ${selected ? "tv-offer-selected" : ""}`} key={trainQuoteKey(quote)}>
        <div className="tv-offer-top"><span className="tv-offer-symbol"><TrainFront /></span><div><h3>{quote.trainNumber}</h3><p>{quote.fromStation} → {quote.toStation}</p></div></div>
        <div className="tv-ticket-time"><strong>{quote.departure.slice(11, 16)}</strong><span>{duration(quote.minutes)}<span className="tv-ticket-line" /></span><strong>{quote.arrival.slice(11, 16)}{quote.arrival.slice(0, 10) !== query.date && <small>+1 день</small>}</strong></div>
        <div className="tv-offer-bottom"><div><strong>≈ {money(quote.amount)}</strong><small>Тестовая оценка билета · цена RailGo неизвестна</small>{next && <small>Внутри Китая ≈ {money(next.total)}</small>}</div>
          <button className="tv-button tv-primary" disabled={!next} onClick={() => onSelect(quote)}>{selected ? "Обновить расписание" : "Выбрать поезд"}</button></div>
        {!next && <p className="tv-over-budget">Этот поезд не помещается в текущий календарь. Измените длительность поездки.</p>}
        {next?.changed && <p className="tv-hint">Дни в городах перераспределятся; гостиничные цены на изменившиеся даты нужно обновить.</p>}
      </article>;
    })}</div>
    {visible && visible.trains.length > 20 && <p className="tv-hint">Показаны 20 самых быстрых подходящих поездов.</p>}
    <p className="tv-hint">Источник расписания: <a href="https://api.railgo.dev/" target="_blank" rel="noopener noreferrer">RailGo</a>. Наличие мест не проверено.</p>
  </section>;
}
