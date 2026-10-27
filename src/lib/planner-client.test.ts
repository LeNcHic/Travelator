import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createPlannerClient, type PlannerWorker } from "./planner-client";
import type { PlannerTask, PlannerReply } from "./planner-task";
import { defaultInput } from "./planner";
import { automaticPreferences } from "./automatic-preferences";
import { shiftCalendarDate } from "./date-range";
import CompareScreen from "../components/CompareScreen";

class FakeWorker {
  onmessage: PlannerWorker["onmessage"] = null;
  onerror: PlannerWorker["onerror"] = null;
  onmessageerror: PlannerWorker["onmessageerror"] = null;
  posted!: { id: number; task: PlannerTask };
  terminated = false;
  postMessage(message: typeof this.posted) { this.posted = message; }
  terminate() { this.terminated = true; }
  reply(reply: Omit<Extract<PlannerReply, {ok:true}>,"id">) { this.onmessage?.call(this as unknown as Worker, { data: { id:this.posted.id, ...reply } } as MessageEvent); }
}
const task = { kind:"routes", input:automaticPreferences({...defaultInput(),days:14}) } as const;
const make = () => {
  const workers: FakeWorker[] = [];
  const run = createPlannerClient(() => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as PlannerWorker; });
  return {run,workers};
};
test("route calculation stays asynchronous, reuses results and isolates the cache from manual edits", async () => {
  const {run,workers} = make();
  const first = run(task,new AbortController().signal);
  assert.equal(workers.length,1); assert.deepEqual(workers[0].posted.task,task);
  workers[0].reply({ok:true,result:{plans:[],errors:["fixture"]}});
  const result = await first; result.errors.push("manual mutation");
  const cached = await run(task,new AbortController().signal);
  assert.deepEqual(cached.errors,["fixture"]); assert.equal(workers.length,1); assert.ok(workers[0].terminated);
});
test("cancellation terminates the worker and a late result cannot populate a newer request or its cache", async () => {
  const {run,workers} = make(), controller = new AbortController();
  const first = run(task,controller.signal), rejected = assert.rejects(first,{name:"AbortError"});
  controller.abort(); await rejected; assert.ok(workers[0].terminated);
  workers[0].reply({ok:true,result:{plans:[],errors:["stale"]}});
  const second = run(task,new AbortController().signal);
  assert.equal(workers.length,2); workers[1].reply({ok:true,result:{plans:[],errors:["current"]}});
  assert.deepEqual((await second).errors,["current"]);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(run(task,cancelled.signal),{name:"AbortError"});
  assert.equal(workers.length,2,'an already cancelled task never starts another worker');
});
test("worker failures are retryable and a missing reply times out rather than leaving a permanent spinner", async () => {
  const {run,workers} = make(), signal = new AbortController().signal;
  const first = run(task,signal), rejected = assert.rejects(first,/прервался/);
  workers[0].onerror?.call(workers[0] as unknown as Worker, {preventDefault(){}} as ErrorEvent); await rejected;
  const second = run(task,signal); workers[1].reply({ok:true,result:{plans:[],errors:[]}}); await second;
  let timedOut: FakeWorker | undefined;
  const slow = createPlannerClient(() => (timedOut = new FakeWorker()) as unknown as PlannerWorker,24,5);
  await assert.rejects(slow(task,signal),/слишком много времени/); assert.ok(timedOut?.terminated);
});
test("comparison renders immediate animated loading feedback without claiming the route is impossible", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(createElement(CompareScreen,{input:task.input,plans:[],errors:[],routeSource:"demo",liveStatus:"idle",calculationStatus:"loading",onRouteSource:noop,onSearch:noop,onCancel:noop,onEdit:noop,onSelect:noop}));
  assert.ok(html.includes('role="status"')); assert.ok(html.includes('tv-spinner'));
  assert.ok(html.includes('Подбираем города и распределяем дни'));
  assert.ok(!html.includes('Пока не удалось совместить'));
});
test("a failed adjustment offers retry and undo without claiming routes were updated", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(createElement(CompareScreen,{input:task.input,plans:[],errors:[],routeSource:"demo",liveStatus:"idle",calculationStatus:"error",calculationError:"Расчёт прервался.",adjustmentNotice:"Добавлен день на природе.",onUndoAdjustment:noop,onRetryCalculation:noop,onRouteSource:noop,onSearch:noop,onCancel:noop,onEdit:noop,onSelect:noop}));
  assert.ok(html.includes('Не удалось пересчитать маршруты'));
  assert.ok(html.includes('Повторить расчёт'));
  assert.ok(html.includes('Отменить изменение'));
  assert.ok(!html.includes('Маршруты обновлены'));
  assert.ok(!html.includes('Посмотреть результат'));
});
test("calendar month shortcuts keep the selected day and clamp month ends, including leap years", () => {
  assert.equal(shiftCalendarDate("2026-11-14",1),"2026-12-14");
  assert.equal(shiftCalendarDate("2027-01-31",1),"2027-02-28");
  assert.equal(shiftCalendarDate("2028-01-31",1),"2028-02-29");
  assert.equal(shiftCalendarDate("2027-01-14",-1),"2026-12-14");
});
