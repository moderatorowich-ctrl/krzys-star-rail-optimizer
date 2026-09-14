const PREFIX = `ksro:${self.registration.scope}:`;
const CACHE = `${PREFIX}1.1.0-data-2026.09.13.1-r1`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(self.registration.scope)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope))
    return;
  if (
    event.request.mode !== 'navigate' &&
    !['script', 'style', 'font', 'image', 'worker'].includes(event.request.destination)
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        if (response.ok && response.type === 'basic')
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        return response;
      })
      .catch(() =>
        caches
          .open(CACHE)
          .then(
            async (cache) =>
              (await cache.match(event.request)) ||
              (event.request.mode === 'navigate'
                ? await cache.match(self.registration.scope)
                : undefined) ||
              Response.error(),
          ),
      ),
  );
});
