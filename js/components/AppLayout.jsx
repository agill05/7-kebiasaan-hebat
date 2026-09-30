var AppLayout = ({ user, currentPath, navigate, onLogout, isOnline, syncStatus, triggerManualPull, compact, setCompact, children }) => {
    const [showOnboarding, setShowOnboarding] = useState(false);

    useEffect(() => {
        const seenKey = `${ONBOARDING_STORAGE_KEY}_${user.role}`;
        if (!localStorage.getItem(seenKey)) {
            setShowOnboarding(true);
        }
    }, [user.role]);

    const closeOnboarding = () => {
        localStorage.setItem(`${ONBOARDING_STORAGE_KEY}_${user.role}`, 'true');
        setShowOnboarding(false);
    };

    const navItems = {
        [ROLES.SISWA]: [
            { path: '/student/habits', label: '7 Kebiasaan', icon: 'fas fa-check-circle' },
            { path: '/student/calendar', label: 'Kalender', icon: 'fas fa-calendar-alt' },
            { path: '/student/journal', label: 'Jurnal Refleksi', icon: 'fas fa-book' },
            { path: '/student/profile', label: 'Profil Saya', icon: 'fas fa-user-graduate' },
        ],
        [ROLES.GURU]: [
            { path: '/teacher/dashboard', label: 'Siswa Binaan', icon: 'fas fa-users' },
            { path: '/teacher/reports', label: 'Laporan Rinci', icon: 'fas fa-file-invoice' },
            { path: '/teacher/profile', label: 'Profil Saya', icon: 'fas fa-chalkboard-teacher' },
        ],
        [ROLES.ADMIN]: [
            { path: '/admin/dashboard', label: 'Ringkasan Sistem', icon: 'fas fa-home' },
            { path: '/admin/habits', label: 'Pengaturan Kebiasaan', icon: 'fas fa-sliders-h' },
            { path: '/admin/classes', label: 'Data Kelas', icon: 'fas fa-door-open' },
            { path: '/admin/teachers', label: 'Data Guru', icon: 'fas fa-chalkboard-teacher' },
            { path: '/admin/students', label: 'Data Siswa', icon: 'fas fa-user-graduate' },
            { path: '/admin/reports', label: 'Pusat Laporan', icon: 'fas fa-file-invoice' },
            { path: '/admin/archives', label: 'Arsip Semester', icon: 'fas fa-archive' },
            { path: '/admin/profile', label: 'Profil Admin', icon: 'fas fa-user-shield' },
        ]
    }[user.role] || [];

    return (
        <div className="app-shell flex bg-gray-50 overflow-hidden">
            <aside className="hidden md:flex flex-col w-64 bg-white shadow-xl z-20 no-print">
                <div className="p-6 text-center border-b border-gray-100">
                    <div className="text-3xl mb-1">🇮🇩</div>
                    <h2 className="font-extrabold text-brand-red text-xs uppercase leading-tight">7 Kebiasaan Siswa Hebat</h2>
                    <p className="text-[10px] text-gray-400 font-bold mt-1">{SCHOOL_IDENTITY.name}</p>
                </div>
                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    {navItems.map(item => (
                        <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-semibold transition-colors ${currentPath === item.path ? 'bg-brand-red text-white shadow-md' : 'text-gray-500 hover:bg-red-50 hover:text-brand-red'}`}>
                            <i className={`${item.icon} w-5 text-center`}></i>
                            {item.label}
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between px-2 text-xs font-bold text-gray-500">
                        <span>Mode Ringkas</span>
                        <button onClick={() => setCompact(!compact)} className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${compact ? 'bg-brand-red' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${compact ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </button>
                    </div>
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center text-white font-bold">{user.avatar || '👤'}</div>
                        <div className="overflow-hidden">
                            <p className="font-bold text-gray-800 text-sm truncate">{user.name}</p>
                            <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                        </div>
                    </div>
                    <Button variant="white" fullWidth onClick={() => onLogout(false)} className="text-xs py-2">
                        <i className="fas fa-sign-out-alt mr-2"></i> Keluar
                    </Button>
                </div>
            </aside>

            <main className="app-main flex-1 relative overflow-y-auto">
                <header className="app-header bg-white shadow-sm p-4 sticky top-0 z-10 flex justify-between items-center no-print">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl md:hidden">🇮🇩</span>
                        <div>
                            <h1 className="font-extrabold text-brand-dark text-sm md:text-base leading-tight">{SCHOOL_IDENTITY.name}</h1>
                            <p className="text-[10px] text-gray-400">Tahun Pelajaran {SCHOOL_IDENTITY.academicYear}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowOnboarding(true)} title="Panduan Aplikasi" className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold">
                            <i className="fas fa-question"></i>
                        </button>
                        <button onClick={triggerManualPull} title="Tarik Cloud" className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 transition-all ${!isOnline ? 'bg-orange-100 text-orange-600' :
                            syncStatus === 'syncing' ? 'bg-blue-100 text-blue-600 animate-pulse' :
                                syncStatus === 'synced' ? 'bg-green-100 text-brand-green' :
                                    'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}>
                            <i className={`fas ${!isOnline ? 'fa-wifi-slash' : syncStatus === 'syncing' ? 'fa-spinner fa-spin' : 'fa-cloud-download-alt'}`}></i>
                            <span>{!isOnline ? 'Offline' : syncStatus === 'syncing' ? 'Menyinkronkan...' : syncStatus === 'synced' ? 'Tersinkron' : 'Tarik Cloud'}</span>
                        </button>
                        <button onClick={() => onLogout(false)} className="md:hidden w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                            <i className="fas fa-power-off text-xs"></i>
                        </button>
                    </div>
                </header>

                {!isOnline && (
                    <div className="bg-orange-500 text-white text-center py-1 text-xs font-bold shadow-sm no-print">
                        🛡️ Mode Offline Aktif. Data tersimpan lokal di perangkat dan otomatis tersinkron saat tersambung internet.
                    </div>
                )}

                <div className={`mx-auto ${compact ? 'p-2 md:p-4 max-w-7xl' : 'p-4 md:p-8 max-w-6xl'}`}>{children}</div>
            </main>

            <nav className={`app-nav md:hidden fixed bottom-0 w-full bg-white shadow-lg border-t border-gray-100 z-50 no-print ${user.role === ROLES.ADMIN
                    ? 'flex items-center px-2 py-2 overflow-x-auto justify-start space-x-1'
                    : 'grid px-2 py-2 text-center'
                }`}
                style={{
                    gridTemplateColumns: user.role === ROLES.ADMIN ? 'none' : `repeat(${navItems.length}, minmax(0, 1fr))`
                }}>
                {navItems.map(item => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center justify-center p-1.5 transition-colors ${user.role === ROLES.ADMIN ? 'min-w-[72px] shrink-0' : 'w-full'
                            } ${currentPath === item.path ? 'text-brand-red font-bold' : 'text-gray-400'}`}
                    >
                        <i className={`${item.icon} text-lg mb-1`}></i>
                        <span className="text-[10px] font-bold whitespace-nowrap">{item.label}</span>
                    </button>
                ))}
            </nav>

            {showOnboarding && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-2xl space-y-4">
                        <div className="text-center space-y-2">
                            <div className="text-4xl">🇮🇩</div>
                            <h3 className="font-black text-lg text-brand-dark">Selamat Datang di 7 Kebiasaan!</h3>
                            <p className="text-xs text-gray-500">Aplikasi Pembiasaan Karakter Positif {SCHOOL_IDENTITY.name}.</p>
                        </div>
                        <div className="bg-gray-50 p-3.5 rounded-xl space-y-2.5 text-xs text-gray-700">
                            {user.role === ROLES.SISWA ? (
                                <>
                                    <p>🌅 <strong>Tandai Rutinitas Pagi:</strong> Tekan tombol kilat untuk mengisi 4 kebiasaan pagi sekaligus.</p>
                                    <p>🏆 <strong>Lencana Karakter:</strong> Dapatkan gelar pejuang fajar dan kumpulkan poin setiap hari.</p>
                                    <p>📖 <strong>Jurnal Refleksi:</strong> Tuliskan kebaikan harian dan lihat tanggapan motivasi dari gurumu.</p>
                                </>
                            ) : user.role === ROLES.GURU ? (
                                <>
                                    <p>🔴 <strong>Filter Belum Mengisi:</strong> Pantau siswa binaan yang pasif hari ini secara instan.</p>
                                    <p>✏️ <strong>Edit Data Siswa:</strong> Ubah dan perbarui rincian siswa binaan langsung dari panel.</p>
                                    <p>🔑 <strong>Reset Sandi Siswa:</strong> Bantu siswa mereset kata sandi jika lupa secara langsung.</p>
                                    <p>💬 <strong>Apresiasi Jurnal:</strong> Berikan catatan motivasi langsung pada refleksi harian siswa.</p>
                                </>
                            ) : (
                                <>
                                    <p>📥 <strong>Import & Unduh Template:</strong> Unduh berkas format Excel murni dan pelajari panduan kolomnya.</p>
                                    <p>🗑️ <strong>Master CRUD & Multi-Select:</strong> Pilih banyak data siswa & guru untuk hapus, reset sandi, atau pindah kelas massal.</p>
                                    <p>📦 <strong>Arsip Semester:</strong> Backup dan telusuri riwayat semester lampau tanpa beban lag.</p>
                                    <p>🔑 <strong>Reset Sandi:</strong> Atur kata sandi guru dan siswa sewaktu-waktu.</p>
                                </>
                            )}
                        </div>
                        <Button fullWidth variant="primary" onClick={closeOnboarding}>Saya Mengerti, Mulai Sekarang</Button>
                    </Card>
                </div>
            )}
        </div>
    );
};
