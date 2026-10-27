import airportDirectory from "./airports.json";
import { CITY_IDS } from "./cities";
import { chinaDateTime, parseFlyaiPrice } from "./flyai";
import type { CityId } from "../src/types";

export interface FlightQuery { from: CityId; to: CityId; date: string }
export interface FlightQuote {
  source: "flyai";
  from: CityId;
  to: CityId;
  flightNumber: string;
  airlineCode: string;
  fromAirport: string;
  toAirport: string;
  cabin: "economy" | "business" | "first";
  departure: string;
  arrival: string;
  minutes: number;
  amount: number;
  currency: "CNY";
  priceBasis: "passenger_search_fare";
  searchedAt: string;
}
export interface FlightOffer { quote: FlightQuote; url: string | null }
export interface FlightResult { source: "flyai"; query: FlightQuery; searchedAt: string; access: "personal_key" | "trial"; limited: boolean; offers: FlightOffer[] }

export const cityAirports: Partial<Record<CityId, readonly string[]>> = { ...airportDirectory.records, sha: ["SHA", "PVG"], bei: ["PEK", "PKX"], zjj: ["DYG"], gui: ["KWL"], san: ["SYX"], han: ["HGH"], qin: ["TAO"], xmn: ["XMN"], bha: ["BHY"], che: ["CTU", "TFU"], xan: ["XIY"], hua: ["TXN"] };

export function validFlightQuote(value: unknown): value is FlightQuote {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const q = value as FlightQuote, cities: readonly string[] = CITY_IDS;
  const departure = chinaDateTime(q.departure), arrival = chinaDateTime(q.arrival);
  return q.source === "flyai" && cities.includes(q.from) && cities.includes(q.to) && q.from !== q.to
    && typeof q.flightNumber === "string" && typeof q.airlineCode === "string"
    && typeof q.fromAirport === "string" && typeof q.toAirport === "string"
    && /^[A-Z0-9]{2}\d{2,5}$/.test(q.flightNumber) && /^[A-Z0-9]{2}$/.test(q.airlineCode)
    && q.flightNumber.startsWith(q.airlineCode)
    && cityAirports[q.from]?.includes(q.fromAirport) === true && cityAirports[q.to]?.includes(q.toAirport) === true
    && /^[A-Z]{3}$/.test(q.fromAirport) && /^[A-Z]{3}$/.test(q.toAirport) && q.fromAirport !== q.toAirport
    && ["economy", "business", "first"].includes(q.cabin)
    && q.currency === "CNY" && q.priceBasis === "passenger_search_fare"
    && typeof q.amount === "number" && parseFlyaiPrice(String(q.amount)) === q.amount
    && Number.isInteger(q.minutes) && q.minutes > 0 && q.minutes <= 1440
    && departure !== null && arrival !== null && arrival - departure === q.minutes * 60000
    && typeof q.searchedAt === "string" && Number.isFinite(Date.parse(q.searchedAt));
}
export const flightQuoteKey = (q: FlightQuote) => JSON.stringify([q.from, q.to, q.flightNumber, q.departure, q.arrival, q.fromAirport, q.toAirport, q.cabin]);
const airports: Record<string, string> = { PVG: "Шанхай Пудун", SHA: "Шанхай Хунцяо", PEK: "Пекин Столичный", PKX: "Пекин Дасин", DYG: "Чжанцзяцзе Хэхуа", KWL: "Гуйлинь Лянцзян", SYX: "Санья Фэнхуан", HAK: "Хайкоу Мэйлань", HGH: "Ханчжоу Сяошань", TAO: "Циндао Цзяодун", XMN: "Сямэнь Гаоци", BHY: "Бэйхай Фучэн", CTU: "Чэнду Шуанлю", TFU: "Чэнду Тяньфу", XIY: "Сиань Сяньян", TXN: "Хуаншань Туньси" };
const airlines: Record<string, string> = { MU: "Китайские Восточные авиалинии", CA: "Эйр Чайна", CZ: "Китайские Южные авиалинии", HU: "Хайнаньские авиалинии", FM: "Шанхайские авиалинии", "9C": "Спринг Эйрлайнз", HO: "Цзюньъяо Эйрлайнз", "3U": "Сычуаньские авиалинии", SC: "Шаньдунские авиалинии", MF: "Сямэньские авиалинии", ZH: "Шэньчжэньские авиалинии", EU: "Чэндуские авиалинии", JD: "Столичные авиалинии", G5: "Чайна Экспресс", PN: "Западные авиалинии" };
export const airportLabel = (code: string) => airports[code] ? `${airports[code]} (${code})` : `Аэропорт ${code}`;
export const airlineLabel = (code: string) => airlines[code] ?? `Авиакомпания ${code}`;
export const cabinLabel = (cabin: FlightQuote["cabin"]) => ({ economy: "Эконом", business: "Бизнес", first: "Первый класс" })[cabin];
