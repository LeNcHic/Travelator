export default function RouteSource({ value, onChange }: {
  value: "demo" | "flyai"; onChange: (value: "demo" | "flyai") => void;
}) {
  return <div className="tv-route-source">
    <div className="tv-hotel-sources" role="group" aria-label="Данные для подбора маршрута">
      <button type="button" aria-pressed={value === "flyai"} onClick={() => onChange("flyai")}>RailGo + гостиницы Fliggy</button>
      <button type="button" aria-pressed={value === "demo"} onClick={() => onChange("demo")}>Тестовый каталог</button>
    </div>
    <p className="tv-hint">{value === "flyai"
      ? "Расписания RailGo на выбранную дату, поезда до 2 часов. Дальние перелёты — тестовые этапы. RailGo не сообщает цены и наличие мест: стоимость поездов оценочная. Гостиницы — поисковые цены Fliggy за ночь × ночи."
      : "Учебный каталог работает без интернета: поезда, самолёты и гостиницы с тестовыми ценами."}</p>
  </div>;
}
