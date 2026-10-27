import { validVerifiedEvent, type EventQuery, type OfficialEventResult } from "../../shared/events";
export async function searchOfficialEvents(query: EventQuery, signal: AbortSignal): Promise<OfficialEventResult> {
  const response = await fetch("/api/events/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query), signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message || "Не удалось проверить официальную афишу.");
  if (result?.source !== "official_sites" || JSON.stringify(result.query) !== JSON.stringify(query)
    || !Array.isArray(result.events) || result.events.length > 100 || !result.events.every(validVerifiedEvent)
    || !Array.isArray(result.warnings) || !result.warnings.every((item: unknown) => typeof item === "string")
    || !Array.isArray(result.checkedCities) || !Array.isArray(result.supportedCities) || !Number.isFinite(Date.parse(result.searchedAt)))
    throw new Error("Афиша вернула неполные данные. События не повлияли на маршрут.");
  return result;
}
