import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

function walk(dir, prefix, files) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, `${prefix}${name}/`, files);
    else if (!name.endsWith('.map')) files.push(`./${prefix}${name}`);
  }
}

// Schreibt die echten Build-Dateien in den Service Worker, damit die Hülle
// nach dem ersten Öffnen auch ohne Netz da ist. Die gehashten Assets kennt
// public/sw.js zum Schreibzeitpunkt noch nicht.
function injectPrecache() {
  return {
    name: 'inject-precache',
    apply: 'build',
    closeBundle() {
      const dist = join(process.cwd(), 'dist');
      const files = [];
      walk(dist, '', files);
      const swPath = join(dist, 'sw.js');
      const sw = readFileSync(swPath, 'utf8');
      const list = files.map((file) => `  '${file}',`).join('\n');
      const next = sw.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = [\n${list}\n];`);
      if (next === sw) throw new Error('PRECACHE-Block im Service Worker nicht gefunden');
      writeFileSync(swPath, next);
    },
  };
}

// Relative Pfade, damit die App sowohl unter / als auch in einem
// GitHub-Pages-Unterordner (https://name.github.io/repo/) funktioniert.
// Port 4317 ist fest, weil die Google-Cloud-Console den Ursprung
// inklusive Port als autorisierten JavaScript-Ursprung braucht.
export default defineConfig({
  base: './',
  appType: 'spa',
  plugins: [injectPrecache()],
  server: {
    host: '127.0.0.1',
    port: 4317,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4317,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
