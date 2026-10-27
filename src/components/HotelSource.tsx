import { Check, Wallet, RefreshCw } from "lucide-react";

export default function HotelSource({ source, checkedAt }: {
  source: "flyai" | "demo" | "outdated";
  checkedAt?: string;
}) {
  const date = checkedAt ? new Date(checkedAt) : null;
  const validDate = date && Number.isFinite(date.getTime());
  const labels = { flyai: "FlyAI / Fliggy", demo: "Ориентир по стоимости", outdated: "Нужно обновить" };
  const Icon = source === "flyai" ? Check : source === "outdated" ? RefreshCw : Wallet;
  return <span className={`hotel-source hotel-source-${source}`} aria-label="Источник предложения гостиницы">
    <span className="hotel-source-badge" title={source === "flyai" ? "Предложение из поиска Fliggy через FlyAI. Цена и наличие могут измениться." : undefined}><Icon aria-hidden="true" />{labels[source]}</span>
    {source === "flyai" ? validDate ? <time dateTime={checkedAt}>Проверено {new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(date)} МСК</time> : <span>Время проверки неизвестно</span>
      : <span>{source === "outdated" ? "Даты изменились · стоимость ориентировочная" : "Цена требует уточнения"}</span>}
  </span>;
}
