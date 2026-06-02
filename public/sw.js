/* KOL Manager service worker
   - Cache-first cho asset tĩnh (JS/CSS/icon đã được Vite hash)
   - Network-first cho điều hướng (HTML) để luôn lấy bản mới
   - KHÔNG cache request tới Supabase / API (luôn cần dữ liệu thật, cần mạng)
   Đổi CACHE version mỗi lần muốn buộc làm mới cache.
*/
const CACHE = 'kol-manager-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Bỏ qua hoàn toàn: khác origin (Supabase, CDN API…) -> luôn đi mạng, không can thiệp
  if (url.origin !== self.location.origin) return;

  // Điều hướng trang (HTML): network-first, fallback cache khi offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Asset tĩnh same-origin: cache-first, nền tải mới
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Cho phép trang yêu cầu SW mới kích hoạt ngay
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
