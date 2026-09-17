import NumberFlow from "@number-flow/react";
import { useEffect, useState } from "react";

const TICK_MS = 50;

export function LiveDuration({
  startedAt,
  active,
}: {
  startedAt: unknown;
  active: boolean;
}) {
  const start = typeof startedAt === "string" ? Date.parse(startedAt) : NaN;
  const canTick = active && Number.isFinite(start);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!canTick) return;
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [canTick]);

  const elapsedSeconds = canTick ? Math.max(0, (now - start) / 1000) : 0;
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const label = `${minutes} minutes ${seconds.toFixed(2)} seconds`;

  return (
    <span className="live-duration" role="timer" aria-label={label} title={label}>
      <NumberFlow
        value={minutes}
        format={{ minimumIntegerDigits: 2, useGrouping: false }}
        animated={canTick}
        transformTiming={{ duration: 80, easing: "linear" }}
        spinTiming={{ duration: 80, easing: "linear" }}
        opacityTiming={{ duration: 60, easing: "linear" }}
        willChange
      />
      <span aria-hidden="true">:</span>
      <NumberFlow
        value={seconds}
        format={{
          minimumIntegerDigits: 2,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          useGrouping: false,
        }}
        animated={canTick}
        transformTiming={{ duration: 80, easing: "linear" }}
        spinTiming={{ duration: 80, easing: "linear" }}
        opacityTiming={{ duration: 60, easing: "linear" }}
        willChange
      />
    </span>
  );
}
