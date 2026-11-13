import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDaysYmd,
  berlinLocalToUtcDate,
  berlinStamp,
  formatWeekRange,
  getOffsetMinutes,
  isoWeekNumber,
  monthGrid,
  startOfWeekYmd,
  weekdayMon0,
} from '../src/dates.js';
import { buildDemoEvents } from '../src/demo.js';
import { esc, linkify } from '../src/html.js';
import { layoutDayEvents } from '../src/layout.js';
import {
  agendaDays,
  draftToEvent,
  fromGoogleEvent,
  occurrenceOnDay,
  toGoogleInsert,
  validateDraft,
} from '../src/model.js';
import { buildUpdateBody, eventsListUrl } from '../src/google.js';

test('Berlin winter and summer offsets', () => {
  assert.equal(getOffsetMinutes(new Date('2026-11-13T09:00:00Z')), 60);
  assert.equal(getOffsetMinutes(new Date('2026-06-15T08:00:00Z')), 120);
  assert.equal(berlinLocalToUtcDate(2026, 11, 13, 10, 0).toISOString(), '2026-11-13T09:00:00.000Z');
  assert.equal(berlinLocalToUtcDate(2026, 6, 15, 10, 0).toISOString(), '2026-06-15T08:00:00.000Z');
  assert.equal(berlinStamp('2026-11-13', '10:00'), '2026-11-13T10:00:00+01:00');
  assert.equal(berlinStamp('2026-06-15', '10:00'), '2026-06-15T10:00:00+02:00');
});

test('weeks start on Monday and November 2026 is a known calendar', () => {
  assert.equal(weekdayMon0('2026-11-13'), 4);
  assert.equal(weekdayMon0('2026-11-09'), 0);
  assert.equal(weekdayMon0('2026-11-15'), 6);
  assert.equal(startOfWeekYmd('2026-11-13'), '2026-11-09');
  assert.equal(isoWeekNumber('2026-11-09'), isoWeekNumber('2026-11-15'));
  assert.notEqual(isoWeekNumber('2026-11-15'), isoWeekNumber('2026-11-16'));
  const grid = monthGrid('2026-11-13');
  assert.equal(grid.cells.length, 42);
  assert.equal(grid.cells[0].ymd, '2026-10-26');
  assert.equal(weekdayMon0(grid.cells[0].ymd), 0);
  assert.equal(grid.cells.find((cell) => cell.ymd === '2026-11-13').inMonth, true);
  assert.match(formatWeekRange('2026-11-09', '2026-11-15'), /9\./);
  assert.match(formatWeekRange('2026-11-09', '2026-11-15'), /November/);
  assert.match(formatWeekRange('2026-11-30', '2026-12-06'), /Dez/);
});

test('Google all-day events use an exclusive end and timed events keep Berlin labels', () => {
  const allDay = fromGoogleEvent({
    id: 'a',
    status: 'confirmed',
    summary: 'Geburtstag',
    start: { date: '2026-11-13' },
    end: { date: '2026-11-15' },
  });
  assert.equal(allDay.allDay, true);
  assert.equal(allDay.startDate, '2026-11-13');
  assert.equal(allDay.endDate, '2026-11-14');
  assert.ok(occurrenceOnDay(allDay, '2026-11-13'));
  assert.ok(occurrenceOnDay(allDay, '2026-11-14'));
  assert.equal(occurrenceOnDay(allDay, '2026-11-15'), null);

  const timed = fromGoogleEvent({
    id: 'b',
    summary: 'Zahnarzt',
    start: { dateTime: '2026-11-13T10:00:00+01:00', timeZone: 'Europe/Berlin' },
    end: { dateTime: '2026-11-13T11:00:00+01:00', timeZone: 'Europe/Berlin' },
  });
  assert.equal(occurrenceOnDay(timed, '2026-11-13').timeLabel, '10:00–11:00');
  assert.equal(occurrenceOnDay(timed, '2026-11-14'), null);
  assert.equal(fromGoogleEvent({ id: 'x', status: 'cancelled', start: { date: '2026-11-13' } }), null);
});

test('events that cross midnight are split across both days', () => {
  const event = fromGoogleEvent({
    id: 'night',
    summary: 'Nachtzug',
    start: { dateTime: '2026-11-13T22:00:00+01:00' },
    end: { dateTime: '2026-11-14T01:30:00+01:00' },
  });
  assert.equal(occurrenceOnDay(event, '2026-11-13').timeLabel, '22:00–00:00');
  assert.equal(occurrenceOnDay(event, '2026-11-14').timeLabel, '00:00–01:30');
  assert.equal(occurrenceOnDay(event, '2026-11-12'), null);
});

test('insert bodies and updates keep fields the assistant may have set', () => {
  const timed = toGoogleInsert({
    title: '  Zahnarzt ',
    location: 'Berlin',
    notes: 'Karte',
    allDay: false,
    startDate: '2026-11-13',
    startTime: '10:00',
    endDate: '2026-11-13',
    endTime: '11:00',
  });
  assert.equal(timed.summary, 'Zahnarzt');
  assert.equal(timed.start.timeZone, 'Europe/Berlin');
  assert.equal(timed.start.dateTime, '2026-11-13T10:00:00+01:00');

  const allDay = toGoogleInsert({
    title: 'Geburtstag',
    location: '',
    notes: '',
    allDay: true,
    startDate: '2026-11-13',
    endDate: '2026-11-13',
  });
  assert.equal(allDay.start.date, '2026-11-13');
  assert.equal(allDay.end.date, '2026-11-14');

  const updated = buildUpdateBody(
    {
      id: 'evt1',
      etag: '"abc"',
      kind: 'calendar#event',
      htmlLink: 'https://calendar.google.com/event?eid=1',
      summary: 'Alt',
      attendees: [{ email: 'a@b.c' }],
      reminders: { useDefault: true },
      start: { date: '2026-11-13' },
      end: { date: '2026-11-14' },
    },
    {
      title: 'Neu',
      location: 'Berlin',
      notes: 'Hallo',
      allDay: false,
      startDate: '2026-11-13',
      startTime: '10:00',
      endDate: '2026-11-13',
      endTime: '11:00',
    },
  );
  assert.equal(updated.summary, 'Neu');
  assert.equal(updated.attendees[0].email, 'a@b.c');
  assert.equal(updated.reminders.useDefault, true);
  assert.equal(updated.start.date, undefined);
  assert.equal(updated.start.timeZone, 'Europe/Berlin');
  assert.equal(updated.etag, undefined);
  assert.equal(updated.id, 'evt1');

  const url = eventsListUrl({
    timeMin: '2026-01-01T00:00:00.000Z',
    timeMax: '2026-02-01T00:00:00.000Z',
  });
  assert.match(url.pathname, /\/calendars\/primary\/events$/);
  assert.equal(url.searchParams.get('singleEvents'), 'true');
  assert.equal(url.searchParams.get('orderBy'), 'startTime');
});

test('validation, overlap layout, demo data and escaping', () => {
  assert.equal(validateDraft({ title: '  ', allDay: true, startDate: '2026-11-13', endDate: '2026-11-13' }), 'Bitte einen Titel eingeben.');
  assert.equal(
    validateDraft({
      title: 'A',
      allDay: false,
      startDate: '2026-11-13',
      startTime: '11:00',
      endDate: '2026-11-13',
      endTime: '10:00',
      location: '',
      notes: '',
    }),
    'Das Ende liegt vor dem Beginn.',
  );
  assert.equal(
    validateDraft({
      title: 'A',
      allDay: true,
      startDate: '2026-11-13',
      endDate: '2026-11-13',
      location: '',
      notes: '',
    }),
    '',
  );

  const placed = layoutDayEvents([
    { id: 'a', startMin: 16 * 60, endMin: 17 * 60 },
    { id: 'b', startMin: 16 * 60 + 15, endMin: 16 * 60 + 45 },
    { id: 'c', startMin: 18 * 60, endMin: 19 * 60 },
  ]);
  const a = placed.find((item) => item.id === 'a');
  const b = placed.find((item) => item.id === 'b');
  const c = placed.find((item) => item.id === 'c');
  assert.equal(a.cols, 2);
  assert.equal(b.cols, 2);
  assert.notEqual(a.col, b.col);
  assert.equal(c.cols, 1);

  const events = buildDemoEvents('2026-11-13');
  assert.equal(new Set(events.map((event) => event.id)).size, events.length);
  const titles = agendaDays(events, '2026-11-13').days.find((day) => day.ymd === '2026-11-13').items.map((item) => item.event.title);
  assert.ok(titles.includes('Zahnarzt'));
  assert.ok(titles.includes('Paket erwartet'));
  assert.ok(titles.indexOf('Paket erwartet') < titles.indexOf('Zahnarzt'));

  for (const day of ['2026-01-01', '2026-03-29', '2026-10-25', '2026-12-31']) {
    for (const event of buildDemoEvents(day)) {
      if (event.allDay) assert.ok(event.endDate >= event.startDate);
      else assert.ok(new Date(event.end) > new Date(event.start));
    }
  }

  const saved = draftToEvent(
    {
      title: 'Spaziergang',
      location: 'Park',
      notes: 'Kurz',
      allDay: false,
      startDate: '2026-11-13',
      startTime: '15:00',
      endDate: '2026-11-13',
      endTime: '16:00',
      colorId: null,
    },
    'demo-user-1',
  );
  assert.equal(saved.start, '2026-11-13T15:00:00+01:00');
  assert.equal(addDaysYmd('2026-11-13', 1), '2026-11-14');

  assert.equal(esc('<script>'), '&lt;script&gt;');
  const html = linkify('Siehe https://example.com/a. und <b>');
  assert.ok(html.includes('href="https://example.com/a"'));
  assert.ok(html.includes('&lt;b&gt;'));
  assert.ok(!html.includes('<b>'));
});
