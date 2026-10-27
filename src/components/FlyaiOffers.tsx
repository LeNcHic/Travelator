import { BusyIcon } from "./LoadingStatus";
import HotelSource from "./HotelSource";
import { useEffect, useRef, useState } from "react";
import { BedDouble, ExternalLink, Search, TrainFront } from "lucide-react";
import { trainQuoteKey, validHotelQuote, validTrainQuote, type FlyaiHotelQuote, type FlyaiTrainQuote, type FlyaiQuery, type FlyaiResult } from "../../shared/flyai";
import { duration, money, nightsText } from "../lib/format";

export default function FlyaiOffers({ query, onSelectHotel, routeTotal, selectedHotelId, onSelectTrain, trainPreview, selectedTrainKey }: {
  query: FlyaiQuery;
  onSelectHotel?: (quote: FlyaiHotelQuote) => void;
  routeTotal?: (quote: FlyaiHotelQuote) => number | null;
  selectedHotelId?: string;
  onSelectTrain?: (quote: FlyaiTrainQuote) => void;
  trainPreview?: (quote: FlyaiTrainQuote) => { total: number; nights: number; transferDays: number; daysChanged: boolean; outdatedHotels: number; outdatedTrains: number } | null;
  selectedTrainKey?: string;
}) {
  const [searchResult, setResult] = useState<FlyaiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const queryKey = JSON.stringify(query);
  const result = searchResult && JSON.stringify(searchResult.query) === queryKey ? searchResult : null;
  const nights = query.kind === "hotel" ? (Date.parse(query.checkOut) - Date.parse(query.checkIn)) / 86400000 : 0;
  useEffect(() => {
    setResult(null); setError(""); setLoading(false);
    return () => controller.current?.abort();
  }, [queryKey]);

  async function search() {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/flyai/search", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: queryKey,
        signal: AbortSignal.any([active.signal, AbortSignal.timeout(40000)]),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.source !== "flyai" || !Array.isArray(data.offers)) throw new Error(data?.error?.message || "Не удалось получить предложения FlyAI.");
      if (!active.signal.aborted) setResult(data);
    } catch (err) {
      if (!active.signal.aborted) setError(err instanceof Error && !["TimeoutError", "TypeError"].includes(err.name)
        ? err.message : "Поиск не ответил. Проверьте соединение и попробуйте ещё раз.");
    } finally { if (!active.signal.aborted) setLoading(false); }
  }

  return <section className="tv-flyai" aria-label="Предложения FlyAI">
    <div className="tv-flyai-intro">
      <span className="tv-eyebrow">FLYAI · FLIGGY</span>
      <h3>Реальные предложения из Китая</h3>
      <p>{query.kind === "hotel"
        ? "Выберите гостиницу, чтобы пересчитать бюджет. Цена из поиска — ориентир за ночь; умножаем её на число ночей. Тип размещения, состав гостей, сборы и условия уточняйте на Fliggy. Итоговая цена может отличаться."
        : "Выберите поезд, чтобы учесть его цену и расписание в плане. Цена из поиска — на одного пассажира в указанном классе. Наличие мест и окончательную стоимость уточняйте на Fliggy."}</p>
      {result?.access === "trial" && <p>Для добавления цены в бюджет нужен личный ключ FlyAI на сервере.</p>}
      {result?.limited && <p>Некоторые цены недоступны или скрыты, например «5xx». Они показаны в исходном виде.</p>}
      {query.kind === "train" && <p>Ищем прямые поезда на ближайшие 15 дней. Для более поздних поездок поиск будет доступен ближе к отправлению.</p>}
      <button className="tv-button tv-primary" disabled={loading} onClick={search}>{loading ? <BusyIcon /> : <Search />}{loading ? "Ищем предложения…" : result || error ? "Повторить поиск" : query.kind === "hotel" ? "Найти гостиницы на Fliggy" : "Найти поезда на Fliggy"}</button>
    </div>
    <div aria-live="polite" aria-busy={loading}>
      {loading && <p className="tv-hint" role="status">Получаем предложения на даты маршрута. Обычно это занимает несколько секунд.</p>}
      {error && <p className="tv-hotel-state" role="alert">{error}</p>}
      {result && <p className="tv-hint">Найдено: {result.offers.length} · Проверено {new Date(result.searchedAt).toLocaleString("ru-RU")}{query.kind === "train" ? " · время поездов местное, Китай" : " · CNY"}</p>}
      {result?.offers.length === 0 && <p className="tv-hotel-state">На эти даты предложений нет. Попробуйте изменить даты поездки.</p>}
    </div>
    <div className="tv-offers">{result?.offers.map(offer => {
      const quote = result.access === "personal_key" && query.kind === "hotel" && validHotelQuote(offer.hotelQuote)
        && offer.hotelQuote.city === query.city && offer.hotelQuote.checkIn === query.checkIn
        && offer.hotelQuote.checkOut === query.checkOut ? offer.hotelQuote : undefined;
      const total = quote ? routeTotal?.(quote) : null;
      const train = result.access === "personal_key" && query.kind === "train" && validTrainQuote(offer.trainQuote)
        && offer.trainQuote.from === query.from && offer.trainQuote.to === query.to
        && offer.trainQuote.departure.slice(0, 10) === query.date ? offer.trainQuote : undefined;
      const preview = train ? trainPreview?.(train) : null;
      const selectedTrain = train && selectedTrainKey === trainQuoteKey(train);
      return <article className="tv-offer" key={offer.id}>
      {query.kind === "hotel" && <HotelSource source="flyai" checkedAt={quote?.searchedAt ?? result.searchedAt} />}
      <div className="tv-offer-top"><span className="tv-offer-symbol">{query.kind === "hotel" ? <BedDouble /> : <TrainFront />}</span><div><h3>{offer.name}</h3><p>{offer.description}</p></div></div>
      {quote && <p className="tv-hint">{quote.distanceKm === undefined ? "Расстояние до центра не уточнено." : `${quote.distanceKm.toLocaleString("ru-RU")} км от центра остановки по прямой.`}
        {quote.distanceKm !== undefined && quote.distanceKm > 25 && " Далеко от центра — в автоматический подбор не включаем."}</p>}
      {offer.departure && offer.arrival && <div className="tv-ticket-time">
        <strong>{offer.departure.slice(11, 16)}</strong><span>{duration(offer.minutes!)}<span className="tv-ticket-line" /></span><strong>{offer.arrival.slice(11, 16)}{offer.arrival.slice(0, 10) !== offer.departure.slice(0, 10) && <small>{offer.arrival.slice(0, 10)}</small>}</strong>
      </div>}
      <div className="tv-offer-bottom"><div><strong>{quote ? `≈ ${money(Math.round(quote.nightly * 100) * nights / 100)}` : /^(?:¥\s*)?\d+(?:\.\d{1,2})?$/.test(offer.priceLabel) ? (offer.priceLabel.startsWith("¥") ? offer.priceLabel : `¥ ${offer.priceLabel}`) : "Цена на Fliggy"}</strong>
        <small>{quote ? `За ${nightsText(nights)} · ${money(quote.nightly)} / ночь` : `Цена из поиска: ${offer.priceLabel}`}</small>
        {train && <small>На одного пассажира · CNY</small>}
        {(total != null || preview) && <small>Внутри Китая ≈ {money(preview?.total ?? total!)}</small>}
        {selectedTrain && <small>Этот поезд в плане · можно обновить цену</small>}
        {selectedHotelId === quote?.hotelId && quote && <small>Эта гостиница в плане · можно обновить цену</small>}
        </div>
        {offer.url ? <a className="tv-button tv-secondary" href={offer.url} target="_blank" rel="noopener noreferrer">Посмотреть <ExternalLink size={16} /><span className="tv-sr-only"> на Fliggy, новая вкладка</span></a> : <small>Ссылка недоступна</small>}
      </div>
      {quote && onSelectHotel && <button className="tv-button tv-primary" onClick={() => onSelectHotel(quote)}>{selectedHotelId === quote.hotelId ? "Обновить цену в плане" : "Выбрать для расчёта"}</button>}
      {train && onSelectTrain && <>
        {preview ? <p className="tv-hint">В плане: {preview.transferDays} дн. на переезды, {nightsText(preview.nights)} в гостиницах.
          {preview.daysChanged && " Дни в городах будут перераспределены после этого переезда."}
          {(preview.outdatedHotels > 0 || preview.outdatedTrains > 0) && " Для изменившихся дат потребуется повторный поиск предложений; временно будут учтены тестовые варианты."}
          {" "}Добавляем 60 минут запаса на вокзалы; время отправления и прибытия — по расписанию FlyAI.</p>
          : <p className="tv-over-budget">Не хватает дней после переезда. Измените длительность остановок или поездки и повторите поиск: дату отправления выбранного поезда сохраняем.</p>}
        <button className="tv-button tv-primary" disabled={!preview} onClick={() => onSelectTrain(train)}>{selectedTrain ? "Обновить поезд в плане" : "Выбрать поезд"}</button>
      </>}
      {query.kind === "train" && !train && <p className="tv-hint">Для выбора нужны полная цена, станции, класс и корректное расписание с личным ключом FlyAI.</p>}
    </article>})}</div>
  </section>;
}
