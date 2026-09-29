var App = () => {
    const [currentPath, setCurrentPath] = useState('/');
    const [user, setUser] = useState(null);
    const [compact, setCompact] = useState(localStorage.getItem(COMPACT_STORAGE_KEY) === 'true');
    const [isDefaultPass, setIsDefaultPass] = useState(false); // State untuk mendeteksi kata sandi bawaan
    const { isOnline, syncStatus, triggerSync, triggerManualPull } = useOnlineSyncEngine();
    const lastActivityRef = useRef(Date.now());

    // Fungsi pengecekan kata sandi default
    const checkIsDefaultPassword = useCallback(async (userData) => {
        if (!userData || userData.role === ROLES.ADMIN) {
            setIsDefaultPass(false);
            return;
        }

        const defaultPassText = userData.role === ROLES.GURU ? 'guru123' : 'siswa123';
        const defaultHash = await hashPassword(defaultPassText);
        const userPass = String(userData.password || '').trim();

        // Cek jika kata sandi tersimpan cocok dengan teks polos bawaan atau hash SHA-256 bawaan
        if (userPass === defaultPassText || userPass === defaultHash || userPass === '') {
            setIsDefaultPass(true);
        } else {
            setIsDefaultPass(false);
        }
    }, []);

    const handleSetCompact = (val) => {
        setCompact(val);
        localStorage.setItem(COMPACT_STORAGE_KEY, String(val));
    };

    const recordUserActivity = useCallback(() => {
        const now = Date.now();
        lastActivityRef.current = now;
        const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionRaw) {
            try {
                const session = JSON.parse(sessionRaw);
                session.lastActive = now;
                localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
            } catch (err) { }
        }
    }, []);

    useEffect(() => {
        async function init() {
            await seedDatabaseClean();
            pullAllCloudData();
            if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW:', err));

            const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
            if (sessionRaw) {
                try {
                    const session = JSON.parse(sessionRaw);
                    const now = Date.now();
                    if (session.user && (now - session.lastActive < INACTIVITY_TIMEOUT_MS)) {
                        setUser(session.user);
                        await checkIsDefaultPassword(session.user);
                        setCurrentPath(session.path || (session.user.role === ROLES.SISWA ? '/student/habits' : session.user.role === ROLES.GURU ? '/teacher/dashboard' : '/admin/dashboard'));
                        recordUserActivity();
                    } else {
                        localStorage.removeItem(SESSION_STORAGE_KEY);
                    }
                } catch (e) { localStorage.removeItem(SESSION_STORAGE_KEY); }
            }
        }
        init();
    }, [recordUserActivity, checkIsDefaultPassword]);

    useEffect(() => {
        const handleActivity = () => recordUserActivity();
        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
        events.forEach(ev => window.addEventListener(ev, handleActivity, { passive: true }));

        const interval = setInterval(() => {
            const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
            if (sessionRaw) {
                try {
                    const session = JSON.parse(sessionRaw);
                    if (Date.now() - session.lastActive >= INACTIVITY_TIMEOUT_MS) handleLogout(true);
                } catch (e) { }
            }
        }, 10000);

        return () => {
            events.forEach(ev => window.removeEventListener(ev, handleActivity));
            clearInterval(interval);
        };
    }, [recordUserActivity]);

    const navigate = (path) => {
        setCurrentPath(path);
        window.scrollTo(0, 0);
        const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionRaw) {
            try {
                const session = JSON.parse(sessionRaw);
                session.path = path;
                session.lastActive = Date.now();
                localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
            } catch (e) { }
        }
    };

    const handleLogin = async (u) => {
        setUser(u);
        await checkIsDefaultPassword(u);
        let defaultPath = u.role === ROLES.SISWA ? '/student/habits' : u.role === ROLES.GURU ? '/teacher/dashboard' : '/admin/dashboard';
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ user: u, lastActive: Date.now(), path: defaultPath }));
        navigate(defaultPath);
    };

    const handleLogout = (isTimeout = false) => {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setUser(null);
        setIsDefaultPass(false);
        navigate('/');
        if (isTimeout) showAlert.warning('Sesi Berakhir', 'Anda telah otomatis keluar karena tidak ada aktivitas selama 15 menit.');
    };

    if (currentPath === '/') return <LandingPage onStart={() => navigate('/login')} />;
    if (currentPath === '/login') return <LoginPage onLogin={handleLogin} triggerManualPull={triggerManualPull} />;
    if (!user) { navigate('/login'); return null; }

    // INTEGRASI PAKSA GANTI PASSWORD
    // Jika kata sandi masih default, blokir total dan tampilkan layar wajib ganti sandi
    if (isDefaultPass) {
        return (
            <ForceChangePasswordScreen
                user={user}
                onPasswordChanged={(updatedUser) => {
                    setUser(updatedUser);
                    setIsDefaultPass(false);
                    triggerSync();
                }}
                onLogout={handleLogout}
            />
        );
    }

    let content = null;
    switch (currentPath) {
        case '/student/habits': content = <StudentHabitsPage user={user} triggerSync={triggerSync} compact={compact} />; break;
        case '/student/calendar': content = <StudentCalendarPage user={user} />; break;
        case '/student/journal': content = <StudentJournalPage user={user} triggerSync={triggerSync} />; break;
        case '/student/profile': content = <StudentProfilePage user={user} onUpdateUser={setUser} triggerSync={triggerSync} />; break;

        case '/teacher/dashboard': content = <TeacherDashboard user={user} triggerSync={triggerSync} triggerManualPull={triggerManualPull} />; break;
        case '/teacher/reports': content = <ReportsModule user={user} />; break;
        case '/teacher/profile': content = <TeacherProfilePage user={user} onUpdateUser={setUser} triggerSync={triggerSync} />; break;

        case '/admin/dashboard': content = <AdminDashboard triggerManualPull={triggerManualPull} navigate={navigate} />; break;
        case '/admin/habits': content = <AdminHabitsPage triggerSync={triggerSync} triggerManualPull={triggerManualPull} />; break;
        case '/admin/classes': content = <AdminClassesPage triggerSync={triggerSync} triggerManualPull={triggerManualPull} />; break;
        case '/admin/teachers': content = <AdminTeachersPage triggerSync={triggerSync} triggerManualPull={triggerManualPull} />; break;
        case '/admin/students': content = <AdminStudentsPage triggerSync={triggerSync} triggerManualPull={triggerManualPull} />; break;
        case '/admin/reports': content = <ReportsModule user={user} />; break;
        case '/admin/archives': content = <AdminArchivesPage />; break;
        case '/admin/profile': content = <AdminProfilePage user={user} onUpdateAdmin={setUser} triggerSync={triggerSync} />; break;

        default: content = <StudentHabitsPage user={user} triggerSync={triggerSync} compact={compact} />; break;
    }

    return (
        <AppLayout user={user} currentPath={currentPath} navigate={navigate} onLogout={handleLogout} isOnline={isOnline} syncStatus={syncStatus} triggerManualPull={triggerManualPull} compact={compact} setCompact={handleSetCompact}>
            {content}
        </AppLayout>
    );
};
