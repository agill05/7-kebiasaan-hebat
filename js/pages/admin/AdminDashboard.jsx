var AdminDashboard = ({ triggerManualPull, navigate }) => {
    const [stats, setStats] = useState({ teachers: 0, students: 0, classes: 0 });

    const loadDashboardData = async () => {
        const t = await db.users.where('role').equals(ROLES.GURU).count();
        const s = await db.users.where('role').equals(ROLES.SISWA).count();
        const c = await db.classes.count();
        setStats({ teachers: t, students: s, classes: c });
    };

    useEffect(() => { loadDashboardData(); }, []);

    const handleForcePushAllToCloud = async () => {
        const confirmRes = await showAlert.confirm(
            'Unggah Semua Data Lokal ke Cloud?',
            'Seluruh data Guru, Siswa, Kelas, Log, dan Jurnal di perangkat ini akan disinkronkan ke Google Sheets.',
            'Ya, Unggah Sekarang'
        );
        if (!confirmRes.isConfirmed) return;

        try {
            Swal.fire({
                title: 'Mengunggah Data...',
                text: 'Mohon tunggu, menyinkronkan seluruh database ke Google Sheets.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const [allUsers, allClasses, allLogs, allJournals, allHabits] = await Promise.all([
                db.users.toArray(),
                db.classes.toArray(),
                db.habitLogs.toArray(),
                db.journals.toArray(),
                db.habits.toArray()
            ]);

            if (allClasses.length > 0) {
                await fetch(GAS_API_URL, {
                    method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'syncClass', payload: allClasses })
                });
            }
            if (allUsers.length > 0) {
                await fetch(GAS_API_URL, {
                    method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'syncUser', payload: allUsers })
                });
            }
            if (allHabits.length > 0) {
                await fetch(GAS_API_URL, {
                    method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'syncHabitConfig', payload: allHabits })
                });
            }
            if (allLogs.length > 0) {
                await fetch(GAS_API_URL, {
                    method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'syncHabits', payload: allLogs })
                });
            }
            if (allJournals.length > 0) {
                await fetch(GAS_API_URL, {
                    method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'syncJournal', payload: allJournals })
                });
            }

            Swal.close();
            showAlert.success('Berhasil!', 'Semua data lokal telah terunggah ke Google Sheets.');
            await loadDashboardData();
        } catch (e) {
            Swal.close();
            showAlert.error('Gagal', 'Terjadi kesalahan jaringan: ' + e.message);
        }
    };

    const handleArchiveSemester = async () => {
        const confirmRes = await showAlert.confirm(
            'Arsipkan Data Semester?',
            'Semua catatan pembiasaan (Habit Logs) akan disalin ke lembar arsip Google Sheets dan dibersihkan dari database aktif.',
            'Ya, Arsipkan Sekarang'
        );
        if (!confirmRes.isConfirmed) return;

        try {
            await fetch(GAS_API_URL, {
                method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'archiveSemester', payload: { academicYear: SCHOOL_IDENTITY.academicYear } })
            });
            await db.habitLogs.clear();
            showAlert.success('Berhasil Diarsipkan', 'Database habit log aktif telah diarsipkan dan dibersihkan.');
            await triggerManualPull();
            await loadDashboardData();
        } catch (e) {
            showAlert.error('Gagal', 'Terjadi kesalahan saat mengarsipkan data.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-brand-dark">Ringkasan Sistem Administrator</h1>
                    <p className="text-gray-500 font-medium text-sm">Dashboard master kontrol data {SCHOOL_IDENTITY.name}.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="green" onClick={handleForcePushAllToCloud} className="text-xs py-2 px-3 flex items-center gap-1.5">
                        <i className="fas fa-cloud-upload-alt"></i> Unggah Semua ke Cloud
                    </Button>
                    <Button variant="secondary" onClick={() => navigate('/admin/habits')} className="text-xs py-2 px-3 flex items-center gap-1.5">
                        <i className="fas fa-sliders-h"></i> Kebiasaan Dinamis
                    </Button>
                    <Button variant="amber" onClick={handleArchiveSemester} className="text-xs py-2 px-3 flex items-center gap-1.5">
                        <i className="fas fa-archive"></i> Arsipkan Semester Ini
                    </Button>
                    <Button variant="white" onClick={triggerManualPull} className="text-xs py-2 px-3 flex items-center gap-1.5">
                        <i className="fas fa-sync-alt"></i> Tarik Cloud Sheets
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="text-center">
                    <i className="fas fa-chalkboard-teacher text-3xl text-brand-blue mb-1"></i>
                    <div className="text-3xl font-black">{stats.teachers}</div>
                    <div className="text-xs text-gray-400 font-bold uppercase">Total Guru</div>
                </Card>
                <Card className="text-center">
                    <i className="fas fa-user-graduate text-3xl text-brand-green mb-1"></i>
                    <div className="text-3xl font-black">{stats.students}</div>
                    <div className="text-xs text-gray-400 font-bold uppercase">Total Siswa</div>
                </Card>
                <Card className="text-center">
                    <i className="fas fa-door-open text-3xl text-brand-yellow mb-1"></i>
                    <div className="text-3xl font-black">{stats.classes}</div>
                    <div className="text-xs text-gray-400 font-bold uppercase">Total Kelas</div>
                </Card>
            </div>
        </div>
    );
};
