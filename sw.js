// service worker：一度開けば、オフラインでも動くようにする
// 新しいファイルを足したときは APP_FILES に加えて、CACHE_NAME の番号を上げる

const CACHE_NAME = 'tangorun-v15';
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const APP_FILES = [
  './',
  './index.html',
  './css/style.css',
  './css/cards.css',
  './js/firebase-config.js',
  './js/storage.js',
  './js/cloud.js',
  './js/quiz.js',
  './js/missions.js',
  './js/catart.js',
  './js/cats.js',
  './js/limited.js',
  './js/gacha.js',
  './js/growth.js',
  './js/animalart.js',
  './js/battle.js',
  './js/battleui.js',
  './js/sound.js',
  './js/app.js',
  './data/words.json',
  './data/words_high.json',
  './data/words_toeic.json',
  './data/words_biz.json',
  './data/sentences.json',
  './data/idioms.json',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  FIREBASE_SDK + 'firebase-app-compat.js',
  FIREBASE_SDK + 'firebase-auth-compat.js',
  FIREBASE_SDK + 'firebase-firestore-compat.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all([
        cache.addAll(APP_FILES.filter(u => !u.startsWith(FIREBASE_SDK))),
        // Firebase のプログラムは取れなくてもインストールは続ける（次に開いたときに保存される）
        ...APP_FILES.filter(u => u.startsWith(FIREBASE_SDK)).map(u => cache.add(u).catch(() => {})),
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// まず保存してあるものをすぐ返し、裏で新しいものを取りに行って保存し直す
// （次に開いたときに新しい内容になる）
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // 自分のファイルと Firebase のプログラムだけ保存する（Firebase とのデータのやりとりは対象外）
  const isOwn = new URL(req.url).origin === self.location.origin;
  if (!isOwn && !req.url.startsWith(FIREBASE_SDK)) return;

  // Firebase のプログラムは版が固定なので、保存してあるものをそのまま使う
  if (!isOwn) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
    return;
  }

  // 自分のファイルは、つながっていれば必ず最新を取りに行く（直した内容がすぐ届く）。
  // 電波がないとき・3秒たっても返事がないときだけ、保存してあるものを使う
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const network = fetch(req).then(res => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      });
      const cached = await cache.match(req, { ignoreSearch: true });
      if (!cached) return network;
      const timeout = new Promise(resolve => setTimeout(() => resolve(cached), 3000));
      return Promise.race([network.catch(() => cached), timeout]);
    })
  );
});
