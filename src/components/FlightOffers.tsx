import { BusyIcon } from "./LoadingStatus";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Plane, Search } from "lucide-react";
import { airlineLabel, airportLabel, cabinLabel, flightQuoteKey, validFlightQuote, type FlightQuery, type FlightQuote, type FlightResult } from "../../shared/flights";
import { duration, money } from "../lib/format";

export default function FlightOffers({ query, selected, preview, onSelect }: {
  query: FlightQuery; selected?: FlightQuote;
  preview: (quote: FlightQuote) => { total: number; outdatedHotels: number; outdatedFlights: number; outdatedTrains: number } | null;
  onSelect: (quote: FlightQuote) => void;
}) {
  const [response, setResponse] = useState<FlightResult | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null), key = JSON.stringify(query);
  const result = response && JSON.stringify(response.query) === key ? response : null;
  useEffect(() => { setResponse(null); setError(""); setLoading(false); return () => controller.current?.abort(); }, [key]);
  async function search() {
    controller.current?.abort(); const active = new AbortController(); controller.current = active;
    setLoading(true); setError(""); setResponse(null);
    try {
      const res = await fetch("/api/flights/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: key, signal: AbortSignal.any([active.signal, AbortSignal.timeout(40000)]) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Поиск авиабилетов не ответил.");
      if (data?.source !== "flyai" || JSON.stringify(data.query) !== key || !Array.isArray(data.offers)
        || data.offers.length > 20 || !data.offers.every((offer: { quote: unknown }) => validFlightQuote(offer.quote))) throw new Error("Сервер вернул неполные авиабилеты. Повторите поиск.");
      if (!active.signal.aborted) setResponse(data);
    } catch (err) { if (!active.signal.aborted) setError(err instanceof Error && !["TypeError", "TimeoutError"].includes(err.name) ? err.message : "Не удалось получить авиабилеты. Повторите позже."); }
    finally { if (!active.signal.aborted) setLoading(false); }
  }
  return <section className="tv-flyai" aria-label="Реальные авиабилеты">
    <div className="tv-flyai-intro"><span className="tv-eyebrow">АВИАБИЛЕТЫ · FLYAI / FLIGGY</span><h3>Прямые рейсы на дату переезда</h3><p>Один пассажир, экономкласс. Тариф из поиска заменит учебную цену в бюджете. Багаж, сборы, условия возврата и окончательную сумму уточняйте у поставщика.</p>
      <button className="tv-button tv-primary" disabled={loading} onClick={search}>{loading ? <BusyIcon /> : <Search />}{loading ? "Ищем рейсы…" : result || error ? "Обновить авиабилеты" : "Найти авиабилеты"}</button></div>
    <div aria-live="polite" aria-busy={loading}>{error && <p className="tv-hotel-state" role="alert">{error}</p>}{result && <p className="tv-hint">Найдено рейсов: {result.offers.length}. Проверено {new Date(result.searchedAt).toLocaleString("ru-RU")}. Время местное, Китай.</p>}{result?.access === "trial" && <p>Для полных тарифов нужен личный ключ FlyAI на сервере.</p>}{result && !result.offers.length && <p className="tv-hotel-state">Подходящих рейсов не найдено. Попробуйте другую дату.</p>}</div>
    <div className="tv-offers">{result?.offers.map(({ quote, url }) => {
      const changed = preview(quote), chosen = selected && flightQuoteKey(selected) === flightQuoteKey(quote);
      return <article className="tv-offer" key={flightQuoteKey(quote)}><div className="tv-offer-top"><span className="tv-offer-symbol"><Plane /></span><div><h3>{airlineLabel(quote.airlineCode)} · {quote.flightNumber}</h3><p>{airportLabel(quote.fromAirport)} → {airportLabel(quote.toAirport)}</p><p>{cabinLabel(quote.cabin)} · прямой рейс</p></div></div>
        <div className="tv-ticket-time"><strong>{quote.departure.slice(11, 16)}</strong><span>{duration(quote.minutes)}<span className="tv-ticket-line" /></span><strong>{quote.arrival.slice(11, 16)}{quote.departure.slice(0, 10) !== quote.arrival.slice(0, 10) && <small>+1 день</small>}</strong></div>
        <div className="tv-offer-bottom"><div><strong>{money(quote.amount)}</strong><small>Тариф на одного пассажира · сборы уточняются</small>{changed && <small>Вся поездка ≈ {money(changed.total)}</small>}</div>{typeof url === "string" && url.startsWith("https://router.feizhu.com/ws/") && <a className="tv-button tv-secondary" href={url} target="_blank" rel="noopener noreferrer">На Fliggy<ExternalLink size={16} /></a>}</div>
        {!changed && <p className="tv-over-budget">Этот рейс не совпадает с календарём остановок. В автоматическом плане пока используем прибытие в тот же день.</p>}
        {changed && changed.outdatedHotels + changed.outdatedFlights + changed.outdatedTrains > 0 && <p className="tv-hint">Для изменившихся дат потребуется обновить часть предложений.</p>}
        <button className="tv-button tv-primary" disabled={!changed} onClick={() => onSelect(quote)}>{chosen ? "Обновить тариф в плане" : "Выбрать рейс"}</button>
      </article>;
    })}</div>
  </section>;
}
