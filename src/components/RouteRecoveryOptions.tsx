import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import type { TripInput } from "../types";
import { routeRecoveries, type RouteRecovery } from "../lib/route-recovery";

export default function RouteRecoveryOptions({ input, onApply }: {
  input: TripInput; onApply: (change: RouteRecovery) => void;
}) {
  const choices = useMemo(() => routeRecoveries(input), [input]);
  if (!choices.length) return null;
  return <div className="route-recovery-options">
    <p>Можно изменить одно условие — остальные пожелания сохраним:</p>
    <div>{choices.map(change => <button type="button" key={change.id} onClick={() => onApply(change)}>
      <span><strong>{change.label}</strong><small>{change.hint}</small></span><ArrowRight />
    </button>)}</div>
    <small>Проверено по предварительному каталогу. Любое изменение можно отменить.</small>
  </div>;
}
