export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

const PLACEHOLDERS = new Set([
  '',
  'DEINE_CLIENT_ID',
  'YOUR_CLIENT_ID',
  'TODO',
  'xxx.apps.googleusercontent.com',
]);

export function clientIdStatus() {
  const id = String(globalThis.KALENDER_CONFIG?.googleClientId || '').trim();
  if (PLACEHOLDERS.has(id)) return { id: '', problem: 'missing' };
  if (!id.endsWith('.apps.googleusercontent.com')) return { id, problem: 'format' };
  return { id, problem: null };
}
