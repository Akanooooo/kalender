function svg(body) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const icons = {
  refresh: svg('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4.5V9h-4.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  more: svg(
    '<circle cx="6" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.15" fill="currentColor" stroke="none"/>',
  ),
  chevronLeft: svg('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  chevronRight: svg('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
};

export function logoSvg() {
  return `<svg class="logo" viewBox="0 0 80 80" role="img" aria-label="Kalender">
    <rect width="80" height="80" rx="18" fill="#0A84FF"/>
    <rect x="30" y="14" width="5" height="16" rx="2.5" fill="#fff"/>
    <rect x="45" y="14" width="5" height="16" rx="2.5" fill="#fff"/>
    <rect x="14" y="24" width="52" height="44" rx="8" fill="#fff"/>
    <path d="M14 34h52v-2a8 8 0 0 0-8-8H22a8 8 0 0 0-8 8v2z" fill="#FF3B30"/>
    <circle cx="26" cy="46" r="3" fill="#34C759"/>
    <rect x="33" y="44" width="24" height="4" rx="2" fill="#E5E5EA"/>
    <circle cx="26" cy="56" r="3" fill="#0A84FF"/>
    <rect x="33" y="54" width="18" height="4" rx="2" fill="#E5E5EA"/>
  </svg>`;
}

export function googleG() {
  return `<svg class="g-logo" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>`;
}
