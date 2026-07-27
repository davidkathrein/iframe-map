import { useEffect, useState } from "react";

export function usePresenceValue<T>(value: T | null, exitMs: number) {
  const [renderedValue, setRenderedValue] = useState<T | null>(value);
  const [visible, setVisible] = useState(Boolean(value));

  useEffect(() => {
    let frame: number | undefined;
    let timeout: number | undefined;

    if (value !== null) {
      setRenderedValue(value);
      frame = window.requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      timeout = window.setTimeout(() => setRenderedValue(null), exitMs);
    }

    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [exitMs, value]);

  return { renderedValue, visible };
}
