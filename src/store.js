export const UI_KEY = 'kalender.v1.ui';
const AUTH_KEY = 'kalender.v1.auth';
const CACHE_KEY = 'kalender.v1.cache';
const DEMO_KEY = 'kalender.v1.demo';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Privater Modus oder voller Speicher: die Sitzung läuft trotzdem.
  }
}

export function loadUi() {
  const stored = read(UI_KEY) || {};
  const view = ['agenda', 'week', 'month'].includes(stored.view) ? stored.view : 'agenda';
  const theme = ['system', 'light', 'dark'].includes(stored.theme) ? stored.theme : 'system';
  const mode = ['signedout', 'demo', 'google'].includes(stored.mode) ? stored.mode : 'signedout';
  return { view, theme, mode };
}

export function saveUi(ui) {
  write(UI_KEY, {
    view: ui.view,
    theme: ui.theme,
    mode: ui.mode,
  });
}

export function loadAuth() {
  const auth = read(AUTH_KEY);
  if (!auth?.accessToken || !auth.expiresAt) return null;
  return auth;
}

export function saveAuth(auth) {
  write(AUTH_KEY, auth);
}

export function clearAuth() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore */
  }
}

export function tokenFresh(auth, skew = 60_000) {
  return Boolean(auth?.accessToken && auth.expiresAt && auth.expiresAt - skew > Date.now());
}

export function loadCache() {
  return read(CACHE_KEY);
}

export function saveCache(cache) {
  write(CACHE_KEY, cache);
}

export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadDemo() {
  return read(DEMO_KEY);
}

export function saveDemo(demo) {
  write(DEMO_KEY, demo);
}
