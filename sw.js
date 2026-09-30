const CACHE_NAME = "7kebiasaan-cache-v4";
const CORE = [
    "/",
    "/index.html",
    "/manifest.json",
    "/icons/icon-192.jpg",
    "/icons/icon-512.jpg",
    "/icons/icon-maskable-512.jpg",
    "/css/style.css",
    "/js/tailwind-config.js",
    "/js/config/constants.js",
    "/js/config/api.js",
    "/js/utils/alerts.js",
    "/js/utils/date.js",
    "/js/utils/password.js",
    "/js/db/database.js",
    "/js/services/sync-push.js",
    "/js/services/sync-pull.js",
    "/js/db/seed.js",
    "/js/hooks/useOnlineSyncEngine.js",
    "/js/components/ui.jsx",
    "/js/components/AppLayout.jsx",
    "/js/pages/student/StudentHabitsPage.jsx",
    "/js/pages/student/StudentCalendarPage.jsx",
    "/js/pages/student/StudentJournalPage.jsx",
    "/js/pages/student/StudentProfilePage.jsx",
    "/js/pages/teacher/TeacherDashboard.jsx",
    "/js/pages/teacher/TeacherProfilePage.jsx",
    "/js/pages/admin/AdminDashboard.jsx",
    "/js/pages/admin/AdminClassesPage.jsx",
    "/js/pages/admin/AdminTeachersPage.jsx",
    "/js/pages/admin/AdminStudentsPage.jsx",
    "/js/pages/admin/AdminHabitsPage.jsx",
    "/js/pages/admin/AdminArchivesPage.jsx",
    "/js/pages/admin/AdminProfilePage.jsx",
    "/js/pages/reports/ReportsModule.jsx",
    "/js/pages/auth/LandingPage.jsx",
    "/js/pages/auth/LoginPage.jsx",
    "/js/pages/auth/ForceChangePasswordScreen.jsx",
    "/js/App.jsx",
    "/js/main.jsx"
];
const CDN = [
    "https://unpkg.com/react@18/umd/react.production.min.js",
    "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
    "https://unpkg.com/@babel/standalone/babel.min.js",
    "https://cdn.tailwindcss.com",
    "https://unpkg.com/dexie@3.2.4/dist/dexie.js",
    "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js",
    "https://cdn.jsdelivr.net/npm/sweetalert2@11",
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
];

self.addEventListener("install", (e) => {
    e.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(CORE);
        await Promise.allSettled(CDN.map((u) => cache.add(u)));
    })());
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET" || req.url.includes("script.google.com")) return;
    if (!req.url.startsWith("http")) return;

    if (req.mode === "navigate") {
        e.respondWith(fetch(req).catch(() => caches.match("/index.html")));
        return;
    }

    const sameOrigin = new URL(req.url).origin === self.location.origin;
    const store = (res) => {
        if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
    };

    if (sameOrigin) {
        // Stale-while-revalidate: buka cepat dari cache, perbarui di latar belakang.
        e.respondWith(
            caches.match(req).then((hit) => {
                const net = fetch(req).then(store).catch(() => hit);
                return hit || net;
            })
        );
        return;
    }

    // CDN: cache-first.
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(store)));
});
