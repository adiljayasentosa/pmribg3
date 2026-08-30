/* =========================================================
   SERVICE WORKER — PMR WIRA UNIT
   Phase 1: PWA Foundation + Phase 2: Offline Experience
   =========================================================
   ATURAN KERAS (jangan dilanggar saat mengubah file ini):
   - TIDAK PERNAH intercept: /api/* (serverless ImageKit auth/delete),
     Firestore/Auth (*.googleapis.com, *.firebaseio.com), dan
     upload.imagekit.io (endpoint upload). Semua request itu HARUS
     selalu lewat network asli, tanpa campur tangan cache sama sekali.
   - Hanya intercept request GET. Request lain (POST/PUT/DELETE dari
     CRUD & upload) dibiarkan lewat begitu saja (event.respondWith
     tidak dipanggil sama sekali untuk method selain GET).
   - TIDAK memanggil self.skipWaiting() otomatis di install. SW baru
     masuk state "waiting" dulu; baru aktif kalau halaman mengirim
     postMessage({type:'SKIP_WAITING'}) — itu dipicu tombol "Refresh"
     di snackbar update (lihat js/pwa-register.js, Phase 2).
   ========================================================= */

/* APP_VERSION harus SELALU sama dengan "version" di /version.json — itu
   sumber tunggal (single source of truth) yang dipakai bersama oleh
   Service Worker ini, manifest.json, dan nanti APK (Phase 3). Jangan
   ubah nilai ini langsung di sini secara manual — ubah /version.json,
   lalu jalankan `node scripts/sync-version.js` supaya otomatis
   tersinkron ke sini + manifest.json. Nilai ini WAJIB berubah di setiap
   deploy yang mengubah isi file apa pun, karena inilah yang membuat
   browser mendeteksi ada versi sw.js baru (lihat penjelasan mekanisme
   update di README-PWA.md). */
const APP_VERSION = "1.1.9";

const CACHE_STATIC  = `pmr-static-${APP_VERSION}`;   // app shell: html/css/js/icon/logo
const CACHE_RUNTIME = `pmr-runtime-${APP_VERSION}`;  // font & aset eksternal lain
const CACHE_IMAGES  = `pmr-images-${APP_VERSION}`;   // gambar ImageKit

const ALL_CACHE_NAMES = [CACHE_STATIC, CACHE_RUNTIME, CACHE_IMAGES];

/* Batas jumlah gambar ImageKit yang boleh disimpan di cache (LRU/FIFO trim).
   Ini realisasi dari aturan "jangan meng-cache seluruh gambar resolusi
   tinggi" — bukan dengan menolak cache gambar besar, tapi dengan membatasi
   TOTAL kapasitas cache gambar (terutama penting untuk galeri Dokumentasi
   yang bisa berisi banyak foto sekaligus). Lihat catatan di laporan Phase 1
   soal kenapa "thumbnail" vs "resolusi tinggi" tidak dibedakan lewat URL. */
const IMAGE_CACHE_MAX_ENTRIES = 80;

/* ── Daftar precache app-shell — HANYA bagian PUBLIK (dipakai semua
   pengunjung: landing, artikel, poster, video, dokumentasi).
   ------------------------------------------------------------------
   Aset admin-only (dashboard.html, login.html, setup.html, dan seluruh
   js/pages/*.js + firebase-db.js/storage.js/modal.js/state.js/
   report-engine.js/rotation-engine.js/dashboard.js) SENGAJA TIDAK
   diprecache di sini. Alasan (hasil analisis yang disetujui):
     - 23 file itu = 336 KB dari total 533 KB precache (63%!), padahal
       cuma dipakai admin, bukan pengunjung publik.
     - cache.addAll() bersifat atomik: 1 file gagal fetch = install
       SW gagal total, termasuk bagian publik yang justru paling
       penting untuk mayoritas pengguna.
   File-file admin-only itu TETAP otomatis ter-cache — hanya waktunya
   bergeser dari "saat install" menjadi "saat pertama kali admin benar-
   benar membuka dashboard.html" (lewat strategi Network First untuk
   HTML & Cache First untuk CSS/JS di fetch handler bawah, yang
   berlaku untuk SEMUA request sama-origin, precached maupun tidak).
   Jadi kemampuan offline admin tidak berkurang sama sekali. */
const PRECACHE_URLS = [
  // Halaman publik
  "/index.html",
  "/artikel.html",
  "/video.html",
  "/poster.html",
  "/dokumentasi.html",
  "/offline.html",

  // CSS yang dipakai halaman publik
  "/css/variables.css",
  "/css/base.css",
  "/css/components.css",
  "/css/landing.css",
  "/css/content.css",
  "/css/modal.css",

  // JS yang dipakai halaman publik
  "/js/firebase-config.js",
  "/js/data-dummy.js",
  "/js/core/auth.js",
  "/js/core/utils.js",
  "/js/core/content-db.js",
  "/js/content-public.js",
  "/js/landing.js",
  "/js/core/modal.js",
  "/js/app-download.js",
  "/js/pwa-register.js",

  // Aset & manifest
  "/assets/logo.svg",
  "/assets/app-mockup.svg",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/icon-maskable-192.png",
  "/assets/icons/icon-maskable-512.png",
  "/assets/icons/apple-touch-icon.png",
  "/manifest.json"
];

/* ── INSTALL: precache app-shell ── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(PRECACHE_URLS))
    // SENGAJA tidak ada self.skipWaiting() di sini — lihat catatan di atas.
  );
});

/* ── ACTIVATE: bersihkan cache versi lama ── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !ALL_CACHE_NAMES.includes(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Helper: response boleh disimpan ke cache? (termasuk opaque response
   dari request cross-origin no-cors, mis. Google Fonts) ── */
function _bolehDicache(response) {
  return !!response && (response.ok || response.type === "opaque");
}

function _isNavigasi(request) {
  return request.mode === "navigate" ||
    (request.method === "GET" && (request.headers.get("accept") || "").includes("text/html"));
}

function _isAsetStatisSamaOrigin(url) {
  return url.origin === self.location.origin && (
    /\.(css|js)$/.test(url.pathname) ||
    url.pathname.startsWith("/assets/icons/") ||
    url.pathname === "/assets/logo.svg"
  );
}

function _isImageKit(url) {
  return url.hostname.endsWith("imagekit.io") && url.hostname !== "upload.imagekit.io";
}

function _isGoogleFonts(url) {
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}

/* ── Strategi: Network First (dipakai untuk navigasi HTML) ── */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (_bolehDicache(response)) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

/* ── Network First KHUSUS navigasi HTML — kalau network gagal DAN
   halaman spesifik itu belum pernah dicache, tampilkan /offline.html
   (Phase 2) alih-alih error bawaan browser. ── */
async function networkFirstNavigasi(request, cacheName) {
  try {
    return await networkFirst(request, cacheName);
  } catch (err) {
    const cache = await caches.open(cacheName);
    const offlinePage = await cache.match("/offline.html");
    if (offlinePage) return offlinePage;
    throw err;
  }
}

/* ── Strategi: Cache First (dipakai untuk CSS/JS/Icon/Logo/Font) ── */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (_bolehDicache(response)) cache.put(request, response.clone());
  return response;
}

/* ── Strategi: Stale While Revalidate (dipakai untuk gambar ImageKit) ── */
async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (_bolehDicache(response)) {
      cache.put(request, response.clone());
      if (maxEntries) _trimCache(cacheName, maxEntries);
    }
    return response;
  }).catch(() => cached);
  return cached || network;
}

/* ── FIFO trim supaya cache gambar tidak tumbuh tanpa batas ── */
async function _trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    _trimCache(cacheName, maxEntries);
  }
}

/* ── MESSAGE: dipicu tombol "Refresh" di snackbar update (Phase 2) ── */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* ── FETCH: routing strategi per tipe request ── */
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Hanya intercept GET. POST/PUT/DELETE (CRUD, upload ImageKit, dsb)
  // dibiarkan lewat apa adanya — tidak disentuh sama sekali.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jangan PERNAH ikut campur endpoint dinamis/berbahaya kalau di-cache:
  if (url.pathname.startsWith("/api/")) return;
  if (url.hostname.endsWith("googleapis.com")) return;      // Firestore & Firebase Auth
  if (url.hostname.endsWith("firebaseio.com")) return;
  if (url.hostname === "upload.imagekit.io") return;         // endpoint upload

  if (_isNavigasi(request)) {
    event.respondWith(networkFirstNavigasi(request, CACHE_STATIC));
    return;
  }

  if (_isAsetStatisSamaOrigin(url)) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  if (_isImageKit(url)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_IMAGES, IMAGE_CACHE_MAX_ENTRIES));
    return;
  }

  if (_isGoogleFonts(url)) {
    event.respondWith(cacheFirst(request, CACHE_RUNTIME));
    return;
  }

  // Default untuk request lain yang tidak dikenali: coba network dulu,
  // fallback ke cache kalau ada (tidak precache, cuma runtime cache).
  event.respondWith(networkFirst(request, CACHE_RUNTIME));
});
