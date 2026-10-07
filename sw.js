// 오프라인 실행용 캐시. 파일을 고치면 VERSION을 올린다.
// 같은 주소(github.io)에 매스 갤러그도 있으니 내 캐시(hangulmaze-)만 지운다.
const VERSION = 'hangulmaze-v2';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'js/main.js', 'js/game.js', 'js/maze.js', 'js/words.js', 'js/hangul.js', 'js/art.js', 'js/audio.js', 'js/controls.js', 'js/storage.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('hangulmaze-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      // 글꼴처럼 처음 받은 파일도 다음부터 오프라인에서 쓰도록 저장
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => hit)),
  );
});
