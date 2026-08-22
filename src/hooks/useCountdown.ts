import { useCallback, useEffect, useState } from "react";

/**
 * A seconds countdown, used for the OTP resend cooldown. The API throttles resends to
 * one per 60 seconds and answers 429 `otp_throttled`, so the button is disabled rather
 * than letting the user earn an error.
 *
 * Driven off an absolute deadline so it stays accurate if the timer is throttled while
 * the app is backgrounded.
 */
export function useCountdown(initialSeconds = 0) {
  const [deadline, setDeadline] = useState<number | null>(() =>
    initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : null
  );
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (deadline === null) return;

    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setDeadline(null);
    };

    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [deadline]);

  const start = useCallback((seconds: number) => {
    setDeadline(Date.now() + seconds * 1000);
    setRemaining(seconds);
  }, []);

  return { remaining, active: remaining > 0, start };
}
