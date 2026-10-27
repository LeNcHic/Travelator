import test from "node:test";
import assert from "node:assert/strict";
import { extractOfficialEvent, extractStructuredEvents, structuredEventSources, deduplicateEvents, parseOfficialPeriod } from "./events";
import { officialEventSources } from "./event-sources";
import { currentEventsForStay } from "../shared/events";
const now=new Date(), source=structuredEventSources.find(source=>source.city==='suz')!;
const schema=(overrides:Record<string,unknown>={})=>({"@type":"Event",name:"Сад и искусство",description:"Программа организатора",startDate:"2026-11-01T10:00:00+08:00",endDate:"2026-11-10T17:00:00+08:00",location:{name:"Музей Сучжоу",address:{addressLocality:"Suzhou"}},...overrides});
const page=(data:unknown)=>`<script type="application/ld+json">${JSON.stringify(data)}</script>`;
test("organiser JSON-LD requires a city and complete explicit dates and retains venue and unknown tickets",()=>{
  const [event]=extractStructuredEvents(page({"@graph":[schema()]}),source,now);
  assert.equal(event.venue,"Музей Сучжоу"); assert.equal(event.availability,"unknown"); assert.equal(event.registration,"unknown");
  for (const type of ["ExhibitionEvent", "https://schema.org/Festival", ["Thing", "MusicEvent"]]) assert.equal(extractStructuredEvents(page(schema({"@type":type})),source,now).length,1);
  for(const changes of [{endDate:undefined},{startDate:"11-01"},{location:{address:{addressLocality:"Tokyo"}}},{endDate:"2026-02-30"}]) assert.equal(extractStructuredEvents(page(schema(changes)),source,now).length,0);
});
test("duplicate events collapse and a cancellation overrides a scheduled copy; expired checks cannot influence stays",()=>{
  const [event]=extractStructuredEvents(page(schema()),source,now);
  assert.equal(deduplicateEvents([event,{...event,id:"another-source"}]).length,1);
  assert.equal(deduplicateEvents([event,{...event,status:"cancelled"}]).length,0);
  const [cancelled]=extractStructuredEvents(page(schema({eventStatus:"https://schema.org/EventCancelled"})),source,now);
  assert.equal(currentEventsForStay([cancelled],'suz','2026-11-01','2026-11-10').length,0);
  assert.equal(currentEventsForStay([{...event,verifiedAt:new Date(Date.now()-7*3600000).toISOString()}],'suz','2026-11-01','2026-11-10').length,0);
});
test("numeric Chinese organiser dates preserve the year and never invent an end for an open-ended exhibition",()=>{
  assert.deepEqual(parseOfficialPeriod("展览时间：2026/10/18 至 2026/11/18",2026),{start:"2026-10-18",end:"2026-11-18"});
  assert.equal(parseOfficialPeriod("2026年7月15日开幕",2026),null);
  const spec=officialEventSources.find(spec=>spec.event.id==='hangzhou-chengaojie-2026')!;
  const html=`${spec.anchor} 展览时间：2026/10/18 至 2026/11/18`;
  assert.equal(extractOfficialEvent(html,spec,now)?.city,"han");
  assert.equal(extractOfficialEvent(html.replaceAll('2026','2027'),spec,now),null);
  assert.equal(extractOfficialEvent(html+' 展览取消',spec,now),null);
});
