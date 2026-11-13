import { state } from './state.js';
import { clientIdStatus } from './config.js';
import {
  WEEKDAYS,
  addClock,
  addDaysYmd,
  clockToMs,
  formatDayMonth,
  formatHM,
  formatLongDate,
  formatMonthName,
  formatSync,
  formatWeekRange,
  isoWeekNumber,
  monthGrid,
  nowMinutes,
  pad,
  splitYmd,
  startOfWeekYmd,
  weekdayMon0,
} from './dates.js';
import { HOUR_HEIGHT, layoutDayEvents } from './layout.js';
import { agendaDays, eventColor, formatEventWhen } from './model.js';
import { esc, linkify, mapsUrl, safeHttpUrl } from './html.js';
import { googleG, icons, logoSvg } from './icons.js';

let toastTimer = 0;
let sheetKey = '';
let confirmKey = '';

export function applyTheme(preference) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = preference === 'dark' || (preference === 'system' && systemDark) ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolved;
  const color = resolved === 'dark' ? '#000000' : '#f2f2f7';
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', color);
  });
}

export function toast(text) {
  state.toast = text;
  render({ main: false, overlay: false, toast: true });
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (state.toast === text) {
      state.toast = null;
      render({ main: false, overlay: false, toast: true });
    }
  }, 3200);
}

export function readForm() {
  const form = document.getElementById('event-form');
  if (!form) return null;
  const data = new FormData(form);
  return {
    id: form.dataset.id || null,
    title: String(data.get('title') || ''),
    location: String(data.get('location') || ''),
    notes: String(data.get('notes') || ''),
    allDay: Boolean(form.querySelector('[name="allDay"]')?.checked),
    startDate: String(data.get('startDate') || ''),
    startTime: String(data.get('startTime') || ''),
    endDate: String(data.get('endDate') || ''),
    endTime: String(data.get('endTime') || ''),
    colorId: form.dataset.colorId || null,
  };
}

export function editorIsDirty() {
  if (state.sheet?.type !== 'edit') return false;
  const current = readForm();
  const draft = state.sheet.draft;
  if (!current || !draft) return false;
  return ['title', 'location', 'notes', 'startDate', 'startTime', 'endDate', 'endTime'].some(
    (key) => String(current[key] ?? '') !== String(draft[key] ?? ''),
  ) || current.allDay !== draft.allDay;
}

export function showFormError(message) {
  const error = document.querySelector('#event-form .form-error');
  if (!error) return;
  error.textContent = message || '';
  if (message) error.scrollIntoView({ block: 'nearest' });
}

export function setFormBusy(busy, message) {
  state.busy = busy;
  const form = document.getElementById('event-form');
  if (!form) return;
  const button = form.querySelector('.nav-done');
  if (button) {
    button.disabled = busy;
    button.textContent = busy ? 'Einen Moment…' : button.dataset.label;
  }
  form.querySelectorAll('input, textarea').forEach((field) => {
    field.disabled = busy;
  });
  if (message != null) showFormError(message);
}

export function setConfirmBusy(busy) {
  const button = document.querySelector('.action-danger');
  if (!button) return;
  button.disabled = busy;
  if (busy) button.textContent = 'Einen Moment…';
}

export function render(options = {}) {
  const { main = true, overlay = true, toast: showToast = true } = options;
  try {
    if (main) renderMain();
    if (overlay) renderOverlay();
    if (showToast) renderToast();
    syncTitle();
  } catch (error) {
    console.error(error);
    const root = document.getElementById('main');
    if (root && main) {
      root.innerHTML = '<p class="fatal">Die Ansicht konnte nicht aufgebaut werden.</p>';
    }
  }
}

function syncTitle() {
  if (state.mode === 'signedout') document.title = 'Kalender';
  else if (state.view === 'week') document.title = 'Woche · Kalender';
  else if (state.view === 'month') document.title = 'Monat · Kalender';
  else document.title = 'Heute · Kalender';
}

let lastRender = { view: '', focus: '', mode: '' };

function renderMain() {
  const main = document.getElementById('main');
  const previous = document.getElementById('inhalt');
  const previousTop = previous ? previous.scrollTop : 0;
  const preserve =
    Boolean(previous) &&
    lastRender.view === state.view &&
    lastRender.focus === state.focusDate &&
    lastRender.mode === state.mode;

  if (state.mode === 'signedout') {
    main.innerHTML = renderWelcome();
    lastRender = { view: state.view, focus: state.focusDate, mode: state.mode };
    return;
  }

  const agenda = agendaDays(state.events, state.today);
  main.innerHTML = renderApp(agenda);
  lastRender = { view: state.view, focus: state.focusDate, mode: state.mode };
  const scroller = document.getElementById('inhalt');
  if (!scroller) return;
  scroller.addEventListener(
    'scroll',
    () => {
      document.querySelector('.topbar')?.classList.toggle('is-scrolled', scroller.scrollTop > 2);
    },
    { passive: true },
  );
  if (preserve) {
    scroller.scrollTop = previousTop;
    if (previousTop > 2) document.querySelector('.topbar')?.classList.add('is-scrolled');
    return;
  }
  if (state.view === 'week') {
    const hour = weekScrollHour(agenda.map);
    requestAnimationFrame(() => scrollWeekToHour(scroller, hour));
  } else {
    scroller.scrollTop = 0;
  }
}

function weekScrollHour(map) {
  if (state.focusDate === state.today) {
    return Math.max(0, Math.min(18, Math.floor(nowMinutes() / 60) - 1));
  }
  const first = (map.get(state.focusDate) || []).find((item) => !item.allDay);
  if (!first) return 8;
  return Math.max(0, Math.floor(first.startMin / 60) - 1);
}

function scrollWeekToHour(scroller, hour) {
  const canvas = scroller.querySelector('.day-canvas');
  if (!canvas) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const canvasTop = canvasRect.top - scrollerRect.top + scroller.scrollTop;
  scroller.scrollTop = Math.max(0, canvasTop + hour * HOUR_HEIGHT - 8);
}

function renderWelcome() {
  const { problem } = clientIdStatus();
  const googleDisabled = problem === 'missing' || state.signingIn;
  const demoClass = problem === 'missing' ? 'btn btn-primary' : 'btn btn-secondary';
  const foot =
    problem === 'missing'
      ? 'Trag deine OAuth-Client-ID in config.js ein. Die Schritte stehen in der README. Die Demo funktioniert schon jetzt, ganz ohne Anmeldung.'
      : problem === 'format'
        ? 'Die Client-ID sollte auf .apps.googleusercontent.com enden. Prüfe config.js. Die Demo kannst du trotzdem ansehen.'
        : 'Die Anmeldung läuft direkt bei Google. Diese App hat keinen eigenen Server, das Zugriffstoken bleibt in diesem Browser.';
  return `<div class="scroller welcome-scroll" id="inhalt">
    <section class="welcome">
      ${logoSvg()}
      <h1>Kalender</h1>
      <p class="lead">Dein Google-Kalender, übersichtlich an einem Ort. Was dein Assistent dort einträgt, erscheint hier beim nächsten Aktualisieren.</p>
      <div class="welcome-actions">
        <button type="button" class="btn btn-google" data-action="signin" ${googleDisabled ? 'disabled' : ''}>
          ${googleG()}
          <span>${state.signingIn ? 'Anmeldung läuft…' : 'Mit Google anmelden'}</span>
        </button>
        <button type="button" class="${demoClass}" data-action="demo">Demo ansehen</button>
        <p class="fine">${esc(foot)}</p>
      </div>
    </section>
  </div>`;
}

function renderApp(agenda) {
  return `${renderTopbar()}<div class="scroller" id="inhalt" tabindex="-1" aria-busy="${state.loading ? 'true' : 'false'}">
    <div class="pull" id="pull" aria-hidden="true"><span class="spinner"></span><span class="pull-label">Ziehen zum Aktualisieren</span></div>
    ${renderView(agenda)}
  </div>`;
}

function renderTopbar() {
  let title = 'Heute';
  let sub = formatLongDate(state.today);
  let titleClass = 'title-large';
  if (state.view === 'week') {
    const start = startOfWeekYmd(state.focusDate);
    title = formatWeekRange(start, addDaysYmd(start, 6));
    sub = `Kalenderwoche ${isoWeekNumber(state.focusDate)}`;
    titleClass = 'title-medium';
  } else if (state.view === 'month') {
    const parts = splitYmd(state.focusDate);
    title = formatMonthName(parts.year, parts.month);
    sub = String(parts.year);
    titleClass = 'title-large';
  }
  return `<header class="topbar">
    <div class="topbar-row">
      <div class="topbar-titles">
        <h1 class="${titleClass}">${esc(title)}</h1>
        <p class="topbar-sub">${esc(sub)}</p>
      </div>
      <div class="topbar-actions">
        <button type="button" class="icon-btn ${state.loading ? 'is-loading' : ''}" data-action="refresh" aria-label="Aktualisieren">${icons.refresh}</button>
        <button type="button" class="icon-btn primary" data-action="create" aria-label="Neuer Termin">${icons.plus}</button>
        <button type="button" class="icon-btn" data-action="menu" aria-label="Menü">${icons.more}</button>
      </div>
    </div>
    <div class="segment" role="tablist" aria-label="Ansicht">
      ${tab('agenda', 'Agenda')}
      ${tab('week', 'Woche')}
      ${tab('month', 'Monat')}
    </div>
    ${renderBanner()}
  </header>`;
}

function tab(view, label) {
  const selected = state.view === view;
  return `<button type="button" role="tab" id="tab-${view}" aria-selected="${selected ? 'true' : 'false'}" data-action="view" data-view="${view}">${label}</button>`;
}

function renderBanner() {
  const offline = state.offline || navigator.onLine === false;
  if (offline) {
    const when = state.lastSync ? `Stand von ${formatSync(state.lastSync, state.today)}` : 'gespeicherte Termine';
    return `<div class="banner banner-offline" data-testid="banner">Offline · ${esc(when)}</div>`;
  }
  if (state.mode === 'google' && state.authExpired) {
    return `<div class="banner banner-warn" data-testid="banner"><span>Anmeldung abgelaufen</span><button type="button" data-action="signin">Anmelden</button></div>`;
  }
  if (state.mode === 'demo') {
    return `<div class="banner banner-demo" data-testid="banner">Demo-Modus · nichts wird bei Google gespeichert</div>`;
  }
  return '';
}

function renderView(agenda) {
  if (state.loading && state.events.length === 0) {
    return `<div class="skeleton-wrap" aria-hidden="true"><div class="sk sk-title"></div><div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div></div>`;
  }
  if (state.view === 'week') return renderWeek(agenda.map);
  if (state.view === 'month') return renderMonth(agenda.map);
  return renderAgenda(agenda);
}

function renderAgenda(agenda) {
  if (state.mode === 'google' && !state.loading && state.events.length === 0 && state.error) {
    return `<div class="empty-card"><p>${esc(state.error)}</p><button type="button" class="btn btn-secondary" data-action="refresh">Erneut versuchen</button></div>`;
  }
  const sections = agenda.days
    .map((day) => {
      const heading = dayHeading(day.ymd);
      const body = day.items.length
        ? renderRows(day.items, day.ymd)
        : `<div class="empty-card"><p>Nichts geplant. Der Tag gehört dir.</p><button type="button" class="btn btn-secondary" data-action="create">Termin anlegen</button></div>`;
      const sub = heading.sub ? `<p>${esc(heading.sub)}</p>` : '';
      return `<section class="day-block"><header class="day-head"><h2>${esc(heading.title)}</h2>${sub}</header>${body}</section>`;
    })
    .join('');
  const later = agenda.days.some((day) => day.ymd > state.today && day.items.length);
  const note = later ? '' : '<p class="end-note">Keine weiteren Termine in den nächsten 60 Tagen.</p>';
  return `${sections}${note}`;
}

function dayHeading(ymd) {
  const diff = Math.round(
    (Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${state.today}T00:00:00Z`)) / 86400000,
  );
  const sub = formatDayMonth(ymd, state.today);
  if (diff === 0) return { title: formatLongDate(ymd), sub: '' };
  if (diff === 1) return { title: 'Morgen', sub };
  if (diff === 2) return { title: 'Übermorgen', sub };
  if (diff === -1) return { title: 'Gestern', sub };
  const weekday = formatLongDate(ymd).split(',')[0];
  return { title: weekday, sub };
}

function renderRows(items, ymd) {
  const now = nowMinutes();
  const showNow = ymd === state.today && items.some((item) => !item.allDay);
  let inserted = false;
  const rows = [];
  for (const item of items) {
    if (showNow && !inserted && !item.allDay && item.endMin > now) {
      rows.push(nowDivider(now));
      inserted = true;
    }
    rows.push(renderRow(item, ymd));
  }
  if (showNow && !inserted) rows.push(nowDivider(now));
  return `<div class="card">${rows.join('')}</div>`;
}

function nowDivider(now) {
  return `<div class="now-row"><span>Jetzt · ${formatHM(now)}</span></div>`;
}

function isPast(occurrence, ymd) {
  if (ymd < state.today) return true;
  if (ymd > state.today || occurrence.allDay) return false;
  return occurrence.endMin <= nowMinutes();
}

function isCurrent(occurrence, ymd) {
  if (ymd !== state.today || occurrence.allDay) return false;
  const now = nowMinutes();
  return occurrence.startMin <= now && occurrence.endMin > now;
}

function renderRow(occurrence, ymd) {
  const event = occurrence.event;
  const color = eventColor(event.colorId);
  const classes = [
    'event-row',
    isPast(occurrence, ymd) ? 'is-past' : '',
    isCurrent(occurrence, ymd) ? 'is-now' : '',
    state.flashId === event.id ? 'flash' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const when = occurrence.allDay
    ? '<span class="when-all">Ganztägig</span>'
    : `<span class="when-start">${esc(occurrence.startLabel)}</span><span class="when-end">${esc(occurrence.endLabel)}</span>`;
  let detail = event.location;
  if (!detail && event.allDay && event.startDate !== event.endDate) {
    detail = `bis ${formatDayMonth(event.endDate, state.today)}`;
  }
  return `<button type="button" class="${classes}" data-action="open" data-id="${esc(event.id)}" style="--event:${color}">
    <span class="bar"></span>
    <span class="when">${when}</span>
    <span class="what"><span class="what-title">${esc(event.title)}</span>${detail ? `<span class="what-loc">${esc(detail)}</span>` : ''}</span>
  </button>`;
}

function renderWeek(map) {
  const start = startOfWeekYmd(state.focusDate);
  const days = Array.from({ length: 7 }, (_, index) => addDaysYmd(start, index));
  const items = map.get(state.focusDate) || [];
  const allDay = items.filter((item) => item.allDay);
  const timed = layoutDayEvents(items.filter((item) => !item.allDay));
  const empty = items.length === 0;
  return `<div class="strip-wrap">
      ${calNav('Vorherige Woche', 'Nächste Woche')}
      <div class="strip">${days.map((ymd) => stripDay(ymd, map)).join('')}</div>
      ${allDay.length ? `<div class="allday">${allDay.map(chip).join('')}</div>` : ''}
    </div>
    ${empty ? '<p class="empty-hint">Keine Termine an diesem Tag. Tippe auf eine Uhrzeit, um einen anzulegen.</p>' : ''}
    ${renderCanvas(timed)}`;
}

function stripDay(ymd, map) {
  const parts = splitYmd(ymd);
  const selected = ymd === state.focusDate;
  const today = ymd === state.today;
  const sunday = weekdayMon0(ymd) === 6;
  const dots = (map.get(ymd) || []).slice(0, 3);
  const label = `${formatLongDate(ymd)}`;
  return `<button type="button" class="strip-day${today ? ' is-today' : ''}${sunday ? ' is-sun' : ''}" aria-pressed="${selected ? 'true' : 'false'}" aria-label="${esc(label)}" data-action="select-day" data-date="${ymd}">
    <span class="wd">${WEEKDAYS[weekdayMon0(ymd)]}</span>
    <span class="dn">${parts.day}</span>
    <span class="dots">${dots.map((item) => `<i style="background:${eventColor(item.event.colorId)}"></i>`).join('')}</span>
  </button>`;
}

function chip(occurrence) {
  const color = eventColor(occurrence.event.colorId);
  return `<button type="button" class="chip" style="--event:${color}" data-action="open" data-id="${esc(occurrence.event.id)}">${esc(occurrence.event.title)}</button>`;
}

function renderCanvas(items) {
  const lines = [];
  const hours = [];
  for (let hour = 0; hour <= 24; hour += 1) {
    lines.push(`<div class="hour-line" style="top:${hour * HOUR_HEIGHT}px"></div>`);
  }
  for (let hour = 0; hour < 24; hour += 1) {
    hours.push(`<div class="hour" style="top:${hour * HOUR_HEIGHT}px"><span>${pad(hour)}:00</span></div>`);
  }
  const now =
    state.focusDate === state.today
      ? `<div class="now-line" style="top:${(nowMinutes() / 60) * HOUR_HEIGHT}px"><span>${formatHM(nowMinutes())}</span></div>`
      : '';
  const blocks = items.map(renderBlock).join('');
  return `<div class="day-canvas" style="height:${24 * HOUR_HEIGHT}px">
    <div class="hours">${hours.join('')}</div>
    <div class="day-track" data-action="slot">${lines.join('')}${blocks}${now}</div>
  </div>`;
}

function renderBlock(item) {
  const duration = Math.max(15, item.endMin - item.startMin);
  const top = (item.startMin / 60) * HOUR_HEIGHT;
  const height = Math.max(26, (duration / 60) * HOUR_HEIGHT - 3);
  const width = 100 / item.cols;
  const left = item.col * width;
  const color = eventColor(item.event.colorId);
  const time = height > 42 ? `<span class="tb-time">${esc(item.timeLabel)}</span>` : '';
  return `<button type="button" class="time-block" data-action="open" data-id="${esc(item.event.id)}" style="top:${top}px;height:${height}px;left:calc(${left}% + 2px);width:calc(${width}% - 4px);--event:${color}">
    <span class="tb-title">${esc(item.event.title)}</span>${time}
  </button>`;
}

function renderMonth(map) {
  const grid = monthGrid(state.focusDate);
  const weekdays = WEEKDAYS.map((name, index) => `<span class="${index === 6 ? 'sun' : ''}">${name}</span>`).join('');
  const cells = grid.cells
    .map((cell) => {
      const items = map.get(cell.ymd) || [];
      const dots = items.slice(0, 3);
      const classes = [
        'cell',
        cell.inMonth ? '' : 'is-out',
        cell.sunday ? 'is-sun' : '',
        cell.ymd === state.today ? 'is-today' : '',
        cell.ymd === state.focusDate ? 'is-selected' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<button type="button" class="${classes}" data-action="select-day" data-date="${cell.ymd}" aria-pressed="${cell.ymd === state.focusDate ? 'true' : 'false'}" aria-label="${esc(formatLongDate(cell.ymd))}">
        <span class="num">${cell.day}</span>
        <span class="dots">${dots.map((item) => `<i style="background:${eventColor(item.event.colorId)}"></i>`).join('')}</span>
      </button>`;
    })
    .join('');
  const picked = map.get(state.focusDate) || [];
  const list = picked.length
    ? renderRows(picked, state.focusDate)
    : '<p class="empty-hint">Keine Termine an diesem Tag.</p>';
  return `<div class="strip-wrap">
      ${calNav('Vorheriger Monat', 'Nächster Monat')}
      <div class="weekdays">${weekdays}</div>
    </div>
    <div class="month-grid">${cells}</div>
    <h2 class="month-picked">${esc(formatLongDate(state.focusDate))}</h2>
    ${list}`;
}

function calNav(previousLabel, nextLabel) {
  return `<div class="cal-nav">
    <button type="button" class="icon-btn" data-action="prev" aria-label="${previousLabel}">${icons.chevronLeft}</button>
    <button type="button" class="today-btn" data-action="today">Heute</button>
    <button type="button" class="icon-btn" data-action="next" aria-label="${nextLabel}">${icons.chevronRight}</button>
  </div>`;
}

function renderOverlay() {
  if (state.sheet?.type === 'detail' && !state.events.some((event) => event.id === state.sheet.id)) {
    state.sheet = null;
  }
  const key = currentSheetKey();
  const overlay = document.getElementById('overlay');
  if (key !== sheetKey) {
    sheetKey = key;
    overlay.querySelectorAll('.sheet, .menu-layer').forEach((node) => node.remove());
    const html = sheetHtml();
    if (html) overlay.insertAdjacentHTML('afterbegin', html);
  }
  renderConfirm();
}

function currentSheetKey() {
  const sheet = state.sheet;
  if (!sheet) return '';
  if (sheet.type === 'detail') {
    const event = state.events.find((item) => item.id === sheet.id);
    return event ? `detail:${sheet.id}:${event.updated || ''}:${event.title}` : '';
  }
  if (sheet.type === 'edit') return `edit:${sheet.draft?.id || 'new'}`;
  return sheet.type;
}

function sheetHtml() {
  if (state.sheet?.type === 'detail') {
    const event = state.events.find((item) => item.id === state.sheet.id);
    return event ? renderDetail(event) : '';
  }
  if (state.sheet?.type === 'edit') return renderEditor(state.sheet.draft);
  if (state.sheet?.type === 'menu') return renderMenu();
  return '';
}

function renderDetail(event) {
  const when = formatEventWhen(event, state.today);
  const color = eventColor(event.colorId);
  const maps = event.location
    ? `<a class="link-row" href="${esc(mapsUrl(event.location))}" target="_blank" rel="noopener noreferrer">
        <span><strong>In Karten öffnen</strong><small>${esc(event.location)}</small></span>${icons.chevronRight}
      </a>`
    : '';
  const notes = event.notes
    ? `<div class="card"><div class="stack"><span>Notizen</span><p class="notes">${linkify(event.notes)}</p></div></div>`
    : '';
  const external = safeHttpUrl(event.htmlLink);
  const googleLink = external
    ? `<a class="text-link" href="${esc(external)}" target="_blank" rel="noopener noreferrer">In Google Kalender öffnen</a>`
    : '';
  return `<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="detail-title">
    <div class="sheet-nav">
      <button type="button" class="nav-text nav-left" data-action="close">${icons.chevronLeft}<span>Kalender</span></button>
      <span></span>
      <button type="button" class="nav-text nav-right" data-action="edit" data-id="${esc(event.id)}">Bearbeiten</button>
    </div>
    <div class="sheet-body detail-body">
      <div class="detail-head">
        <p class="detail-kicker"><span class="detail-dot" style="--event:${color};background:${color}"></span>Termin</p>
        <h2 id="detail-title">${esc(event.title)}</h2>
        <p class="detail-primary">${esc(when.primary)}</p>
        <p class="detail-secondary">${esc(when.secondary)}</p>
      </div>
      ${maps}
      ${notes}
      <button type="button" class="danger-btn" data-action="ask-delete" data-id="${esc(event.id)}">Termin löschen</button>
      ${googleLink}
    </div>
  </section>`;
}

function formatField(type, value) {
  if (type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
  }
  return value || '';
}

function picker(type, name, value, label) {
  const clock = type === 'time' ? ' clock' : '';
  return `<label class="picker${clock}">
    <span>${esc(formatField(type, value))}</span>
    <input type="${type}" name="${name}" aria-label="${label}" value="${esc(value || '')}">
  </label>`;
}

function renderEditor(draft) {
  const creating = !draft.id;
  const done = creating ? 'Hinzufügen' : 'Fertig';
  return `<form id="event-form" class="sheet ${draft.allDay ? 'is-all-day' : ''}" data-id="${esc(draft.id || '')}" data-color-id="${esc(draft.colorId || '')}" novalidate role="dialog" aria-modal="true" aria-labelledby="editor-title">
    <div class="sheet-nav">
      <button type="button" class="nav-text nav-left" data-action="close">Abbrechen</button>
      <h2 id="editor-title">${creating ? 'Neuer Termin' : 'Termin bearbeiten'}</h2>
      <button type="submit" class="nav-text nav-right nav-done" data-label="${done}">${done}</button>
    </div>
    <div class="sheet-body">
      <div class="card form-card">
        <input class="title-input" name="title" type="text" maxlength="200" placeholder="Titel" aria-label="Titel" value="${esc(draft.title)}" autocapitalize="sentences" autocomplete="off" enterkeyhint="done">
      </div>
      <div class="card form-card">
        <label class="form-row">
          <span>Ganztägig</span>
          <input class="switch" type="checkbox" name="allDay" role="switch" aria-label="Ganztägig" ${draft.allDay ? 'checked' : ''}>
        </label>
        <div class="form-row">
          <span>Beginn</span>
          <div class="form-controls">
            ${picker('date', 'startDate', draft.startDate, 'Beginn Datum')}
            ${picker('time', 'startTime', draft.startTime, 'Beginn Uhrzeit')}
          </div>
        </div>
        <div class="form-row">
          <span>Ende</span>
          <div class="form-controls">
            ${picker('date', 'endDate', draft.endDate, 'Ende Datum')}
            ${picker('time', 'endTime', draft.endTime, 'Ende Uhrzeit')}
          </div>
        </div>
      </div>
      <div class="card form-card">
        <label class="stack"><span>Ort</span><input class="plain-input" name="location" type="text" maxlength="300" placeholder="Ort hinzufügen" value="${esc(draft.location)}" autocapitalize="sentences" autocomplete="off"></label>
        <label class="stack"><span>Notizen</span><textarea name="notes" maxlength="8000" placeholder="Notizen" autocapitalize="sentences">${esc(draft.notes)}</textarea></label>
      </div>
      <p class="fine form-foot">Zeiten gelten für Europe/Berlin.</p>
      <p class="form-error" role="alert"></p>
      ${draft.id ? `<button type="button" class="danger-btn" data-action="ask-delete" data-id="${esc(draft.id)}">Termin löschen</button>` : ''}
    </div>
  </form>`;
}

function renderMenu() {
  const { problem } = clientIdStatus();
  let title = 'Kalender';
  let sub = 'Nicht angemeldet';
  if (state.mode === 'demo') {
    title = 'Demo-Modus';
    sub = 'Beispieldaten auf diesem Gerät';
  } else if (state.account?.email || state.account?.summary) {
    title = state.account.summary || state.account.email;
    sub = state.account.email && state.account.email !== title ? state.account.email : 'Primärkalender';
  }
  const tz =
    state.account?.timeZone && state.account.timeZone !== 'Europe/Berlin'
      ? `Dein Google-Kalender steht auf ${state.account.timeZone}. Angezeigt wird Europe/Berlin.`
      : 'Zeiten in Europe/Berlin.';
  const sync = state.lastSync ? ` Zuletzt ${formatSync(state.lastSync, state.today)}.` : '';
  const rows = [];
  rows.push(`<button type="button" class="menu-row" data-action="refresh">Aktualisieren</button>`);
  if (state.mode === 'demo' && !problem) {
    rows.push(`<button type="button" class="menu-row" data-action="signin">Mit Google anmelden</button>`);
  }
  if (state.mode === 'demo') {
    rows.push(`<button type="button" class="menu-row" data-action="reset-demo">Beispieldaten zurücksetzen</button>`);
    rows.push(`<button type="button" class="menu-row danger" data-action="exit-demo">Demo beenden</button>`);
  }
  if (state.mode === 'google') {
    rows.push(`<button type="button" class="menu-row danger" data-action="signout">Abmelden</button>`);
  }
  const theme = (value, label) =>
    `<button type="button" role="radio" aria-checked="${state.theme === value ? 'true' : 'false'}" data-action="theme" data-theme-value="${value}">${label}</button>`;
  return `<div class="layer menu-layer">
    <button type="button" class="backdrop" data-action="close" aria-label="Menü schließen"></button>
    <div class="menu-sheet" role="dialog" aria-label="Menü">
      <div class="grabber"></div>
      <div class="menu-account"><strong>${esc(title)}</strong><span>${esc(sub)}</span></div>
      <p class="menu-label">Darstellung</p>
      <div class="segment theme-segment" role="radiogroup" aria-label="Darstellung">
        ${theme('system', 'System')}${theme('light', 'Hell')}${theme('dark', 'Dunkel')}
      </div>
      <div class="menu-actions">${rows.join('')}</div>
      <p class="menu-foot">${esc(tz + sync)}</p>
    </div>
  </div>`;
}

function renderConfirm() {
  const key = state.confirm ? JSON.stringify(state.confirm) : '';
  if (key === confirmKey) return;
  confirmKey = key;
  const overlay = document.getElementById('overlay');
  overlay.querySelector('.confirm-layer')?.remove();
  if (!state.confirm) return;
  overlay.insertAdjacentHTML('beforeend', confirmHtml(state.confirm));
}

function confirmHtml(confirm) {
  let title = '';
  let body = '';
  let danger = '';
  let action = '';
  if (confirm.type === 'delete') {
    title = `„${confirm.title}“ löschen?`;
    body =
      state.mode === 'google'
        ? 'Der Termin wird in deinem Google-Kalender gelöscht.'
        : 'Der Termin wird aus den Beispieldaten entfernt.';
    danger = 'Termin löschen';
    action = 'confirm-delete';
  } else if (confirm.type === 'discard') {
    title = 'Änderungen verwerfen?';
    body = 'Deine Eingaben werden nicht gesichert.';
    danger = 'Verwerfen';
    action = 'confirm-discard';
  } else {
    title = 'Beispieldaten zurücksetzen?';
    body = 'Änderungen in der Demo gehen verloren. Eigene Demo-Termine ebenfalls.';
    danger = 'Zurücksetzen';
    action = 'confirm-reset';
  }
  return `<div class="layer confirm-layer">
    <button type="button" class="backdrop" data-action="dismiss-confirm" aria-label="Abbrechen"></button>
    <div class="action-sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="action-card">
        <p class="confirm-title" id="confirm-title">${esc(title)}</p>
        <p class="confirm-body">${esc(body)}</p>
        <button type="button" class="action-danger" data-action="${action}">${danger}</button>
      </div>
      <button type="button" class="action-cancel" data-action="dismiss-confirm">Abbrechen</button>
    </div>
  </div>`;
}

function renderToast() {
  const node = document.getElementById('toast');
  if (!state.toast) {
    node.hidden = true;
    node.textContent = '';
    return;
  }
  node.hidden = false;
  node.textContent = state.toast;
}

function syncPickerLabel(input) {
  if (!input?.matches?.('input[type="date"], input[type="time"]')) return;
  const span = input.parentElement?.querySelector('span');
  if (!span) return;
  span.textContent = formatField(input.type === 'date' ? 'date' : 'time', input.value);
}

let pointer = null;
let gesture = null;

export function bind(frame, actions) {
  frame.addEventListener('pointerdown', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
  });

  frame.addEventListener('click', (event) => {
    if (pointer) {
      const dx = Math.abs(event.clientX - pointer.x);
      const dy = Math.abs(event.clientY - pointer.y);
      if (dx > 10 || dy > 10) return;
    }
    const target = event.target.closest('[data-action]');
    if (!target || !frame.contains(target)) return;
    const action = target.dataset.action;
    if (action === 'slot') {
      const rect = target.getBoundingClientRect();
      const y = event.clientY - rect.top;
      const raw = Math.round(((y / HOUR_HEIGHT) * 60) / 15) * 15;
      const minutes = Math.max(0, Math.min(23 * 60 + 45, raw));
      actions.createAt(state.focusDate, minutes);
      return;
    }
    if (action === 'view') actions.setView(target.dataset.view);
    else if (action === 'refresh') actions.refresh();
    else if (action === 'create') actions.create();
    else if (action === 'menu') actions.openMenu();
    else if (action === 'signin') actions.signIn();
    else if (action === 'demo') actions.enterDemo();
    else if (action === 'open') actions.open(target.dataset.id);
    else if (action === 'edit') actions.edit(target.dataset.id);
    else if (action === 'close') actions.close();
    else if (action === 'ask-delete') actions.askDelete(target.dataset.id);
    else if (action === 'select-day') actions.selectDay(target.dataset.date);
    else if (action === 'prev') actions.shift(-1);
    else if (action === 'next') actions.shift(1);
    else if (action === 'today') actions.jumpToday();
    else if (action === 'theme') actions.setTheme(target.dataset.themeValue);
    else if (action === 'signout') actions.signOut();
    else if (action === 'exit-demo') actions.exitDemo();
    else if (action === 'reset-demo') actions.askReset();
    else if (action === 'backdrop' || action === 'dismiss-confirm') actions.dismissConfirm();
    else if (action === 'confirm-delete') actions.confirmDelete();
    else if (action === 'confirm-discard') actions.confirmDiscard();
    else if (action === 'confirm-reset') actions.confirmReset();
  });

  frame.addEventListener('submit', (event) => {
    if (event.target.id !== 'event-form') return;
    event.preventDefault();
    const draft = readForm();
    if (draft) actions.save(draft);
  });

  frame.addEventListener('change', (event) => {
    const form = event.target.closest?.('#event-form');
    if (!form) return;
    if (event.target.name === 'allDay') form.classList.toggle('is-all-day', event.target.checked);
    syncPickerLabel(event.target);
    if (!['startDate', 'startTime', 'allDay'].includes(event.target.name)) return;
    const draft = readForm();
    if (!draft) return;
    if (draft.allDay) {
      if (draft.endDate < draft.startDate) {
        const endDate = form.querySelector('[name="endDate"]');
        endDate.value = draft.startDate;
        syncPickerLabel(endDate);
      }
      return;
    }
    const start = clockToMs(draft.startDate, draft.startTime);
    const end = clockToMs(draft.endDate, draft.endTime);
    if (Number.isFinite(start) && Number.isFinite(end) && !(end > start)) {
      const next = addClock(draft.startDate, draft.startTime, 60);
      const endDate = form.querySelector('[name="endDate"]');
      const endTime = form.querySelector('[name="endTime"]');
      endDate.value = next.date;
      endTime.value = next.time;
      syncPickerLabel(endDate);
      syncPickerLabel(endTime);
    }
  });

  frame.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1) return;
      const scroller = document.getElementById('inhalt');
      gesture = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        pull: Boolean(scroller && scroller.contains(event.target) && scroller.scrollTop <= 1 && !state.sheet),
        px: 0,
      };
    },
    { passive: true },
  );

  frame.addEventListener(
    'touchmove',
    (event) => {
      if (!gesture?.pull) return;
      const dy = event.touches[0].clientY - gesture.y;
      const dx = event.touches[0].clientX - gesture.x;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
        gesture.px = 0;
        setPull(0);
        return;
      }
      const scroller = document.getElementById('inhalt');
      if (!scroller || scroller.scrollTop > 1) {
        gesture.px = 0;
        setPull(0);
        return;
      }
      gesture.px = Math.min(80, dy * 0.45);
      if (gesture.px > 8 && event.cancelable) event.preventDefault();
      setPull(gesture.px);
    },
    { passive: false },
  );

  frame.addEventListener('touchend', (event) => {
    if (!gesture) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    const pulled = gesture.px > 56;
    gesture = null;
    if (pulled) {
      setPull(44, true);
      Promise.resolve(actions.refresh()).finally(() => setPull(0));
      return;
    }
    setPull(0);
    if (state.sheet || state.confirm) return;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (state.view === 'week') actions.shiftDay(dx < 0 ? 1 : -1);
      else if (state.view === 'month') actions.shift(dx < 0 ? 1 : -1);
    }
  });

  frame.addEventListener('touchcancel', () => {
    gesture = null;
    setPull(0);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      actions.back();
      return;
    }
    if (state.sheet || state.confirm) return;
    if (event.target.closest?.('input, textarea')) return;
    if (event.key === 'ArrowLeft') actions.shift(-1);
    if (event.key === 'ArrowRight') actions.shift(1);
  });
}

function setPull(px, loading = false) {
  const node = document.getElementById('pull');
  if (!node) return;
  node.style.height = px ? `${px}px` : '0px';
  node.style.visibility = px ? 'visible' : 'hidden';
  const label = node.querySelector('.pull-label');
  if (label) {
    label.textContent = loading
      ? 'Aktualisiere…'
      : px > 56
        ? 'Loslassen zum Aktualisieren'
        : 'Ziehen zum Aktualisieren';
  }
}
