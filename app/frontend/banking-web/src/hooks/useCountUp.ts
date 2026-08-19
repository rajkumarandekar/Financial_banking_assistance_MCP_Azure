import { useEffect, useRef, useState } from "react";

// Animates a number from 0 (or its previous value) up to `target` on mount
// or whenever target changes - used for the counter/score count-up effect.
export function useCountUp(target: number | null | undefined, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (target == null) return;
    const from = fromRef.current;
    const start = performance.now();

    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = from + (target - from) * eased;
      setValue(current);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
