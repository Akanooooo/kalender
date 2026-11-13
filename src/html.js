export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {
    return '';
  }
  return '';
}

export function linkify(text) {
  const raw = String(text ?? '');
  const pattern = /https?:\/\/[^\s<]+/g;
  let html = '';
  let last = 0;
  for (const match of raw.matchAll(pattern)) {
    const index = match.index ?? 0;
    html += esc(raw.slice(last, index));
    let url = match[0];
    let trail = '';
    while (url && /[),.;:!?]$/.test(url)) {
      trail = url.slice(-1) + trail;
      url = url.slice(0, -1);
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        html += `<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>${esc(trail)}`;
      } else {
        html += esc(match[0]);
      }
    } catch {
      html += esc(match[0]);
    }
    last = index + match[0].length;
  }
  html += esc(raw.slice(last));
  return html;
}

export function mapsUrl(location) {
  const query = encodeURIComponent(location);
  const ua = globalThis.navigator?.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return `https://maps.apple.com/?q=${query}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
