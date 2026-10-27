import test from "node:test";
import assert from "node:assert/strict";
import { createWeatherSearch, normalizeMeteo, seasonalDay, validateWeatherQuery, weatherPoint } from "./weather";
import { weatherSuitability } from "../shared/weather";
import { cityIds } from "../src/data/catalog";
const now = new Date("2026-10-27T08:00:00Z"), query = { cities: ["xmn"] as const, start: "2026-11-01", end: "2026-11-14" };
function fixture(start: string, end: string) {
  const time = Array.from({ length: (Date.parse(end)-Date.parse(start))/86400000+1 }, (_,i) => new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10));
  return { daily: { time, temperature_2m_max: time.map(()=>27), temperature_2m_min: time.map(()=>18), precipitation_sum: time.map(()=>0), wind_speed_10m_max: time.map(()=>12), precipitation_probability_max: time.map(()=>10) } };
}
const payload = (url: URL) => url.hostname.startsWith("archive-") ? fixture(url.searchParams.get("start_date")!,url.searchParams.get("end_date")!) : fixture("2026-10-27","2026-11-11");
test("one trip separates forecast and season at the inclusive 16-day boundary and caches batches", async () => {
  let calls=0;
  const search = createWeatherSearch(async value => { calls++; const url=new URL(String(value)); assert.equal(url.searchParams.get("timezone"),"Asia/Shanghai"); return Response.json(payload(url)); },()=>now);
  const result = await search(query);
  assert.equal(result.days.filter(day=>day.kind==="forecast").length,11);
  assert.equal(result.days.filter(day=>day.kind==="seasonal").length,3);
  assert.equal(result.days[10].date,"2026-11-11"); assert.equal(result.days[11].date,"2026-11-12");
  assert.ok(result.days[11].samples >= 30); assert.equal(result.days[11].years,"2023, 2024, 2025");
  assert.equal(result.days[0].rainMm,0); assert.equal(result.days[0].visibilityKm,null);
  await search(query); assert.equal(calls,2);
});
test("past stays use dated historical data rather than a seasonal estimate or archived forecast", async () => {
  const search=createWeatherSearch(async value=>Response.json(payload(new URL(String(value)))),()=>now);
  const result=await search({cities:["xmn"],start:"2026-10-01",end:"2026-10-05"});
  assert.equal(result.days.length,5); assert.ok(result.days.every(day=>day.kind==="historical"));
});
test("provider failures and missing days remain uncertainty, never sunny defaults", async () => {
  const search=createWeatherSearch(async ()=>{throw new Error("offline");},()=>now);
  const result=await search(query);
  assert.ok(result.days.every(day=>day.kind==="unknown" && day.high===null)); assert.equal(result.warnings.length,2);
  assert.equal(weatherSuitability(result.days[0],"sea"),null);
  const missing = createWeatherSearch(async value=>Response.json(new URL(String(value)).hostname.startsWith("archive-") ? payload(new URL(String(value))) : fixture("2026-10-27","2026-11-10")),()=>now);
  assert.equal((await missing(query)).days.find(day=>day.date==="2026-11-11")!.kind,"unknown");
});
test("normalization preserves zeros, rejects impossible values and does not invent visibility", () => {
  const day=normalizeMeteo({daily:{time:["2026-10-27"],temperature_2m_max:[0],temperature_2m_min:[-2],precipitation_sum:[0],wind_speed_10m_max:[0]}},"xmn","forecast",now.toISOString())[0];
  assert.equal(day.high,0); assert.equal(day.rainMm,0); assert.equal(day.windKmh,0); assert.equal(day.visibilityKm,null);
  assert.equal(normalizeMeteo({daily:{time:["2026-10-27"],temperature_2m_max:[999]}},"xmn","forecast",now.toISOString()).length,0);
  assert.equal(seasonalDay([],"xmn","2027-02-28",now.toISOString()).kind,"unknown");
  assert.equal(seasonalDay([day],"xmn","2027-10-27",now.toISOString()).kind,"unknown");
});
test("outdoor weather has uncertainty without visibility; museums offer a genuine indoor alternative", () => {
  const day={city:"xmn" as const,date:"2026-11-01",kind:"forecast" as const,high:25,low:18,rainMm:0,windKmh:10,visibilityKm:null,rainChance:0,samples:1,updatedAt:now.toISOString()};
  assert.ok(weatherSuitability(day,"nature")! < weatherSuitability({...day,visibilityKm:15},"nature")!);
  const rain={...day,rainMm:50,windKmh:60};
  assert.ok(weatherSuitability(rain,"city",.6)! > weatherSuitability(rain,"city",0)!);
  assert.ok(weatherSuitability(rain,"sea")! < weatherSuitability(day,"sea")!);
});
test("batches are bounded and cancellation prevents later provider calls", async () => {
  let calls=0,active=0,maxActive=0;
  const search=createWeatherSearch(async value=>{ calls++; active++; maxActive=Math.max(maxActive,active); await Promise.resolve(); const url=new URL(String(value)); const count=url.searchParams.get("latitude")!.split(",").length; active--; return Response.json(Array.from({length:count},()=>payload(url))); },()=>now);
  const result=await search({...query,cities:cityIds.slice(0,20)});
  assert.equal(calls,8); assert.ok(maxActive<=2); assert.equal(result.days.length,280);
  const controller=new AbortController(); controller.abort();
  await assert.rejects(search(query,controller.signal),{name:"AbortError"}); assert.equal(calls,8);
  assert.notEqual(weatherPoint("hua").label,"Хуаншань · район базы");
});
test("weather input rejects arbitrary locations, duplicate bases, invalid dates and unbounded ranges", () => {
  for (const invalid of [null,{}, {...query,cities:["unknown"]},{...query,cities:["sha","sha"]},{...query,start:"2026-02-30"},{...query,end:"2027-01-01"},{...query,cities:cityIds.slice(0,21)}]) assert.throws(()=>validateWeatherQuery(invalid));
});
