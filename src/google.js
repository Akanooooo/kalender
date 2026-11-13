import { toGoogleInsert, fromGoogleEvent } from './model.js';

const API = 'https://www.googleapis.com/calendar/v3';

const OUTPUT_ONLY = [
  'kind',
  'etag',
  'htmlLink',
  'created',
  'updated',
  'creator',
  'organizer',
  'iCalUID',
  'sequence',
  'recurringEventId',
  'originalStartTime',
  'hangoutLink',
];

export class ApiError extends Error {
  constructor(status, message, detail = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

function messageFor(status) {
  if (status === 0) return 'Keine Verbindung zu Google.';
  if (status === 401) return 'Die Anmeldung ist abgelaufen. Bitte melde dich erneut an.';
  if (status === 403) {
    return 'Kein Zugriff auf den Kalender. Ist die Calendar API aktiv und dein Konto als Testnutzer eingetragen?';
  }
  if (status === 404) return 'Der Termin wurde nicht gefunden.';
  if (status === 400) return 'Google hat die Angaben nicht akzeptiert. Bitte prüfe Datum und Uhrzeit.';
  if (status === 412) return 'Der Termin wurde zwischenzeitlich geändert. Bitte aktualisieren und erneut versuchen.';
  if (status === 429) return 'Zu viele Anfragen. Warte einen Moment und versuche es erneut.';
  if (status >= 500) return 'Google Kalender ist gerade nicht erreichbar.';
  return 'Der Kalender konnte nicht erreicht werden.';
}

async function gfetch(token, url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body,
    });
  } catch (error) {
    const wrapped = new ApiError(0, messageFor(0));
    wrapped.cause = error;
    throw wrapped;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!response.ok) {
    const detail = data?.error?.message || '';
    console.error('Google Calendar API', response.status, detail);
    throw new ApiError(response.status, messageFor(response.status), detail);
  }
  return data;
}

export function eventsListUrl({ timeMin, timeMax, pageToken }) {
  const url = new URL(`${API}/calendars/primary/events`);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('maxResults', '2500');
  url.searchParams.set('showDeleted', 'false');
  url.searchParams.set(
    'fields',
    'items(id,summary,description,location,start,end,status,htmlLink,colorId,updated),nextPageToken',
  );
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  return url;
}

export function buildUpdateBody(existing, draft) {
  const body = { ...existing };
  for (const key of OUTPUT_ONLY) delete body[key];
  const next = toGoogleInsert(draft);
  body.summary = next.summary;
  body.location = next.location;
  body.description = next.description;
  body.start = next.start;
  body.end = next.end;
  return body;
}

export async function fetchCalendar(token) {
  return gfetch(token, `${API}/calendars/primary`);
}

export async function listEvents(token, { timeMin, timeMax }) {
  const items = [];
  let pageToken = '';
  let page = 0;
  do {
    const url = eventsListUrl({ timeMin, timeMax, pageToken });
    const data = await gfetch(token, url);
    items.push(...(data.items || []));
    pageToken = data.nextPageToken || '';
    page += 1;
  } while (pageToken && page < 10);
  return items.map(fromGoogleEvent).filter(Boolean);
}

export async function createEvent(token, draft) {
  return gfetch(token, `${API}/calendars/primary/events`, {
    method: 'POST',
    body: JSON.stringify(toGoogleInsert(draft)),
  });
}

export async function updateEvent(token, id, draft) {
  const existing = await gfetch(
    token,
    `${API}/calendars/primary/events/${encodeURIComponent(id)}`,
  );
  return gfetch(token, `${API}/calendars/primary/events/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(buildUpdateBody(existing, draft)),
  });
}

export async function deleteEvent(token, id) {
  await gfetch(token, `${API}/calendars/primary/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
