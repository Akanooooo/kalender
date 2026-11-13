export const TZ = 'Europe/Berlin';
export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function pad(value) {
  return String(value).padStart(2, '0');
}

export function splitYmd(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
}

export function toYMD({ year, month, day }) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function getOffsetMinutes(date, timeZone = TZ) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  let hour = Number(parts.hour);
  let day = Number(parts.day);
  let month = Number(parts.month);
  let year = Number(parts.year);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(year, month - 1, day, hour, Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - date.getTime()) / 60000);
}

export function berlinLocalToUtcDate(year, month, day, hour = 0, minute = 0, second = 0) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = getOffsetMinutes(new Date(guess));
  let ms = guess - offset * 60000;
  const offset2 = getOffsetMinutes(new Date(ms));
  if (offset2 !== offset) ms = guess - offset2 * 60000;
  return new Date(ms);
}

export function zonedParts(date, timeZone = TZ) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function todayYmd(now = new Date()) {
  return toYMD(zonedParts(now));
}

export function addDaysYmd(ymd, days) {
  const { year, month, day } = splitYmd(ymd);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return toYMD({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function diffDays(fromYmd, toYmd) {
  const a = splitYmd(fromYmd);
  const b = splitYmd(toYmd);
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86400000);
}

export function weekdayMon0(ymd) {
  const { year, month, day } = splitYmd(ymd);
  const sunday0 = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sunday0 + 6) % 7;
}

export function startOfWeekYmd(ymd) {
  return addDaysYmd(ymd, -weekdayMon0(ymd));
}

export function isoWeekNumber(ymd) {
  const { year, month, day } = splitYmd(ymd);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

export function shiftMonthYmd(ymd, delta) {
  const { year, month, day } = splitYmd(ymd);
  const target = new Date(Date.UTC(year, month - 1 + delta, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth() + 1;
  const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return toYMD({ year: ty, month: tm, day: Math.min(day, last) });
}

export function monthGrid(focusYmd) {
  const { year, month } = splitYmd(focusYmd);
  const first = toYMD({ year, month, day: 1 });
  const start = startOfWeekYmd(first);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const ymd = addDaysYmd(start, i);
    const parts = splitYmd(ymd);
    cells.push({
      ymd,
      day: parts.day,
      inMonth: parts.month === month && parts.year === year,
      sunday: weekdayMon0(ymd) === 6,
    });
  }
  return { year, month, cells };
}

export function berlinStamp(ymd, hm) {
  const [hour, minute] = hm.split(':').map(Number);
  const { year, month, day } = splitYmd(ymd);
  const instant = berlinLocalToUtcDate(year, month, day, hour, minute, 0);
  const offset = getOffsetMinutes(instant);
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${ymd}T${pad(hour)}:${pad(minute)}:00${sign}${pad(Math.trunc(abs / 60))}:${pad(abs % 60)}`;
}

export function clockToMs(ymd, hm) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '') || !/^\d{2}:\d{2}$/.test(hm || '')) return NaN;
  const [hour, minute] = hm.split(':').map(Number);
  if (hour > 23 || minute > 59) return NaN;
  const { year, month, day } = splitYmd(ymd);
  return berlinLocalToUtcDate(year, month, day, hour, minute, 0).getTime();
}

export function addClock(ymd, hm, deltaMinutes) {
  const ms = clockToMs(ymd, hm);
  const parts = zonedParts(new Date(ms + deltaMinutes * 60000));
  return { date: toYMD(parts), time: `${pad(parts.hour)}:${pad(parts.minute)}` };
}

export function nowMinutes(date = new Date()) {
  const parts = zonedParts(date);
  return parts.hour * 60 + parts.minute;
}

export function formatHM(minutes) {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${pad(hour)}:${pad(minute)}`;
}

function ymdAtNoonUtc(ymd) {
  const { year, month, day } = splitYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function formatLongDate(ymd) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(ymdAtNoonUtc(ymd));
}

export function formatWeekday(ymd) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: TZ,
    weekday: 'long',
  }).format(ymdAtNoonUtc(ymd));
}

export function formatMonthName(year, month) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'UTC',
    month: 'long',
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

export function formatShortMonth(month) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'UTC',
    month: 'short',
  }).format(new Date(Date.UTC(2026, month - 1, 1, 12)));
}

export function formatDayMonth(ymd, today) {
  const parts = splitYmd(ymd);
  const base = `${parts.day}. ${formatMonthName(parts.year, parts.month)}`;
  if (today && splitYmd(today).year !== parts.year) return `${base} ${parts.year}`;
  return base;
}

export function formatWeekRange(startYmd, endYmd) {
  const start = splitYmd(startYmd);
  const end = splitYmd(endYmd);
  if (start.year === end.year && start.month === end.month) {
    return `${start.day}.–${end.day}. ${formatMonthName(start.year, start.month)}`;
  }
  const startLabel = `${start.day}. ${formatShortMonth(start.month)}`;
  const endLabel = `${end.day}. ${formatShortMonth(end.month)}`;
  if (start.year === end.year) return `${startLabel} – ${endLabel}`;
  return `${startLabel} ${start.year} – ${endLabel} ${end.year}`;
}

export function formatTime(date) {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function formatDuration(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return minutes === 1 ? '1 Minute' : `${minutes} Minuten`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = hours === 1 ? '1 Stunde' : `${hours} Stunden`;
  if (!rest) return hourLabel;
  return `${hourLabel} ${rest} Min.`;
}

export function formatSync(ms, today = todayYmd()) {
  const date = new Date(ms);
  const ymd = toYMD(zonedParts(date));
  const time = formatTime(date);
  if (ymd === today) return `heute, ${time}`;
  return `${formatDayMonth(ymd, today)}, ${time}`;
}

export function fetchWindow(focusYmd) {
  const startYmd = addDaysYmd(focusYmd, -400);
  const endYmd = addDaysYmd(focusYmd, 500);
  const start = splitYmd(startYmd);
  const end = splitYmd(addDaysYmd(endYmd, 1));
  return {
    startYmd,
    endYmd,
    timeMin: berlinLocalToUtcDate(start.year, start.month, start.day, 0, 0, 0).toISOString(),
    timeMax: berlinLocalToUtcDate(end.year, end.month, end.day, 0, 0, 0).toISOString(),
  };
}
