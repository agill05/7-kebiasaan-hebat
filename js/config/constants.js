var { useState, useEffect, useMemo, useRef, useCallback } = React;

var SESSION_STORAGE_KEY = 'seven_habits_session_v1';
var COMPACT_STORAGE_KEY = 'seven_habits_compact_view';
var ONBOARDING_STORAGE_KEY = 'seven_habits_onboarding_seen';
var INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

var SCHOOL_IDENTITY = {
    name: "SMP NEGERI 1 TALAGA JAYA",
    district: "Kabupaten Gorontalo",
    level: "SMP",
    academicYear: "2026/2027"
};

var ROLES = { SISWA: 'siswa', GURU: 'guru', ADMIN: 'admin' };

var HABITS_CONFIG = [
    { id: 'h1', sortOrder: 1, active: true, shortName: 'Bangun Pagi', name: 'Bangun Pagi', defaultTime: '04:30', defaultDetail: 'Bangun pagi segar, wudhu/berdoa dan merapikan tempat tidur', icon: '🌅', color: 'bg-blue-100 text-blue-600', timeLabel: 'Jam Bangun Pagi (WITA)', detailLabel: 'Catatan Saat Bangun', detailPlaceholder: 'Contoh: Bangun jam 04.30 langsung wudhu dan merapikan tempat tidur' },
    { id: 'h2', sortOrder: 2, active: true, shortName: 'Beribadah', name: 'Beribadah', defaultTime: '05:00', defaultDetail: 'Melaksanakan salat/ibadah tepat waktu sesuai agama', icon: '🙏', color: 'bg-indigo-100 text-indigo-600', timeLabel: 'Waktu Ibadah Utama (WITA)', detailLabel: 'Ibadah yang Dikerjakan', detailPlaceholder: 'Contoh: Salat Subuh berjamaah & tadarus Al-Qur\'an' },
    { id: 'h3', sortOrder: 3, active: true, shortName: 'Berolahraga', name: 'Berolahraga', defaultTime: '06:00', defaultDetail: 'Senam pagi / jalan sehat 15 menit', icon: '🏃', color: 'bg-green-100 text-green-600', timeLabel: 'Waktu Berolahraga (WITA)', detailLabel: 'Jenis Olahraga & Durasi', detailPlaceholder: 'Contoh: Senam kesegaran jasmani / lari pagi 20 menit' },
    { id: 'h4', sortOrder: 4, active: true, shortName: 'Makan Sehat', name: 'Makan Sehat & Bergizi', defaultTime: '06:30', defaultDetail: 'Sarapan menu sehat seimbang dan minum air putih', icon: '🍎', color: 'bg-red-100 text-red-600', timeLabel: 'Waktu Sarapan (WITA)', detailLabel: 'Menu Makanan & Minuman Sehat', detailPlaceholder: 'Contoh: Nasi, telur rebus, sayur bayam, dan air putih' },
    { id: 'h5', sortOrder: 5, active: true, shortName: 'Gemar Belajar', name: 'Gemar Belajar', defaultTime: '19:00', defaultDetail: 'Membaca buku pelajaran dan literasi mandiri', icon: '📚', color: 'bg-yellow-100 text-yellow-600', timeLabel: 'Waktu Mulai Belajar (WITA)', detailLabel: 'Materi / Buku yang Dipelajari', detailPlaceholder: 'Contoh: Belajar IPA dan membaca buku pengetahuan 30 menit' },
    { id: 'h6', sortOrder: 6, active: true, shortName: 'Bermasyarakat', name: 'Bermasyarakat', defaultTime: '16:00', defaultDetail: 'Membantu orang tua di rumah dan menyapa tetangga', icon: '🤝', color: 'bg-teal-100 text-teal-600', timeLabel: 'Waktu Beraktivitas (WITA)', detailLabel: 'Bentuk Kebaikan yang Dilakukan', detailPlaceholder: 'Contoh: Membantu orang tua membersihkan rumah dan menyapa tetangga' },
    { id: 'h7', sortOrder: 7, active: true, shortName: 'Tidur Cepat', name: 'Tidur Cepat', defaultTime: '21:15', defaultDetail: 'Tidur malam tepat waktu dan mematikan gawai', icon: '😴', color: 'bg-purple-100 text-purple-600', timeLabel: 'Jam Tidur Malam (WITA)', detailLabel: 'Aktivitas Sebelum Tidur', detailPlaceholder: 'Contoh: Tidur jam 21.15 setelah berdoa dan mematikan gawai' }
];
