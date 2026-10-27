import type { PlannerTask, PlannerReply, PlannerResults } from "./planner-task";

export type PlannerWorker = Pick<Worker, "postMessage" | "terminate" | "onmessage" | "onerror" | "onmessageerror">;
/** Each active calculation owns its worker: cancelling actually stops CPU work. */
export function createPlannerClient(factory: () => PlannerWorker, cacheLimit = 24, timeoutMs = 30000) {
  const cache = new Map<string, { result: PlannerResults[keyof PlannerResults]; at: number }>();
  let nextId = 0;
  return function run<T extends PlannerTask>(task: T, signal: AbortSignal): Promise<PlannerResults[T["kind"]]> {
    if (signal.aborted) return Promise.reject(new DOMException("Расчёт отменён", "AbortError"));
    for (const [cachedKey, entry] of cache) if (Date.now() - entry.at > 60000) cache.delete(cachedKey);
    const key = JSON.stringify(task), hit = cache.get(key);
    if (hit) {
      cache.delete(key); cache.set(key, hit);
      return Promise.resolve(structuredClone(hit.result) as PlannerResults[T["kind"]]);
    }
    return new Promise((resolve, reject) => {
      let worker: PlannerWorker;
      try { worker = factory(); }
      catch { reject(new Error("Не удалось запустить расчёт. Перезагрузите страницу или повторите попытку.")); return; }
      const id = ++nextId;
      let finished = false;
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); worker.terminate(); };
      const fail = (error: Error) => { if (finished) return; finished = true; cleanup(); reject(error); };
      const abort = () => fail(new DOMException("Расчёт отменён", "AbortError"));
      const timer = setTimeout(() => fail(new Error("Расчёт занял слишком много времени. Повторите попытку или сократите число остановок.")), timeoutMs);
      signal.addEventListener("abort", abort, { once: true });
      worker.onmessage = (event: MessageEvent<PlannerReply>) => {
        const reply = event.data;
        if (finished || reply.id !== id) return;
        if (!reply.ok) { fail(new Error(reply.error)); return; }
        finished = true; cleanup();
        cache.set(key, { result: structuredClone(reply.result), at: Date.now() });
        if (cache.size > cacheLimit) cache.delete(cache.keys().next().value!);
        resolve(reply.result as PlannerResults[T["kind"]]);
      };
      worker.onerror = event => { event.preventDefault(); fail(new Error("Расчёт прервался. Повторите попытку.")); };
      worker.onmessageerror = () => fail(new Error("Не удалось получить результат расчёта. Повторите попытку."));
      if (signal.aborted) { abort(); return; }
      try { worker.postMessage({ id, task }); } catch { fail(new Error("Не удалось передать пожелания для расчёта. Повторите попытку.")); }
    });
  };
}

export const runPlannerTask = createPlannerClient(() => new Worker(new URL("../workers/planner.worker.ts", import.meta.url), { type: "module" }));
