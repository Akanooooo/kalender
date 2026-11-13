import './styles.css';
import { state } from './state.js';
import { CALENDAR_SCOPE, clientIdStatus } from './config.js';
import {
  addDaysYmd,
  fetchWindow,
  shiftMonthYmd,
  todayYmd,
  toYMD,
  zonedParts,
} from './dates.js';
import { buildDemoEvents } from './demo.js';
import {
  createEvent,
  deleteEvent,
  fetchCalendar,
  listEvents,
  updateEvent,
} from './google.js';
import {
  blankDraft,
  draftToEvent,
  eventToDraft,
  fromGoogleEvent,
  sanitizeEvents,
  validateDraft,
} from './model.js';
import {
  clearAuth,
  clearCache,
  loadAuth,
  loadCache,
  loadDemo,
  loadUi,
  saveAuth,
  saveCache,
  saveDemo,
  saveUi,
  tokenFresh,
} from './store.js';
import {
  applyTheme,
  bind,
  editorIsDirty,
  render,
  setConfirmBusy,
  setFormBusy,
  showFormError,
  toast,
} from './ui.js';

let fetchGen = 0;
let lastMinute = '';
let lastFocusRefresh = 0;
let lastRangeAttempt = 0;

const ui = loadUi();
state.theme = ui.theme;
state.view = ui.view;
applyTheme(state.theme);

bind(document.querySelector('.app-frame'), {
  setView,
  refresh,
  create,
  createAt,
  openMenu,
  signIn,
  enterDemo,
  open,
  edit,
  close,
  askDelete,
  selectDay,
  shift,
  shiftDay,
  jumpToday,
  setTheme,
  signOut,
  exitDemo,
  askReset,
  dismissConfirm,
  confirmDelete,
  confirmDiscard,
  confirmReset,
  save,
  back,
});

bootToday();
restore();
registerServiceWorker();
document.addEventListener('visibilitychange', onVisible);
window.addEventListener('focus', onVisible);
window.addEventListener('online', () => {
  state.offline = false;
  onVisible();
});
window.addEventListener('offline', () => {
  state.offline = true;
  if (state.mode !== 'signedout') render({ overlay: false, toast: false });
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) onVisible();
});
window.setInterval(tick, 30000);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') applyTheme('system');
});

function bootToday() {
  state.today = todayYmd();
  state.focusDate = state.today;
  const parts = zonedParts(new Date());
  lastMinute = `${parts.hour}:${parts.minute}`;
}

function persistUi() {
  saveUi({ mode: state.mode, view: state.view, theme: state.theme });
}

function persistCache() {
  saveCache({
    source: 'google',
    savedAt: state.lastSync || Date.now(),
    events: state.events,
    account: state.account,
    rangeStart: state.rangeStart,
    rangeEnd: state.rangeEnd,
  });
}

function restore() {
  const taken = takeTokenFromUrl();
  if (taken?.accessToken) {
    acceptToken(taken.accessToken, taken.expiresIn);
    return;
  }
  if (taken?.error) {
    toast(taken.error === 'access_denied' ? 'Zugriff abgelehnt.' : 'Anmeldung fehlgeschlagen.');
  }
  if (ui.mode === 'demo') {
    enterDemo();
    return;
  }
  const auth = loadAuth();
  const cache = loadCache();
  if (ui.mode === 'google' && (tokenFresh(auth) || cache?.events?.length)) {
    state.mode = 'google';
    state.events = sanitizeEvents(cache?.events);
    state.account = cache?.account || null;
    state.lastSync = cache?.savedAt || null;
    state.rangeStart = cache?.rangeStart || '';
    state.rangeEnd = cache?.rangeEnd || '';
    state.authExpired = !tokenFresh(auth);
    state.offline = navigator.onLine === false;
    render();
    if (tokenFresh(auth)) refreshGoogle({ manual: false });
    return;
  }
  state.mode = 'signedout';
  render();
}

function takeTokenFromUrl() {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(location.search);
  const error = hashParams.get('error') || searchParams.get('error');
  const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
  if (!error && !accessToken) return null;
  const expiresIn = Number(hashParams.get('expires_in') || searchParams.get('expires_in') || 3600);
  const url = new URL(location.href);
  url.hash = '';
  for (const key of ['access_token', 'expires_in', 'scope', 'token_type', 'state', 'authuser', 'prompt', 'error']) {
    url.searchParams.delete(key);
  }
  const query = url.searchParams.toString();
  history.replaceState(null, '', url.pathname + (query ? `?${query}` : ''));
  if (error) return { error };
  return { accessToken, expiresIn };
}

function acceptToken(accessToken, expiresIn) {
  saveAuth({ accessToken, expiresAt: Date.now() + Number(expiresIn) * 1000 });
  state.authExpired = false;
  state.signingIn = false;
  state.mode = 'google';
  state.error = null;
  persistUi();
  toast('Angemeldet');
  refreshGoogle({ manual: false });
}

function enterDemo() {
  state.mode = 'demo';
  state.authExpired = false;
  state.error = null;
  state.sheet = null;
  state.confirm = null;
  state.account = null;
  const today = state.today || todayYmd();
  const stored = loadDemo();
  const kept = sanitizeEvents(stored?.events).filter((event) => event.id.startsWith('demo-user-'));
  let events;
  if (!stored || stored.anchor !== today) {
    events = [...buildDemoEvents(today), ...kept];
    saveDemo({ anchor: today, events });
  } else {
    events = sanitizeEvents(stored.events);
  }
  state.events = events;
  state.lastSync = Date.now();
  persistUi();
  render();
}

function exitDemo() {
  state.mode = 'signedout';
  state.events = [];
  state.sheet = null;
  state.confirm = null;
  persistUi();
  render();
}

function signOut() {
  clearAuth();
  clearCache();
  state.mode = 'signedout';
  state.events = [];
  state.account = null;
  state.sheet = null;
  state.confirm = null;
  state.authExpired = false;
  state.error = null;
  state.rangeStart = '';
  state.rangeEnd = '';
  persistUi();
  render();
}

function setView(view) {
  if (!['agenda', 'week', 'month'].includes(view) || view === state.view) return;
  state.view = view;
  persistUi();
  render({ overlay: false, toast: false });
}

function setTheme(theme) {
  if (!['system', 'light', 'dark'].includes(theme)) return;
  state.theme = theme;
  persistUi();
  applyTheme(theme);
  document.querySelectorAll('[data-theme-value]').forEach((button) => {
    button.setAttribute('aria-checked', button.dataset.themeValue === theme ? 'true' : 'false');
  });
}

function selectDay(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return;
  state.focusDate = ymd;
  ensureRange();
  render({ overlay: false, toast: false });
}

function shift(delta) {
  if (state.view === 'month') state.focusDate = shiftMonthYmd(state.focusDate, delta);
  else if (state.view === 'week') state.focusDate = addDaysYmd(state.focusDate, delta * 7);
  else return;
  ensureRange();
  render({ overlay: false, toast: false });
}

function shiftDay(delta) {
  state.focusDate = addDaysYmd(state.focusDate, delta);
  ensureRange();
  render({ overlay: false, toast: false });
}

function jumpToday() {
  state.focusDate = state.today;
  ensureRange();
  render({ overlay: false, toast: false });
}

function ensureRange() {
  if (state.mode !== 'google' || state.busy || state.loading) return;
  if (!state.rangeStart || !state.rangeEnd) return;
  if (state.focusDate >= state.rangeStart && state.focusDate <= state.rangeEnd) return;
  if (Date.now() - lastRangeAttempt < 5000) return;
  lastRangeAttempt = Date.now();
  refreshGoogle({ manual: false });
}

function create() {
  const date = state.view === 'agenda' ? state.today : state.focusDate;
  state.sheet = { type: 'edit', draft: blankDraft({ date }) };
  state.confirm = null;
  render({ main: false });
}

function createAt(date, minutes) {
  state.sheet = { type: 'edit', draft: blankDraft({ date, minutes }) };
  state.confirm = null;
  render({ main: false });
}

function open(id) {
  if (!state.events.some((event) => event.id === id)) return;
  state.sheet = { type: 'detail', id };
  state.confirm = null;
  render({ main: false });
}

function edit(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event) return;
  state.sheet = { type: 'edit', draft: eventToDraft(event) };
  state.confirm = null;
  render({ main: false });
}

function openMenu() {
  state.sheet = { type: 'menu' };
  state.confirm = null;
  render({ main: false });
}

function close() {
  if (state.confirm) {
    state.confirm = null;
    render({ main: false });
    return;
  }
  if (state.sheet?.type === 'edit' && editorIsDirty()) {
    state.confirm = { type: 'discard' };
    render({ main: false });
    return;
  }
  state.sheet = null;
  render({ main: false });
}

function back() {
  if (state.confirm) {
    state.confirm = null;
    render({ main: false });
    return;
  }
  close();
}

function dismissConfirm() {
  state.confirm = null;
  render({ main: false });
}

function confirmDiscard() {
  state.confirm = null;
  state.sheet = null;
  render({ main: false });
}

function askDelete(id) {
  const event = state.events.find((item) => item.id === id);
  state.confirm = { type: 'delete', id, title: event?.title || 'Termin' };
  render({ main: false });
}

function askReset() {
  state.sheet = null;
  state.confirm = { type: 'reset' };
  render({ main: false });
}

function confirmReset() {
  const today = todayYmd();
  state.today = today;
  state.focusDate = today;
  const events = buildDemoEvents(today);
  saveDemo({ anchor: today, events });
  state.events = events;
  state.confirm = null;
  state.sheet = null;
  toast('Beispieldaten zurückgesetzt');
  render();
}

function refresh() {
  state.sheet = null;
  state.confirm = null;
  if (state.mode === 'demo') {
    state.lastSync = Date.now();
    state.offline = navigator.onLine === false;
    toast('Aktualisiert');
    render();
    return;
  }
  refreshGoogle({ manual: true });
}

function currentToken() {
  const auth = loadAuth();
  if (!tokenFresh(auth)) {
    state.authExpired = true;
    return null;
  }
  state.authExpired = false;
  return auth.accessToken;
}

function refreshGoogle({ manual = false } = {}) {
  const token = currentToken();
  if (!token) {
    state.loading = false;
    render();
    if (manual) toast('Bitte melde dich erneut an.');
    return;
  }
  if (navigator.onLine === false) {
    state.offline = true;
    state.loading = false;
    render();
    if (manual) toast('Du bist offline.');
    return;
  }
  const gen = ++fetchGen;
  state.loading = true;
  state.offline = false;
  render({ overlay: false, toast: false });
  const range = fetchWindow(state.focusDate || state.today);
  Promise.all([listEvents(token, range), fetchCalendar(token).catch(() => null)])
    .then(([events, calendar]) => {
      if (gen !== fetchGen) return;
      state.events = events;
      if (calendar) {
        state.account = {
          email: calendar.id || '',
          summary: calendar.summary || calendar.id || '',
          timeZone: calendar.timeZone || '',
        };
      }
      state.rangeStart = range.startYmd;
      state.rangeEnd = range.endYmd;
      state.lastSync = Date.now();
      state.loading = false;
      state.authExpired = false;
      state.error = null;
      state.offline = false;
      if (state.sheet?.type === 'detail' && !state.events.some((event) => event.id === state.sheet.id)) {
        state.sheet = null;
      }
      persistCache();
      const detailOpen = state.sheet?.type === 'detail';
      render({ overlay: detailOpen, toast: false });
      if (manual) toast('Aktualisiert');
    })
    .catch((error) => {
      if (gen !== fetchGen) return;
      state.loading = false;
      if (error.status === 401) {
        clearAuth();
        state.authExpired = true;
      }
      if (error.status === 0) state.offline = true;
      state.error = error.message || 'Termine konnten nicht geladen werden.';
      render({ overlay: false, toast: false });
      toast(state.error);
    });
}

function upsert(event) {
  const index = state.events.findIndex((item) => item.id === event.id);
  if (index === -1) state.events.push(event);
  else state.events[index] = event;
}

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function save(draft) {
  const message = validateDraft(draft);
  if (message) {
    showFormError(message);
    if (!draft.title.trim()) document.querySelector('[name="title"]')?.focus();
    return;
  }
  if (state.busy) return;
  if (state.mode === 'demo') {
    const id = draft.id || `demo-user-${uid()}`;
    upsert(draftToEvent(draft, id));
    saveDemo({ anchor: state.today, events: state.events });
    state.sheet = null;
    state.flashId = id;
    state.lastSync = Date.now();
    toast(draft.id ? 'Termin gesichert' : 'Termin hinzugefügt');
    render();
    reveal(id);
    clearFlash();
    return;
  }
  const token = currentToken();
  if (!token) {
    showFormError('Bitte melde dich erneut an. Deine Eingaben bleiben erhalten.');
    render({ overlay: false });
    return;
  }
  if (navigator.onLine === false) {
    showFormError('Ohne Verbindung kannst du nicht speichern.');
    return;
  }
  setFormBusy(true, '');
  fetchGen += 1;
  try {
    let savedId = draft.id;
    if (draft.id) {
      const updated = fromGoogleEvent(await updateEvent(token, draft.id, draft));
      if (!updated) throw new Error('Die Antwort von Google war unvollständig.');
      upsert(updated);
    } else {
      const created = fromGoogleEvent(await createEvent(token, draft));
      if (!created) throw new Error('Die Antwort von Google war unvollständig.');
      upsert(created);
      savedId = created.id;
    }
    state.lastSync = Date.now();
    persistCache();
    state.busy = false;
    state.sheet = null;
    state.flashId = savedId;
    toast(draft.id ? 'Termin gesichert' : 'Termin hinzugefügt');
    render();
    reveal(savedId);
    clearFlash();
  } catch (error) {
    state.busy = false;
    if (error.status === 401) {
      clearAuth();
      state.authExpired = true;
      render({ overlay: false });
    }
    setFormBusy(false, error.message || 'Speichern fehlgeschlagen.');
  }
}

async function confirmDelete() {
  const id = state.confirm?.id;
  if (!id || state.busy) return;
  if (state.mode === 'demo') {
    state.events = state.events.filter((event) => event.id !== id);
    saveDemo({ anchor: state.today, events: state.events });
    state.sheet = null;
    state.confirm = null;
    toast('Termin gelöscht');
    render();
    return;
  }
  const token = currentToken();
  if (!token) {
    state.confirm = null;
    toast('Bitte melde dich erneut an.');
    render();
    return;
  }
  state.busy = true;
  setConfirmBusy(true);
  fetchGen += 1;
  try {
    await deleteEvent(token, id);
    state.events = state.events.filter((event) => event.id !== id);
    state.lastSync = Date.now();
    persistCache();
    state.busy = false;
    state.sheet = null;
    state.confirm = null;
    toast('Termin gelöscht');
    render();
  } catch (error) {
    state.busy = false;
    if (error.status === 401) {
      clearAuth();
      state.authExpired = true;
      state.confirm = null;
      render();
    } else {
      setConfirmBusy(false);
    }
    toast(error.message || 'Löschen fehlgeschlagen.');
  }
}

function reveal(id) {
  requestAnimationFrame(() => {
    const node = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  });
}

function clearFlash() {
  window.setTimeout(() => {
    state.flashId = null;
    document.querySelector('.flash')?.classList.remove('flash');
  }, 1400);
}

function onVisible() {
  if (document.visibilityState === 'hidden') return;
  const offline = navigator.onLine === false;
  if (state.mode === 'demo') {
    if (state.offline !== offline) {
      state.offline = offline;
      render({ overlay: false, toast: false });
    }
    return;
  }
  if (state.mode !== 'google') return;
  state.offline = offline;
  if (offline || !tokenFresh(loadAuth())) {
    if (!tokenFresh(loadAuth())) state.authExpired = true;
    render({ overlay: false, toast: false });
    return;
  }
  if (Date.now() - lastFocusRefresh < 15000) return;
  if (state.sheet?.type === 'edit') return;
  lastFocusRefresh = Date.now();
  refreshGoogle({ manual: false });
}

function tick() {
  const parts = zonedParts(new Date());
  const minute = `${parts.hour}:${parts.minute}`;
  const today = toYMD(parts);
  const todayChanged = today !== state.today;
  if (todayChanged) {
    const previous = state.today;
    state.today = today;
    if (state.focusDate === previous) state.focusDate = today;
  }
  if (!todayChanged && minute === lastMinute) return;
  lastMinute = minute;
  if (state.mode === 'signedout') return;
  if (state.view === 'month' && !todayChanged) return;
  render({ overlay: false, toast: false });
}

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    let script = document.querySelector('script[data-gis]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.dataset.gis = 'true';
      document.head.appendChild(script);
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - started > 10000) {
        window.clearInterval(timer);
        reject(new Error('timeout'));
      }
    }, 40);
    script.addEventListener(
      'error',
      () => {
        window.clearInterval(timer);
        reject(new Error('gis'));
      },
      { once: true },
    );
  });
}

async function signIn() {
  const { id } = clientIdStatus();
  if (!id) {
    toast('Trag zuerst die Client-ID in config.js ein.');
    return;
  }
  if (state.signingIn) return;
  state.signingIn = true;
  state.sheet = null;
  state.confirm = null;
  render();
  const watchdog = window.setTimeout(() => {
    if (!state.signingIn) return;
    state.signingIn = false;
    render();
  }, 60000);
  try {
    await loadGis();
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: CALENDAR_SCOPE,
      include_granted_scopes: true,
      ux_mode: ios ? 'redirect' : 'popup',
      callback: (response) => {
        window.clearTimeout(watchdog);
        if (response?.error) {
          state.signingIn = false;
          render();
          toast(response.error === 'access_denied' ? 'Zugriff abgelehnt.' : 'Anmeldung abgebrochen.');
          return;
        }
        acceptToken(response.access_token, Number(response.expires_in || 3600));
      },
      error_callback: (error) => {
        if (!ios && error?.type === 'popup_failed_to_open') {
          startRedirect(id);
          return;
        }
        window.clearTimeout(watchdog);
        state.signingIn = false;
        render();
        toast(
          error?.type === 'popup_closed'
            ? 'Anmeldung abgebrochen.'
            : 'Pop-up blockiert. Erlaube Pop-ups für diese Seite und versuche es erneut.',
        );
      },
    });
    client.requestAccessToken({ prompt: 'select_account' });
  } catch {
    window.clearTimeout(watchdog);
    state.signingIn = false;
    render();
    toast('Google-Anmeldung ist gerade nicht erreichbar.');
  }
}

function startRedirect(id) {
  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: id,
    scope: CALENDAR_SCOPE,
    ux_mode: 'redirect',
    include_granted_scopes: true,
    callback: (response) => {
      if (response?.access_token) acceptToken(response.access_token, Number(response.expires_in || 3600));
    },
  });
  client.requestAccessToken({ prompt: 'select_account' });
}

function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL(/* @vite-ignore */ '../sw.js', import.meta.url), {
        scope: import.meta.env.BASE_URL,
      })
      .catch((error) => {
        console.error('Service Worker', error);
      });
  });
}
