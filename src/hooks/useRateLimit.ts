import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_COUNT_KEY = "slop_submission_count";
const STORAGE_RESET_KEY = "slop_reset_time";

const parseStoredCount = (value: string | null) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
};

const parseStoredReset = (value: string | null) => {
  const reset = Number(value ?? 0);
  return Number.isFinite(reset) && reset > 0 ? reset : 0;
};

const getInitialRateLimitState = (limit: number, windowMs: number) => {
  const now = Date.now();

  if (typeof window === "undefined") {
    return {
      count: 0,
      lastReset: now,
      isLimited: false,
      timeUntilReset: windowMs,
    };
  }

  const storedCount = parseStoredCount(localStorage.getItem(STORAGE_COUNT_KEY));
  const storedReset = parseStoredReset(localStorage.getItem(STORAGE_RESET_KEY));

  if (storedReset && now - storedReset > windowMs) {
    localStorage.setItem(STORAGE_COUNT_KEY, "0");
    localStorage.setItem(STORAGE_RESET_KEY, now.toString());
    return {
      count: 0,
      lastReset: now,
      isLimited: false,
      timeUntilReset: windowMs,
    };
  }

  const resetTime = storedReset || now;
  return {
    count: storedCount,
    lastReset: resetTime,
    isLimited: storedCount >= limit,
    timeUntilReset: Math.max(0, resetTime + windowMs - now),
  };
};

export function useRateLimit(limit = 3, windowMs = 3600000) {
  const [initialState] = useState(() => getInitialRateLimitState(limit, windowMs));
  const [count, setCount] = useState(initialState.count);
  const [lastReset, setLastReset] = useState(initialState.lastReset);
  const [isLimited, setIsLimited] = useState(initialState.isLimited);
  const [timeUntilReset, setTimeUntilReset] = useState(initialState.timeUntilReset);

  const computeTimeUntilReset = useCallback(
    (referenceTime: number) => Math.max(0, referenceTime + windowMs - Date.now()),
    [windowMs],
  );

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
