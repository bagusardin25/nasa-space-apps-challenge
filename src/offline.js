// Offline support: registers the service worker in sw.js, then hands it the list of files this page
// has already loaded plus assets that are only fetched later (fonts for other weights, the 3D engine,
// the bundled textures). Browser-only; the engine tests never import this file.
const LATER = [
  'assets/vendor/three.module.js',
  'assets/textures/earth-blue-marble-gibs-1k.jpg',
  'assets/textures/moon-lroc-svs-1k.jpg',
  'assets/fonts/fonts.css',
];

async function warmCache() {
  const worker = (await navigator.serviceWorker.ready).active;
  if (!worker) return;
  const urls = [location.href.split('#')[0], ...LATER];
  for (const entry of performance.getEntriesByType('resource')) urls.push(entry.name);
  try {
    // Every font file named in fonts.css, so text in any weight renders offline.
    const css = await (await fetch('assets/fonts/fonts.css')).text();
    for (const [, file] of css.matchAll(/url\(([^)]+)\)/g)) urls.push(`assets/fonts/${file}`);
  } catch {
    // Offline already; the worker keeps what it has.
  }
  worker.postMessage({ type: 'warm', urls });
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      // Give the boot-time preloads (3D engine, textures) a moment to finish first.
      .then(() => setTimeout(warmCache, 4000))
      .catch((err) => console.warn('GO/NO-GO: offline support is unavailable.', err));
  });
}
