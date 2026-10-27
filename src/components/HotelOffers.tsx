import { useEffect, useState } from "react";
import { BedDouble, Check, RefreshCw, Star } from "lucide-react";
import type { HotelProviderId, HotelProviderStatus, HotelSearchResult } from "../../shared/hotels";
import type { RoutePlan, TripInput } from "../types";
import { hotelSearchRequest, getHotelProviders, searchHotels } from "../lib/hotel-search";
import { money } from "../lib/format";
import { totals, selectFlyaiHotel, selectDemoHotel } from "../lib/planner";
import FlyaiOffers from "./FlyaiOffers";
import { hotelsIn } from "../data/catalog";
import HotelSource from "./HotelSource";

export default function HotelOffers({ index, input, plan, onChange, onClose }: {
  index: number; input: TripInput; plan: RoutePlan;
  onChange: (plan: RoutePlan, notice: string) => void; onClose: () => void;
}) {
  const [provider, setProvider] = useState<HotelProviderId | "flyai">("flyai");
  const [statuses, setStatuses] = useState<HotelProviderStatus[]>([]);
  const [result, setResult] = useState<HotelSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const query = JSON.stringify(hotelSearchRequest(plan, input, index, provider === "flyai" ? "demo" : provider));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null); setStatuses([]);
    if (provider === "flyai") { setLoading(false); return () => controller.abort(); }
    async function load() {
      try {
        const { providers } = await getHotelProviders(controller.signal);
        if (controller.signal.aborted) return;
        setStatuses(providers);
        const status = providers.find(item => item.id === provider);
        if (!status?.available) return;
        const response = await searchHotels(JSON.parse(query), controller.signal);
        if (!controller.signal.aborted) setResult(response);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error && err.name !== "TimeoutError" && err.name !== "TypeError"
          ? err.message : "Поиск не ответил. Проверьте соединение и повторите попытку.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [query, provider, attempt]);

  const status = statuses.find(item => item.id === provider);
  return <>
    <div className="tv-hotel-sources" role="group" aria-label="Источник гостиниц">
      <button type="button" aria-pressed={provider === "demo"} onClick={() => setProvider("demo")}>Тестовый каталог</button>
      <button type="button" aria-pressed={provider === "flyai"} onClick={() => setProvider("flyai")}>Fliggy · реальные</button>
      <button type="button" aria-pressed={provider === "ostrovok"} onClick={() => setProvider("ostrovok")}>Островок <span>Скоро</span></button>
    </div>
    {provider === "flyai" ? <FlyaiOffers
      query={{ kind: "hotel", city: plan.cities[index], checkIn: JSON.parse(query).checkIn, checkOut: JSON.parse(query).checkOut }}
      selectedHotelId={plan.hotelQuotes?.[plan.cities[index]]?.hotelId}
      routeTotal={quote => { const next = selectFlyaiHotel(plan, input, index, quote); return next ? totals(next, input).total : null; }}
      onSelectHotel={quote => {
        const next = selectFlyaiHotel(plan, input, index, quote);
        if (!next) return;
        onChange(next, `Выбрана гостиница ${quote.name}. Бюджет пересчитан по поисковой цене FlyAI; окончательную сумму уточните на Fliggy.`);
        onClose();
      }} /> : <>
    {provider === "demo" && <p className="tv-demo-note">Учебные цены и гостиницы. Выбор добавляет гостиницу в план; бронирование и оплата недоступны.</p>}
    <div aria-live="polite" aria-busy={loading}>
      {loading && <p className="tv-hotel-state" role="status">Ищем гостиницы на даты остановки…</p>}
      {error && <div className="tv-hotel-state" role="alert"><p>{error}</p><button className="tv-button tv-secondary" onClick={() => setAttempt(value => value + 1)}><RefreshCw />Повторить поиск</button></div>}
      {!loading && !error && status && !status.available && <div className="tv-hotel-state">
        <BedDouble size={28} /><h3>Островок ещё не подключён</h3><p>{status.message}</p>
        <p>Город и даты проживания уже берём из маршрута. Пока можно выбрать гостиницу из тестового каталога.</p>
        <button className="tv-button tv-secondary" onClick={() => setProvider("demo")}>К тестовым предложениям</button>
      </div>}
      {!loading && !error && result?.offers.length === 0 && <div className="tv-hotel-state"><h3>Гостиницы не найдены</h3><p>На эти даты нет предложений. Попробуйте другие даты проживания.</p></div>}
    </div>
    {!loading && !error && result?.provider === provider && result.offers.map(offer => {
      // Only validated catalog entries can replace the fallback hotel.
      const localHotel = result.isDemo && offer.provider === "demo"
        ? hotelsIn(plan.cities[index]).find(hotel => hotel.id === offer.catalogHotelId) : undefined;
      const selected = Boolean(localHotel && plan.hotels[index] === localHotel.id && !plan.hotelQuotes?.[plan.cities[index]]);
      const next = localHotel ? selectDemoHotel(plan, index, localHotel.id) : plan;
      return <article className={`tv-offer ${selected ? "tv-offer-selected" : ""}`} key={offer.id}>
        <HotelSource source="demo" />
        <div className="tv-offer-top">
          <span className="tv-offer-symbol"><BedDouble /></span>
          <div><span className="tv-stars" aria-label={`${offer.stars} звезды`}>{"★".repeat(offer.stars)}</span><h3>{offer.name}</h3><p>{offer.area}</p></div>
          {offer.rating && <span className="tv-rating"><Star />{offer.rating}</span>}
        </div>
        <div className="tv-offer-features">{offer.features.map(feature => <span key={feature}><Check />{feature}</span>)}</div>
        <div className="tv-offer-bottom">
          <div><strong>{money(offer.total)}</strong><small>за всё проживание · {money(offer.total / offer.nights)} / ночь</small><small>{localHotel ? `Вся поездка ${money(totals(next, input).total)}` : "Выбор пока недоступен"}</small></div>
          <button className={`tv-button ${selected ? "tv-secondary" : "tv-primary"}`} disabled={selected || !localHotel} onClick={() => {
            if (!localHotel) return;
            onChange(next, `Выбрана гостиница ${offer.name}. Стоимость поездки обновлена.`); onClose();
          }}>{selected ? <><Check />В плане</> : "Выбрать"}</button>
        </div>
      </article>;
    })}
    </>}
  </>;
}
