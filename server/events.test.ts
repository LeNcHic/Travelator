import test from "node:test";
import assert from "node:assert/strict";
import { createOfficialEventSearch, extractOfficialEvent, parseOfficialPeriod, validateEventQuery } from "./events";
import { officialEventSources } from "./event-sources";

const now = new Date("2026-10-27T12:00:00Z"), comedy = officialEventSources[0];
const page = (when = "Nov 11, 2026, to Jan 31, 2027") => `<h1>12th Shanghai International Comedy Festival</h1><p><strong>When:</strong> ${when}</p><p>Where: Shanghai</p>`;

test("official date parsers handle cross-year, short English and Chinese ranges without annual repetition", () => {
  assert.deepEqual(parseOfficialPeriod("Nov 11, 2026, to Jan 31, 2027", 2026), { start: "2026-11-11", end: "2027-01-31" });
  assert.deepEqual(parseOfficialPeriod("Sept 25 to Nov 15", 2026), { start: "2026-09-25", end: "2026-11-15" });
  assert.deepEqual(parseOfficialPeriod("Dec 5–6 (Mini Marathon)", 2026), { start: "2026-12-05", end: "2026-12-06" });
  assert.deepEqual(parseOfficialPeriod("10月16日至11月8日", 2026), { start: "2026-10-16", end: "2026-11-08" });
  assert.equal(parseOfficialPeriod("Nov 31 to Dec 4", 2026), null);
  const original = extractOfficialEvent(page(), comedy, now)!;
  const changed = extractOfficialEvent(page("Nov 12, 2026, to Jan 30, 2027"), comedy, now)!;
  assert.equal(original.dates.start, "2026-11-11"); assert.equal(changed.dates.start, "2026-11-12", "source dates replace any stored assumptions");
  assert.equal(extractOfficialEvent(page().replace("Comedy", "Different"), comedy, now), null);
  assert.ok(extractOfficialEvent(page("Dec 5&ndash;6"), comedy, now));
  assert.equal(extractOfficialEvent("<script>12th Shanghai International Comedy Festival When: Nov 11 to Nov 15</script>", comedy, now), null);
});

test("live event search fetches sources once, caches verified timestamps and excludes mismatched trip dates", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return new Response(page(), { headers: { "Content-Type": "text/html" } }); };
  const search = createOfficialEventSearch(fetcher, () => now, [comedy]);
  const q = { cities: ["sha"], start: "2026-11-10", end: "2026-11-20" };
  const [first, second] = await Promise.all([search(q), search(q)]);
  assert.equal(calls, 1); assert.equal(first.events.length, 1); assert.deepEqual(first, second);
  assert.equal(first.events[0].verifiedAt, now.toISOString()); assert.deepEqual(first.checkedCities, ["sha"]);
  assert.equal((await search({ ...q, start: "2027-02-01", end: "2027-02-10" })).events.length, 0);
  assert.equal(calls, 1);
});

test("unavailable or changed sources never become verified events and invalid requests do not fetch", async () => {
  let calls = 0;
  const search = createOfficialEventSearch(async () => { calls++; return new Response("Unavailable", { status: 503 }); }, () => now, [comedy]);
  const q = { cities: ["sha"], start: "2026-11-10", end: "2026-11-20" };
  await assert.rejects(search({ ...q, cities: ["unknown"], source: "https://private.example" }), { code: "INVALID_EVENT_QUERY" });
  assert.equal(calls, 0);
  const result = await search(q); assert.equal(result.events.length, 0); assert.equal(result.checkedCities.length, 0); assert.ok(result.warnings.length);
  assert.throws(() => validateEventQuery({ ...q, end: "2027-02-10" }), { code: "INVALID_EVENT_QUERY" });
});
