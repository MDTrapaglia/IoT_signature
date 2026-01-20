import { useEffect, useState } from 'react';

export function useCurrentTime(intervalMs: number = 60000) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return { currentTime, timeZone };
}
