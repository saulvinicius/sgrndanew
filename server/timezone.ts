export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export const BRAZIL_TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Fortaleza',
  'America/Recife',
  'America/Belem',
  'America/Cuiaba',
  'America/Rio_Branco',
] as const;

export function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function getTimeZoneOffsetMinutes(utcDate: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const hour = map.hour === '24' ? '00' : map.hour;
  const localAsUtcMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(hour),
    Number(map.minute),
    Number(map.second),
  );
  return Math.round((localAsUtcMs - utcDate.getTime()) / 60000);
}

/**
 * Converts a local date ("YYYY-MM-DD") and local time ("HH:MM") in `timeZone`
 * into an ISO UTC timestamp string (`timestamptz` equivalent).
 */
export function localDateTimeToUtcIso(dateStr: string, timeStr: string, timeZone: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  // First estimate using naive instant
  const firstGuess = new Date(naiveUtcMs);
  const offset1 = getTimeZoneOffsetMinutes(firstGuess, timeZone);
  const adjustedMs = naiveUtcMs - offset1 * 60000;
  // Second pass handles DST boundaries accurately
  const secondGuess = new Date(adjustedMs);
  const offset2 = getTimeZoneOffsetMinutes(secondGuess, timeZone);
  return new Date(naiveUtcMs - offset2 * 60000).toISOString();
}

export function utcIsoToLocalParts(isoStr: string, timeZone: string): {
  date: string;
  time: string;
  dayOfWeek: number;
  minutesFromMidnight: number;
} {
  const dateObj = new Date(isoStr);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = formatter.formatToParts(dateObj);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const hourNum = Number(map.hour === '24' ? '0' : map.hour);
  const minNum = Number(map.minute);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${String(hourNum).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`,
    dayOfWeek: weekdayMap[map.weekday] ?? 0,
    minutesFromMidnight: hourNum * 60 + minNum,
  };
}

export function getLocalDayOfWeek(dateStr: string, timeZone: string): number {
  const iso = localDateTimeToUtcIso(dateStr, '12:00', timeZone);
  return utcIsoToLocalParts(iso, timeZone).dayOfWeek;
}

export function getTodayDateStr(timeZone: string): string {
  return utcIsoToLocalParts(new Date().toISOString(), timeZone).date;
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function timeStrToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
