import { useEffect, useState } from "react";
import { localISODate, parseISODate } from "./utils";

export function useClientDate() {
  const [iso, setIso] = useState<string | null>(null);
  useEffect(() => {
    setIso(localISODate());
  }, []);
  return iso;
}

export function useMonthCursor(initial?: string) {
  const today = useClientDate();
  const [cursor, setCursor] = useState<string | null>(null);
  const iso = cursor ?? today ?? initial ?? null;
  const date = iso ? parseISODate(iso) : null;

  function prevMonth() {
    if (!date) return;
    setCursor(localISODate(new Date(date.getFullYear(), date.getMonth() - 1, 1)));
  }
  function nextMonth() {
    if (!date) return;
    setCursor(localISODate(new Date(date.getFullYear(), date.getMonth() + 1, 1)));
  }
  function selectDay(next: string) {
    setCursor(next);
  }

  return { today, iso, date, prevMonth, nextMonth, selectDay, setCursor };
}
