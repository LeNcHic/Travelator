import { useEffect, useState } from "react";
import { runPlannerTask } from "./planner-client";
import type { PlannerTask, PlannerResults } from "./planner-task";

export function usePlannerTask<T extends PlannerTask>(task: T, enabled = true) {
  const key = JSON.stringify(task);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; status: "loading" | "done" | "error"; result?: PlannerResults[T["kind"]]; error?: string }>({ key: "", status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ key, status: "loading" });
    void runPlannerTask(task, controller.signal)
      .then(result => { if (!controller.signal.aborted) setState({ key, status: "done", result }); })
      .catch(error => { if (!controller.signal.aborted) setState({ key, status: "error", error: error instanceof Error ? error.message : "Расчёт недоступен. Повторите попытку." }); });
    return () => controller.abort();
  }, [key, enabled, attempt]);
  return { ...(state.key === key ? state : { key, status: "loading" as const }),
    status: !enabled ? "idle" as const : state.key === key ? state.status : "loading" as const,
    retry: () => setAttempt(value => value + 1) };
}
