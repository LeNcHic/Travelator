import test from "node:test";
import assert from "node:assert/strict";
import { automaticPreferences } from "./automatic-preferences";
import { defaultInput, generateRoutes, schedule, totals } from "./planner";
import { cityIds } from "../data/catalog";
import { baseCatalog, catalogueProblems, publishedBaseIds } from "../data/destination-catalog";
import { attractions, attractionsIn } from "../data/attractions";
import { isInput, isPlan, parseDraft, parseSaved } from "./storage";
import { conditionsEvaluator } from "./route-conditions";
import { programmeSize, marginalProgrammePenalty, interestProgrammeDays } from "./programme";
import { cityDays } from "./city-planner";
import { currentEventsForStay, type VerifiedEvent } from "../../shared/events";
import { isFreshWeather, type WeatherDay } from "../../shared/weather";
import { addDays } from "./format";
const at=new Date().toISOString();
function input(days:number,interests=(['city','nature','sea'] as const).slice(),pace: 'slow'|'balanced'|'active'='balanced') {
  const trip=automaticPreferences({...defaultInput(),days,interests:[...interests],pace,startDate:"2026-11-01",budget:50000});
  return {...trip,journey:{...trip.journey!,flexibleDates:false}};
}
test("the published catalogue has 40 sleeping bases and 207 unique places; incomplete records fail publication",()=>{
  assert.equal(publishedBaseIds.length,40); assert.equal(attractions.length,207); assert.equal(new Set(attractions.map(p=>p.id)).size,207);
  for(const id of publishedBaseIds) { assert.equal(catalogueProblems(baseCatalog[id]).length,0); assert.ok(attractionsIn(id).length>=5); assert.ok(baseCatalog[id].sources.length); assert.equal(baseCatalog[id].timezone,"Asia/Shanghai"); }
  assert.ok(catalogueProblems({...baseCatalog.sha,region:"",highlights:[],sources:[]}).length>=3);
});
test("a full forecast can change a beach recommendation while stale or missing data cannot claim a weather advantage",()=>{
  const trip=input(7,['sea']); trip.journey.minStops=1; trip.journey.maxStops=1;
  const plain=generateRoutes(trip).plans[0];
  const weather:WeatherDay[]=cityIds.flatMap(city=>Array.from({length:7},(_,i)=>({city,date:addDays(trip.startDate,i),kind:'forecast',high:city==='san'?28:9,low:city==='san'?22:4,rainMm:city==='san'?0:25,windKmh:city==='san'?10:50,visibilityKm:15,rainChance:city==='san'?0:90,samples:1,updatedAt:at})));
  const changed=generateRoutes(trip,[],weather).plans[0];
  assert.notEqual(plain.cities[0],'san'); assert.equal(changed.cities[0],'san'); assert.equal(totals(changed,trip).tripDays,7); assert.ok(isPlan(changed,trip));
  const stale=weather.map(day=>({...day,updatedAt:new Date(Date.now()-4*3600000).toISOString()}));
  assert.equal(isFreshWeather(stale[0]),false); assert.deepEqual(generateRoutes(trip,[],stale).plans[0].cities,plain.cities);
  assert.equal(conditionsEvaluator(trip,weather)(changed).favourable,7);
  const tight = {...trip,budget:1600};
  for (const plan of generateRoutes(tight,[],weather).plans) assert.ok(totals(plan,tight).total <= tight.budget,'favourable weather never relaxes the budget');
});
test("a relevant, current event changes city order without creating duplicate destination alternatives",()=>{
  const trip=input(7,['city']); trip.required=['sha','bei']; trip.journey.minStops=2; trip.journey.maxStops=2;
  const plain=generateRoutes(trip).plans[0], bei=schedule(plain,trip).find(row=>row.city==='bei')!;
  const eventDate=bei.first===0?addDays(trip.startDate,6):trip.startDate;
  const event:VerifiedEvent={id:'check-beijing-art',city:'bei',interest:'city',title:'Проверочная выставка',description:'Проверочный сценарий, не реальная афиша.',advice:'Наличие билетов неизвестно.',venue:'Проверочная площадка',registration:'unknown',availability:'unknown',dates:{start:eventDate,end:eventDate},verifiedAt:at,source:{title:'Проверочный первоисточник',url:'https://english.beijing.gov.cn/'}};
  const result=generateRoutes(trip,[event]);
  assert.notDeepEqual(result.plans[0].cities,plain.cities); assert.equal(result.plans.length,1);
  assert.ok(conditionsEvaluator(trip,[],[event])(result.plans[0]).matches.length);
  assert.equal(currentEventsForStay([{...event,status:'cancelled'}],'bei',trip.startDate,addDays(trip.startDate,6)).length,0);
  assert.deepEqual(generateRoutes(trip,[{...event,interest:'nature'}]).plans[0].cities,plain.cities);
});
test("programmes account for local journeys, free time, pace and diminishing value of repeated days",()=>{
  assert.ok(programmeSize('hua').transfers>0); assert.ok(programmeSize('hua','slow').contentDays>programmeSize('hua','active').contentDays);
  assert.ok(marginalProgrammePenalty('pin',15,'balanced')>marginalProgrammePenalty('pin',5,'balanced'));
  assert.ok(programmeSize('san').contentDays>=5);
  assert.equal(interestProgrammeDays('les','nature','balanced'),1);
  const trip=input(7,['nature']); trip.required=['les','che']; trip.journey.minStops=2; trip.journey.maxStops=2;
  const plan=generateRoutes(trip).plans[0];
  assert.ok(cityDays(plan,trip,'les').flat().includes('les-river'));
  assert.ok(!cityDays(plan,trip,'les').flat().includes('les-emei'),'a full-day hike is not silently assigned to a moderate day');
});
test("5, 7, 10, 14, 21 and 28 day holidays cover all interest combinations and paces with valid distinct routes",()=>{
  const combinations = [['city'],['nature'],['sea'],['city','nature'],['city','sea'],['nature','sea'],['city','nature','sea']] as const;
  for(const days of [5,7,10,14,21,28]) for(const interests of combinations) for(const pace of ['slow','balanced','active'] as const) {
    const trip=input(days,[...interests],pace), result=generateRoutes(trip);
    assert.ok(isInput(trip),`${days}/${interests}/${pace}: input`); assert.equal(result.errors.length,0,`${days}/${interests}/${pace}: ${result.errors}`);
    assert.ok(result.plans.length>=1 && result.plans.length<=3);
    assert.equal(new Set(result.plans.map(plan=>[...plan.cities].sort().join())).size,result.plans.length);
    for(const plan of result.plans) { assert.ok(isPlan(plan,trip)); assert.equal(plan.days.reduce((a,b)=>a+b,0),days); assert.ok(totals(plan,trip).total<=trip.budget); }
  }
});
test("new mandatory locations retain their sleeping base and old manual saves remain recoverable",()=>{
  for(const city of ['suz','dat','kun','wuy','hai'] as const) {
    const trip=input(10,['city','nature']); const place=attractionsIn(city)[0];
    trip.required=[city]; trip.journey.requiredPlaces=[place.id];
    const result=generateRoutes(trip); assert.equal(result.errors.length,0,city);
    for(const plan of result.plans) assert.ok(plan.cities.includes(city));
  }
  const trip=input(7,['city']); trip.required=['sha','bei']; trip.journey.minStops=2; trip.journey.maxStops=2;
  const original=generateRoutes(trip).plans[0], plan={...original,visits:{sha:Array.from({length:original.days[original.cities.indexOf('sha')]},(_,i)=>i===0?['sha-bund']:[])}};
  const legacy={...trip}; delete legacy.country;
  assert.ok(parseDraft(JSON.stringify({version:1,input:legacy,plan,screen:'plan'}))?.plan);
  assert.equal(parseSaved(JSON.stringify([{id:'legacy',savedAt:at,input:legacy,plan}])).length,1);
});
