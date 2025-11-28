import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_COUNT_KEY = "slop_submission_count";
const STORAGE_RESET_KEY = "slop_reset_time";

export function useRateLimit(limit = 3, windowMs = 3600000) {
  const [count, setCount] = useState(0);
  const [lastReset, setLastReset] = useState(() => Date.now());
  const [isLimited, setIsLimited] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState(windowMs);

  const computeTimeUntilReset = useCallback(
    (referenceTime: number) => Math.max(0, referenceTime + windowMs - Date.now()),
    [windowMs],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedCount = Number(localStorage.getItem(STORAGE_COUNT_KEY) ?? 0);
    const storedReset = Number(localStorage.getItem(STORAGE_RESET_KEY) ?? 0);
    const now = Date.now();

    if (storedReset && now - storedReset > windowMs) {
      localStorage.setItem(STORAGE_COUNT_KEY, "0");
      localStorage.setItem(STORAGE_RESET_KEY, now.toString());
      setCount(0);
      setLastReset(now);
      setIsLimited(false);
      setTimeUntilReset(windowMs);
      return;
    }

    const resetTime = storedReset || now;
    setCount(storedCount);
    setLastReset(resetTime);
    setIsLimited(storedCount >= limit);
    setTimeUntilReset(computeTimeUntilReset(resetTime));
  }, [computeTimeUntilReset, limit, windowMs]);

  useEffect(() => {
    const tick = () => {
      setTimeUntilReset(computeTimeUntilReset(lastReset));
      if (computeTimeUntilReset(lastReset) === 0 && isLimited) {
        setIsLimited(false);
        setCount(0);
        setLastReset(Date.now());
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_COUNT_KEY, "0");
          localStorage.setItem(STORAGE_RESET_KEY, Date.now().toString());
        }
      }
    };

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [computeTimeUntilReset, isLimited, lastReset]);

  const recordSubmission = useCallback(() => {
    const now = Date.now();
    const windowExpired = now - lastReset > windowMs;
    const baseCount = windowExpired ? 0 : count;
    const nextCount = baseCount + 1;
    const effectiveReset = windowExpired ? now : lastReset;

    setCount(nextCount);
    setLastReset(effectiveReset);
    setIsLimited(nextCount >= limit);
    setTimeUntilReset(Math.max(0, effectiveReset + windowMs - now));

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_COUNT_KEY, nextCount.toString());
      localStorage.setItem(STORAGE_RESET_KEY, effectiveReset.toString());
    }
  }, [count, limit, lastReset, windowMs]);

  const reset = useCallback(() => {
    const now = Date.now();
    setCount(0);
    setLastReset(now);
    setIsLimited(false);
    setTimeUntilReset(windowMs);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_COUNT_KEY, "0");
      localStorage.setItem(STORAGE_RESET_KEY, now.toString());
    }
  }, [windowMs]);

  const remaining = useMemo(() => Math.max(0, limit - count), [count, limit]);

  return {
    count,
    isLimited,
    recordSubmission,
    reset,
    remaining,
    timeUntilReset,
  };
}
