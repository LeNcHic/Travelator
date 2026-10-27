import { generateRoutes } from "../lib/planner";
import { routeAdjustments } from "../lib/route-adjustments";
import { routeRecoveries } from "../lib/route-recovery";
import type { PlannerTask, PlannerReply } from "../lib/planner-task";

self.onmessage = (event: MessageEvent<{ id: number; task: PlannerTask }>) => {
  const { id, task } = event.data;
  let reply: PlannerReply;
  try {
    const result = task.kind === "routes" ? generateRoutes(task.input, task.events, task.weather)
      : task.kind === "adjustments" ? routeAdjustments(task.input, task.plan) : routeRecoveries(task.input);
    reply = { id, ok: true, result };
  } catch {
    reply = { id, ok: false, error: "Не удалось рассчитать варианты. Повторите расчёт или измените пожелания." };
  }
  self.postMessage(reply);
};
