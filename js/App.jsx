var App = () => {
    const [currentPath, setCurrentPath] = useState('/');
    const [user, setUser] = useState(null);
    const [compact, setCompact] = useState(localStorage.getItem(COMPACT_STORAGE_KEY) === 'true');
    const [isDefaultPass, setIsDefaultPass] = useState(false);
    const { isOnline, syncStatus, triggerSync, triggerManualPull } = useOnlineSyncEngine();
    const lastActivityRef = useRef(Date.now());
    const userRef = useRef(null);

    useEffect(() => { userRef.current = user; }, [user]);

    const defaultPathFor = (role) => role === ROLES.SISWA ? '/student/habits' : role === ROLES.GURU ? '/teacher/dashboard' : '/admin/dashboard';

    const checkIsDefaultPassword = useCallback(async (userData) => {
        if (!userData || userData.role === ROLES.ADMIN) {
            setIsDefaultPass(false);
            return;
        }

        const defaultPassText = userData.role === ROLES.GURU ? 'guru123' : 'siswa123';
        const defaultHash = await hashPassword(defaultPassText);
        const userPass = String(userData.password || '').trim();

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
                        const startPath = session.path || defaultPathFor(session.user.role);
                        setCurrentPath(startPath);
                        history.replaceState({ path: startPath }, '');
                        recordUserActivity();
                    } else {
                        localStorage.removeItem(SESSION_STORAGE_KEY);
                        history.replaceState({ path: '/' }, '');
                    }
                } catch (e) { localStorage.removeItem(SESSION_STORAGE_KEY); history.replaceState({ path: '/' }, ''); }
            } else {
                history.replaceState({ path: '/' }, '');
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

    useEffect(() => {
        const onPopState = (e) => {
            let path = (e.state && e.state.path) || '/';
            const u = userRef.current;
            if (u && (path === '/' || path === '/login')) {
                path = defaultPathFor(u.role);
                history.replaceState({ path }, '');
            }
            setCurrentPath(path);
            window.scrollTo(0, 0);
            const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
            if (sessionRaw) {
                try {
                    const session = JSON.parse(sessionRaw);
                    session.path = path;
                    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
                } catch (err) { }
            }
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const navigate = (path, { replace = false } = {}) => {
        setCurrentPath(path);
        window.scrollTo(0, 0);
        if (!(history.state && history.state.path === path)) {
            if (replace) history.replaceState({ path }, '');
            else history.pushState({ path }, '');
        }
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
        const defaultPath = defaultPathFor(u.role);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ user: u, lastActive: Date.now(), path: defaultPath }));
        navigate(defaultPath, { replace: true });
    };

    const handleLogout = (isTimeout = false) => {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setUser(null);
        setIsDefaultPass(false);
        navigate('/', { replace: true });
        if (isTimeout) showAlert.warning('Sesi Berakhir', 'Anda telah otomatis keluar karena tidak ada aktivitas selama 15 menit.');
    };

    if (currentPath === '/') return <LandingPage onStart={() => navigate('/login')} />;
    if (currentPath === '/login') return <LoginPage onLogin={handleLogin} triggerManualPull={triggerManualPull} />;
    if (!user) { navigate('/login', { replace: true }); return null; }

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
