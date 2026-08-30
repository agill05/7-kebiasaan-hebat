const CACHE_NAME = "7kebiasaan-cache-v1";
const ASSETS_TO_CACHE = [
    "/",
    "/index.html",
    "/manifest.json",
    "https://unpkg.com/react@18/umd/react.production.min.js",
    "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
    "https://unpkg.com/@babel/standalone/babel.min.js",
    "https://cdn.tailwindcss.com",
    "https://unpkg.com/dexie@3.2.4/dist/dexie.js",
    "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js",
    "https://cdn.jsdelivr.net/npm/sweetalert2@11",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)),
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                }),
            ),
        ),
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    // Jangan cache permintaan POST/GET API Google Apps Script
    if (event.request.url.includes("script.google.com")) {
        return;
    }
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return (
                cachedResponse ||
                fetch(event.request).catch(() => caches.match("/index.html"))
            );
        }),
    );
});