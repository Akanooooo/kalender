import {
  TZ,
  addClock,
  addDaysYmd,
  berlinLocalToUtcDate,
  berlinStamp,
  clockToMs,
  diffDays,
  formatDayMonth,
  formatDuration,
  formatHM,
  formatLongDate,
  formatTime,
  pad,
  todayYmd,
  toYMD,
  zonedParts,
} from './dates.js';

const COLORS = {
  1: '#7986CB',
  2: '#33B679',
  3: '#8E24AA',
  4: '#E67C73',
  5: '#F6BF26',
  6: '#F4511E',
  7: '#039BE5',
  8: '#616161',
  9: '#3F51B5',
  10: '#0B8043',
  11: '#D50000',
};

export function eventColor(colorId) {
  return COLORS[String(colorId)] || '#0A84FF';
}

export function fromGoogleEvent(item) {
  if (!item || item.status === 'cancelled' || !item.id) return null;
  const title = item.summary?.trim() || '(Ohne Titel)';
  const location = item.location || '';
  const notes = item.description || '';
  const colorId = item.colorId || null;
  const htmlLink = typeof item.htmlLink === 'string' ? item.htmlLink : null;
  const updated = item.updated || null;

  if (item.start?.date) {
    const startDate = item.start.date;
    const endExclusive = item.end?.date || addDaysYmd(startDate, 1);
    const endDate = addDaysYmd(endExclusive, -1);
    if (endDate < startDate) return null;
    return {
      id: item.id,
      title,
      location,
      notes,
      allDay: true,
      startDate,
      endDate,
      start: null,
      end: null,
      colorId,
      htmlLink,
      updated,
    };
  }

  if (!item.start?.dateTime) return null;
  const start = item.start.dateTime;
  const end = item.end?.dateTime || new Date(new Date(start).getTime() + 3600000).toISOString();
  const startParts = zonedParts(new Date(start));
  const endParts = zonedParts(new Date(end));
  return {
    id: item.id,
    title,
    location,
    notes,
    allDay: false,
    start,
    end,
    startDate: toYMD(startParts),
    endDate: toYMD(endParts),
    colorId,
    htmlLink,
    updated,
  };
}

export function toGoogleInsert(draft) {
  const body = {
    summary: draft.title.trim(),
    location: draft.location.trim(),
    description: draft.notes.trim(),
  };
  if (draft.allDay) {
    body.start = { date: draft.startDate };
    body.end = { date: addDaysYmd(draft.endDate, 1) };
  } else {
    body.start = {
      dateTime: berlinStamp(draft.startDate, draft.startTime),
      timeZone: TZ,
    };
    body.end = {
      dateTime: berlinStamp(draft.endDate, draft.endTime),
      timeZone: TZ,
    };
  }
  return body;
}

export function sanitizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.filter(
    (event) =>
      event &&
      typeof event.id === 'string' &&
      typeof event.title === 'string' &&
      (event.allDay ? typeof event.startDate === 'string' : typeof event.start === 'string'),
  );
}

export function eachCoveredDay(event, rangeStart, rangeEnd) {
  let start;
  let end;
  if (event.allDay) {
    start = event.startDate;
    end = event.endDate;
  } else {
    if (!event.start || !event.end) return [];
    start = toYMD(zonedParts(new Date(event.start)));
    const endParts = zonedParts(new Date(event.end));
    end = toYMD(endParts);
    const endsAtMidnight =
      endParts.hour === 0 && endParts.minute === 0 && endParts.second === 0 && end > start;
    if (endsAtMidnight) end = addDaysYmd(end, -1);
  }
  if (!start || !end) return [];
  if (rangeStart && start < rangeStart) start = rangeStart;
  if (rangeEnd && end > rangeEnd) end = rangeEnd;
  if (start > end) return [];

  const days = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 800) {
    days.push(cursor);
    cursor = addDaysYmd(cursor, 1);
    guard += 1;
  }
  return days;
}

export function occurrenceOnDay(event, ymd) {
  if (event.allDay) {
    if (ymd < event.startDate || ymd > event.endDate) return null;
    return {
      event,
      allDay: true,
      startMin: -1,
      endMin: -1,
      startLabel: 'Ganztägig',
      endLabel: '',
      timeLabel: 'Ganztägig',
    };
  }
  if (!event.start || !event.end) return null;
  const [year, month, day] = ymd.split('-').map(Number);
  const startMs = berlinLocalToUtcDate(year, month, day, 0, 0, 0).getTime();
  const next = addDaysYmd(ymd, 1).split('-').map(Number);
  const endMs = berlinLocalToUtcDate(next[0], next[1], next[2], 0, 0, 0).getTime();
  const eventStart = new Date(event.start).getTime();
  const eventEnd = new Date(event.end).getTime();
  if (!(eventEnd > startMs && eventStart < endMs)) return null;

  const clippedStart = Math.max(eventStart, startMs);
  const clippedEnd = Math.min(eventEnd, endMs);
  const startParts = zonedParts(new Date(clippedStart));
  const startMin = startParts.hour * 60 + startParts.minute;
  let endMin;
  if (clippedEnd === endMs) endMin = 24 * 60;
  else {
    const endParts = zonedParts(new Date(clippedEnd));
    endMin = endParts.hour * 60 + endParts.minute;
  }
  if (endMin <= startMin) endMin = Math.min(24 * 60, startMin + 30);
  const startLabel = formatHM(startMin);
  const endLabel = formatHM(endMin === 1440 ? 0 : endMin);
  return {
    event,
    allDay: false,
    startMin,
    endMin,
    startLabel,
    endLabel,
    timeLabel: `${startLabel}–${endLabel}`,
  };
}

export function groupOccurrences(events, today) {
  const rangeStart = addDaysYmd(today, -400);
  const rangeEnd = addDaysYmd(today, 500);
  const map = new Map();
  for (const event of events) {
    for (const ymd of eachCoveredDay(event, rangeStart, rangeEnd)) {
      const occurrence = occurrenceOnDay(event, ymd);
      if (!occurrence) continue;
      if (!map.has(ymd)) map.set(ymd, []);
      map.get(ymd).push(occurrence);
    }
  }
  for (const items of map.values()) {
    items.sort(
      (a, b) => a.startMin - b.startMin || a.event.title.localeCompare(b.event.title, 'de'),
    );
  }
  return map;
}

export function agendaDays(events, today, horizon = 60) {
  const map = groupOccurrences(events, today);
  const last = addDaysYmd(today, horizon);
  const ymds = [...map.keys()].filter((ymd) => ymd >= today && ymd <= last && map.get(ymd)?.length);
  if (!ymds.includes(today)) ymds.push(today);
  ymds.sort();
  return {
    map,
    last,
    days: ymds.map((ymd) => ({ ymd, items: map.get(ymd) || [] })),
  };
}

export function formatEventWhen(event, today) {
  if (event.allDay) {
    const days = diffDays(event.startDate, event.endDate) + 1;
    const primary =
      event.startDate === event.endDate
        ? formatLongDate(event.startDate)
        : `${formatDayMonth(event.startDate, today)} – ${formatDayMonth(event.endDate, today)}`;
    const secondary = days === 1 ? 'Ganztägig' : `Ganztägig · ${days} Tage`;
    return { primary, secondary };
  }
  const start = new Date(event.start);
  const end = new Date(event.end);
  const startYmd = toYMD(zonedParts(start));
  const endYmd = toYMD(zonedParts(end));
  const startTime = formatTime(start);
  const endTime = formatTime(end);
  const duration = formatDuration(end - start);
  if (startYmd === endYmd) {
    return { primary: formatLongDate(startYmd), secondary: `${startTime}–${endTime} · ${duration}` };
  }
  return {
    primary: `${formatDayMonth(startYmd, today)}, ${startTime}`,
    secondary: `bis ${formatDayMonth(endYmd, today)}, ${endTime} · ${duration}`,
  };
}

export function validateDraft(draft) {
  if (!draft.title.trim()) return 'Bitte einen Titel eingeben.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate || '')) return 'Bitte ein Startdatum wählen.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.endDate || '')) return 'Bitte ein Enddatum wählen.';
  if (draft.allDay) {
    if (draft.endDate < draft.startDate) return 'Das Ende liegt vor dem Beginn.';
    return '';
  }
  if (!/^\d{2}:\d{2}$/.test(draft.startTime || '') || !/^\d{2}:\d{2}$/.test(draft.endTime || '')) {
    return 'Bitte Beginn und Ende mit Uhrzeit angeben.';
  }
  const start = clockToMs(draft.startDate, draft.startTime);
  const end = clockToMs(draft.endDate, draft.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Bitte Beginn und Ende prüfen.';
  if (end <= start) return 'Das Ende liegt vor dem Beginn.';
  return '';
}

export function blankDraft({ date, minutes } = {}) {
  const today = todayYmd();
  const ymd = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  let startTime = '09:00';
  if (Number.isInteger(minutes)) {
    const hour = Math.max(0, Math.min(23, Math.floor(minutes / 60)));
    const minute = Math.max(0, Math.min(59, minutes % 60));
    startTime = `${pad(hour)}:${pad(minute)}`;
  } else if (ymd === today) {
    const now = zonedParts(new Date());
    let hour = now.minute > 0 ? now.hour + 1 : now.hour;
    if (hour > 23) hour = 23;
    startTime = `${pad(hour)}:00`;
  }
  const end = addClock(ymd, startTime, 60);
  return {
    id: null,
    title: '',
    location: '',
    notes: '',
    allDay: false,
    startDate: ymd,
    startTime,
    endDate: end.date,
    endTime: end.time,
    colorId: null,
  };
}

export function eventToDraft(event) {
  const title = event.title === '(Ohne Titel)' ? '' : event.title;
  if (event.allDay) {
    return {
      id: event.id,
      title,
      location: event.location || '',
      notes: event.notes || '',
      allDay: true,
      startDate: event.startDate,
      endDate: event.endDate,
      startTime: '09:00',
      endTime: '10:00',
      colorId: event.colorId || null,
    };
  }
  const start = zonedParts(new Date(event.start));
  const end = zonedParts(new Date(event.end));
  return {
    id: event.id,
    title,
    location: event.location || '',
    notes: event.notes || '',
    allDay: false,
    startDate: toYMD(start),
    startTime: `${pad(start.hour)}:${pad(start.minute)}`,
    endDate: toYMD(end),
    endTime: `${pad(end.hour)}:${pad(end.minute)}`,
    colorId: event.colorId || null,
  };
}

export function draftToEvent(draft, id) {
  const base = {
    id,
    title: draft.title.trim(),
    location: draft.location.trim(),
    notes: draft.notes.trim(),
    colorId: draft.colorId || null,
    htmlLink: null,
    updated: new Date().toISOString(),
  };
  if (draft.allDay) {
    return {
      ...base,
      allDay: true,
      startDate: draft.startDate,
      endDate: draft.endDate,
      start: null,
      end: null,
    };
  }
  return {
    ...base,
    allDay: false,
    startDate: draft.startDate,
    endDate: draft.endDate,
    start: berlinStamp(draft.startDate, draft.startTime),
    end: berlinStamp(draft.endDate, draft.endTime),
  };
}
