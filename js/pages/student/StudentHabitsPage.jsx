var StudentHabitsPage = ({ user, triggerSync, compact }) => {
    const todayStr = getTodayWitaDateString();
    const [logs, setLogs] = useState({});
    const [points, setPoints] = useState(0);
    const [allLogsCount, setAllLogsCount] = useState(0);
    const [activeHabitModal, setActiveHabitModal] = useState(null);
    const [modalTime, setModalTime] = useState('');
    const [modalDetail, setModalDetail] = useState('');
    const [streakCount, setStreakCount] = useState(0);

    const [notifPermission, setNotifPermission] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
    );

    const calculateStreak = async () => {
        let currentStreak = 0;
        let checkDate = new Date();

        for (let i = 0; i < 60; i++) {
            const dateStr = checkDate.toISOString().split('T')[0];
            const userLogs = await db.habitLogs
                .where('userId').equals(user.id)
                .and(l => l.date === dateStr && l.completed === true)
                .toArray();

            if (userLogs.length > 0) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                if (i === 0 && dateStr === todayStr) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                break;
            }
        }
        setStreakCount(currentStreak);
    };

    const loadLogs = async () => {
        const userLogs = await db.habitLogs.where('userId').equals(user.id).and(l => l.date === todayStr).toArray();
        const logMap = {};
        userLogs.forEach(l => {
            logMap[l.habitId] = { completed: l.completed, timeValue: formatCleanTime(l.timeValue), detailValue: l.detailValue };
        });
        setLogs(logMap);

        const allUserLogs = await db.habitLogs.where('userId').equals(user.id).toArray();
        setAllLogsCount(allUserLogs.filter(l => l.completed).length);

        const p = await db.points.where('userId').equals(user.id).first();
        setPoints(p ? p.totalPoints : 0);

        await calculateStreak();
    };

    useEffect(() => { loadLogs(); }, [user.id]);

    const handleEnableNotifications = async () => {
        if (typeof Notification === 'undefined') {
            return showAlert.warning('Tidak Didukung', 'Peramban ini tidak mendukung notifikasi.');
        }

        const permission = await Notification.requestPermission();
        setNotifPermission(permission);

        if (permission === 'granted') {
            showAlert.success('Notifikasi Aktif!', 'Kamu akan menerima pengingat harian mengisi kebiasaan.');
            try {
                new Notification("7 Kebiasaan Anak Indonesia 🇮🇩", {
                    body: "Pengingat berhasil diaktifkan! Mari capai target kebiasaan harimu.",
                    icon: "/favicon.ico"
                });
            } catch (e) { console.log(e); }
        } else if (permission === 'denied') {
            showAlert.error('Izin Ditolak', 'Notifikasi diblokir di setelan peramban.');
        }
    };

    const handleQuickFillMorning = async () => {
        const confirmRes = await showAlert.confirm(
            'Tandai Rutinitas Pagi?',
            '4 kebiasaan pagi (Bangun Pagi, Beribadah, Berolahraga, Makan Sehat) akan otomatis ditandai selesai.',
            'Ya, Tandai Sekarang'
        );
        if (!confirmRes.isConfirmed) return;

        const morningHabitIds = ['h1', 'h2', 'h3', 'h4'];
        let addedCount = 0;
        const newLogs = { ...logs };

        for (let hId of morningHabitIds) {
            if (!newLogs[hId]?.completed) {
                const hConfig = HABITS_CONFIG.find(h => h.id === hId);
                const logId = `${user.id}_${hId}_${todayStr}`;
                const logData = {
                    id: logId,
                    userId: user.id,
                    studentName: user.name,
                    className: user.className || '',
                    habitId: hId,
                    habitName: hConfig.name,
                    date: todayStr,
                    completed: true,
                    timeValue: hConfig.defaultTime,
                    detailValue: hConfig.defaultDetail,
                    syncStatus: 'pending',
                    updatedAt: new Date()
                };

                await db.habitLogs.put(logData);
                await db.syncQueue.put({
                    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    tableName: 'habitLogs',
                    recordId: logId,
                    action: 'upsert',
                    status: 'pending',
                    createdAt: new Date()
                });

                newLogs[hId] = { completed: true, timeValue: hConfig.defaultTime, detailValue: hConfig.defaultDetail };
                addedCount++;
            }
        }

        if (addedCount > 0) {
            const pRecord = await db.points.where('userId').equals(user.id).first();
            const newTotal = (pRecord ? pRecord.totalPoints : 0) + (addedCount * 10);
            await db.points.put({ id: `p_${user.id}`, userId: user.id, totalPoints: newTotal, updatedAt: new Date() });
            setPoints(newTotal);
        }

        setLogs(newLogs);
        await calculateStreak();
        showAlert.success('Rutinitas Pagi Tercatat!', `${addedCount} kebiasaan berhasil ditambahkan.`);
        triggerSync();
    };

    const handleCardClick = (habit) => {
        const existing = logs[habit.id] || {};
        setModalTime(existing.timeValue || getNowWitaTimeString());
        setModalDetail(existing.detailValue || '');
        setActiveHabitModal(habit);
    };

    const handleSaveHabitDetail = async (e) => {
        e.preventDefault();
        if (!activeHabitModal) return;

        const habit = activeHabitModal;
        const logId = `${user.id}_${habit.id}_${todayStr}`;
        const wasCompleted = logs[habit.id]?.completed;
        const cleanTime = formatCleanTime(modalTime);

        await db.habitLogs.put({
            id: logId,
            userId: user.id,
            studentName: user.name,
            className: user.className || '',
            habitId: habit.id,
            habitName: habit.name,
            date: todayStr,
            completed: true,
            timeValue: cleanTime,
            detailValue: modalDetail,
            syncStatus: 'pending',
            updatedAt: new Date()
        });

        await db.syncQueue.put({
            id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            tableName: 'habitLogs',
            recordId: logId,
            action: 'upsert',
            status: 'pending',
            createdAt: new Date()
        });

        setLogs(prev => ({ ...prev, [habit.id]: { completed: true, timeValue: cleanTime, detailValue: modalDetail } }));

        if (!wasCompleted) {
            const pRecord = await db.points.where('userId').equals(user.id).first();
            const newTotal = (pRecord ? pRecord.totalPoints : 0) + 10;
            await db.points.put({ id: `p_${user.id}`, userId: user.id, totalPoints: newTotal, updatedAt: new Date() });
            setPoints(newTotal);
        }

        await calculateStreak();
        setActiveHabitModal(null);
        showAlert.success('Kebiasaan Tercatat!', `${habit.name} berhasil disimpan.`);

        const updatedCompleted = Object.values({ ...logs, [habit.id]: { completed: true } }).filter(l => l.completed).length;
        if (updatedCompleted === 7) confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        triggerSync();
    };

    const completedCount = Object.values(logs).filter(l => l.completed).length;

    const badges = useMemo(() => [
        { id: 'b1', name: 'Pejuang Fajar', desc: 'Rutinitas Pagi', icon: '🌅', unlocked: !!logs['h1']?.completed },
        { id: 'b2', name: 'Karakter Hebat', desc: '7/7 Hari Ini', icon: '🌟', unlocked: completedCount === 7 },
        { id: 'b3', name: 'Master Pembiasaan', desc: 'Akumulasi Poin >= 100', icon: '🏆', unlocked: points >= 100 },
        { id: 'b4', name: 'Cendekia Teladan', desc: 'Rajin Belajar', icon: '📚', unlocked: allLogsCount >= 14 }
    ], [logs, completedCount, points, allLogsCount]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-red-600 to-brand-red p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black mb-1">
                        <span>🇮🇩</span> Pembiasaan Karakter Siswa
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black">Halo, {user.name}! 🌟</h1>
                    <p className="text-white/80 font-medium text-xs md:text-sm">Amalkan 7 kebiasaan anak hebat hari ini.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <div className="bg-white/15 backdrop-blur-md border border-white/20 p-2.5 px-4 rounded-2xl flex items-center gap-3">
                        <span className="text-3xl animate-bounce">🔥</span>
                        <div>
                            <div className="text-[10px] uppercase font-black text-white/70 tracking-wider">Hitung Beruntun</div>
                            <div className="text-lg font-black text-amber-300">{streakCount} Hari Berturut</div>
                        </div>
                    </div>

                    {notifPermission !== 'granted' && (
                        <button
                            onClick={handleEnableNotifications}
                            className="p-3 bg-amber-400 text-brand-dark hover:bg-amber-300 rounded-2xl font-extrabold text-xs flex items-center gap-1.5 shadow-lg transition-all"
                            title="Aktifkan Notifikasi Pengingat"
                        >
                            <i className="fas fa-bell"></i>
                            <span className="hidden sm:inline">Ingatkan Saya</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-wrap items-center gap-2 w-full justify-between md:justify-end">
                    <Button variant="amber" onClick={handleQuickFillMorning} className="text-xs py-2 px-3 flex items-center gap-1.5">
                        <i className="fas fa-bolt"></i> Tandai Rutinitas Pagi
                    </Button>
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                        <i className="fas fa-calendar-day text-brand-red text-xs"></i>
                        <span className="text-xs font-black text-brand-red">{formatDisplayDate(todayStr)} (WITA)</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 bg-gradient-to-r from-brand-red to-red-600 text-white flex justify-between items-center shadow-lg">
                    <div>
                        <h3 className="font-black text-lg">Progres Pembiasaan Hari Ini</h3>
                        <p className="text-xs opacity-90">Setiap kebiasaan bernilai 10 poin karakter hebat.</p>
                    </div>
                    <div className="text-right">
                        <span className="text-4xl font-black">{completedCount}/7</span>
                        <p className="text-xs font-bold uppercase opacity-90">{points} Poin Akumulasi</p>
                    </div>
                </Card>

                <Card className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lencana Prestasi Karakter</h4>
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {badges.map(b => (
                            <div key={b.id} title={`${b.name}: ${b.desc}`} className={`p-2 rounded-xl text-center border transition-all ${b.unlocked ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-40 grayscale'}`}>
                                <div className="text-xl mb-0.5">{b.icon}</div>
                                <div className="text-[9px] font-extrabold truncate">{b.name}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {HABITS_CONFIG.map(habit => {
                    const entry = logs[habit.id];
                    const isDone = !!entry?.completed;

                    return (
                        <div key={habit.id} onClick={() => handleCardClick(habit)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${isDone ? 'bg-green-50/70 border-brand-green shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${habit.color}`}>{habit.icon}</div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-sm md:text-base flex items-center gap-2">
                                            {habit.name}
                                            {isDone && <span className="text-[10px] px-2 py-0.5 bg-green-200 text-green-800 rounded-full font-extrabold">Terisi</span>}
                                        </h3>
                                        <p className="text-xs text-gray-500 leading-snug mt-0.5">{habit.defaultDetail}</p>
                                    </div>
                                </div>
                                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isDone ? 'bg-brand-green border-brand-green text-white scale-110' : 'border-gray-300'}`}>
                                    {isDone ? <i className="fas fa-check text-xs"></i> : <i className="fas fa-pen text-[10px] text-gray-400"></i>}
                                </div>
                            </div>

                            {isDone && (
                                <div className="mt-3 pt-3 border-t border-green-200/60 text-xs text-gray-700 bg-white/70 p-2.5 rounded-xl space-y-1">
                                    <div className="flex items-center gap-1 font-bold text-brand-dark">
                                        <i className="far fa-clock text-brand-blue"></i>
                                        <span>Pukul: {formatCleanTime(entry.timeValue)} WITA</span>
                                    </div>
                                    <p className="text-gray-600 italic line-clamp-2">"{entry.detailValue || '-'}"</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {activeHabitModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between border-b pb-3 mb-4">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{activeHabitModal.icon}</span>
                                <div>
                                    <h3 className="font-black text-lg text-brand-dark">{activeHabitModal.name}</h3>
                                    <p className="text-xs text-gray-400 font-bold">{formatDisplayDate(todayStr)} (WITA)</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveHabitModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                                <i className="fas fa-times text-lg"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSaveHabitDetail} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    <i className="far fa-clock mr-1 text-brand-red"></i> {activeHabitModal.timeLabel}
                                </label>
                                <input type="time" value={modalTime} onChange={e => setModalTime(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl font-extrabold text-brand-red text-sm" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    <i className="fas fa-align-left mr-1 text-brand-blue"></i> {activeHabitModal.detailLabel}
                                </label>
                                <textarea rows="3" value={modalDetail} onChange={e => setModalDetail(e.target.value)} placeholder={activeHabitModal.detailPlaceholder} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-brand-red" required></textarea>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="white" onClick={() => setActiveHabitModal(null)}>Tutup</Button>
                                <Button variant="primary" type="submit">Simpan Kebiasaan</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};
