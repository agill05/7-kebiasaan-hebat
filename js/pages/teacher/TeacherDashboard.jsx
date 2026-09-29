var TeacherDashboard = ({ user, triggerSync, triggerManualPull }) => {
    const [classes, setClasses] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [habitsList, setHabitsList] = useState([]);
    const [selectedTab, setSelectedTab] = useState('all');
    const [filterAlphaOnly, setFilterAlphaOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState(getTodayWitaDateString());
    const [classLogs, setClassLogs] = useState([]);
    const [addMode, setAddMode] = useState('select');
    const [selectedExistingStudentId, setSelectedExistingStudentId] = useState('');

    // State Modal Apresiasi Individu
    const [feedbackModalJournal, setFeedbackModalJournal] = useState(null);
    const [feedbackStudent, setFeedbackStudent] = useState(null);
    const [isDualRole, setIsDualRole] = useState(false);
    const [dualMode, setDualMode] = useState('both_same');
    const [homeroomText, setHomeroomText] = useState('');
    const [mentorText, setMentorText] = useState('');

    // State Modal Edit / Tambah Siswa
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [studentFormData, setStudentFormData] = useState({
        name: '', username: '', password: '', nisn: '', gender: 'Laki-laki', classId: ''
    });

    // State Multi-Select & Bulk Stamp
    const [selectedBulkStudentIds, setSelectedBulkStudentIds] = useState([]);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkStampPreset, setBulkStampPreset] = useState('🌟 Luar biasa, pertahankan kebiasaan baikmu!');
    const [customBulkText, setCustomBulkText] = useState('');
    const [showAnalytics, setShowAnalytics] = useState(true);

    const unassignedStudents = useMemo(() => {
        return allStudents.filter(s => s.mentorId !== user.id);
    }, [allStudents, user.id]);

    const loadData = async () => {
        const cls = await db.classes.toArray();
        const stds = await db.users.where('role').equals(ROLES.SISWA).toArray();
        const logs = await db.habitLogs.where('date').equals(selectedDate).toArray();
        const habs = await db.habits.toArray();
        setClasses(cls);
        setAllStudents(stds);
        setClassLogs(logs);
        setHabitsList(habs.length > 0 ? habs.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) : HABITS_CONFIG);
    };

    useEffect(() => { loadData(); }, [selectedDate]);

    const myHomeroomClasses = useMemo(() => {
        return classes.filter(c => c.teacherId === user.id);
    }, [classes, user.id]);

    const myHomeroomClassIds = useMemo(() => {
        return new Set(myHomeroomClasses.map(c => c.id));
    }, [myHomeroomClasses]);

    const myHomeroomClassNames = useMemo(() => {
        return new Set(myHomeroomClasses.map(c => (c.name || '').toLowerCase().trim()));
    }, [myHomeroomClasses]);

    const isStudentHomeroom = useCallback((s) => {
        return (
            (s.classId && myHomeroomClassIds.has(s.classId)) ||
            (s.className && myHomeroomClassNames.has(String(s.className).toLowerCase().trim())) ||
            (user.homeroomClassId && s.classId === user.homeroomClassId)
        );
    }, [myHomeroomClassIds, myHomeroomClassNames, user.homeroomClassId]);

    const isStudentMentor = useCallback((s) => {
        return s.mentorId === user.id;
    }, [user.id]);

    const filteredStudents = useMemo(() => {
        return allStudents.filter(s => {
            const isHomeroom = isStudentHomeroom(s);
            const isMentor = isStudentMentor(s);
            const matchesTab = selectedTab === 'homeroom' ? isHomeroom : selectedTab === 'mentor' ? isMentor : (isHomeroom || isMentor);

            const query = searchQuery.toLowerCase().trim();
            const matchesSearch = !query || s.name.toLowerCase().includes(query) || (s.nisn && s.nisn.includes(query)) || s.username.toLowerCase().includes(query);

            const completedToday = classLogs.some(l => l.userId === s.id && l.completed);
            const matchesAlpha = !filterAlphaOnly || !completedToday;

            return matchesTab && matchesSearch && matchesAlpha;
        });
    }, [allStudents, isStudentHomeroom, isStudentMentor, selectedTab, searchQuery, filterAlphaOnly, classLogs]);

    const homeroomCount = useMemo(() => allStudents.filter(s => isStudentHomeroom(s)).length, [allStudents, isStudentHomeroom]);
    const mentorCount = useMemo(() => allStudents.filter(s => isStudentMentor(s)).length, [allStudents, isStudentMentor]);
    const allCount = useMemo(() => allStudents.filter(s => isStudentHomeroom(s) || isStudentMentor(s)).length, [allStudents, isStudentHomeroom, isStudentMentor]);

    // Kalkulasi Analitik Kebiasaan Kelas
    const habitAnalytics = useMemo(() => {
        if (filteredStudents.length === 0) return [];
        const activeHabits = habitsList.filter(h => h.active !== false);
        return activeHabits.map(h => {
            const completedStudentsCount = filteredStudents.filter(s => {
                return classLogs.some(l => l.userId === s.id && l.habitId === h.id && l.completed);
            }).length;
            const percentage = Math.round((completedStudentsCount / filteredStudents.length) * 100);
            return { ...h, completedStudentsCount, totalStudents: filteredStudents.length, percentage };
        });
    }, [filteredStudents, classLogs, habitsList]);

    // Kontrol Seleksi Bulk
    const isAllVisibleSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedBulkStudentIds.includes(s.id));

    const toggleSelectAll = () => {
        if (isAllVisibleSelected) {
            const visibleIds = new Set(filteredStudents.map(s => s.id));
            setSelectedBulkStudentIds(prev => prev.filter(id => !visibleIds.has(id)));
        } else {
            const newIds = new Set([...selectedBulkStudentIds, ...filteredStudents.map(s => s.id)]);
            setSelectedBulkStudentIds(Array.from(newIds));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedBulkStudentIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    // Eksekusi Stempel Massal
    const handleApplyBulkStamp = async (e) => {
        e.preventDefault();
        if (selectedBulkStudentIds.length === 0) return;

        const finalNote = (bulkStampPreset === 'custom' ? customBulkText : bulkStampPreset).trim();
        if (!finalNote) return showAlert.warning('Peringatan', 'Catatan apresiasi tidak boleh kosong.');

        const selectedStudentsList = allStudents.filter(s => selectedBulkStudentIds.includes(s.id));
        let updatedCount = 0;

        for (let student of selectedStudentsList) {
            const jId = `j_${student.id}_${selectedDate}`;
            const existingJournal = await db.journals.get(jId);

            const isHomeroom = isStudentHomeroom(student);
            const isMentor = isStudentMentor(student);

            const updatedJournal = {
                id: jId,
                userId: student.id,
                studentName: student.name,
                className: student.className || '',
                date: selectedDate,
                mood: existingJournal?.mood || '😊 Senang',
                content: existingJournal?.content || '(Apresiasi Bimbingan Guru)',
                homeroomFeedback: isHomeroom ? finalNote : (existingJournal?.homeroomFeedback || ''),
                homeroomTeacherName: isHomeroom ? user.name : (existingJournal?.homeroomTeacherName || ''),
                mentorFeedback: isMentor ? finalNote : (existingJournal?.mentorFeedback || ''),
                mentorTeacherName: isMentor ? user.name : (existingJournal?.mentorTeacherName || ''),
                syncStatus: 'pending',
                updatedAt: new Date()
            };

            await db.journals.put(updatedJournal);
            await db.syncQueue.put({
                id: `sync_jbulk_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                tableName: 'journals',
                recordId: jId,
                action: 'upsert',
                status: 'pending',
                createdAt: new Date()
            });
            updatedCount++;
        }

        setIsBulkModalOpen(false);
        setSelectedBulkStudentIds([]);
        await loadData();
        triggerSync();
        showAlert.success('Apresiasi Massal Terkirim!', `${updatedCount} siswa berhasil diberikan stempel apresiasi.`);
    };

    const handleOpenFeedbackModal = async (student) => {
        const journal = await db.journals.where('userId').equals(student.id).and(j => j.date === selectedDate).first();
        if (!journal) {
            return showAlert.warning('Belum Ada Jurnal', `${student.name} belum mengisi jurnal refleksi pada tanggal ${formatDisplayDate(selectedDate)}.`);
        }

        const isHomeroom = isStudentHomeroom(student);
        const isMentor = isStudentMentor(student);
        const dual = isHomeroom && isMentor;

        setFeedbackStudent(student);
        setIsDualRole(dual);
        setFeedbackModalJournal(journal);

        const currentHr = journal.homeroomFeedback || journal.teacherFeedback || '';
        const currentMt = journal.mentorFeedback || '';

        setHomeroomText(currentHr);
        setMentorText(currentMt);

        if (dual && currentHr && currentMt && currentHr === currentMt) {
            setDualMode('both_same');
        } else if (dual && (currentHr || currentMt) && currentHr !== currentMt) {
            setDualMode('separate');
        } else {
            setDualMode('both_same');
        }
    };

    const handleSaveTeacherFeedback = async (e) => {
        e.preventDefault();
        if (!feedbackModalJournal || !feedbackStudent) return;

        const isHomeroom = isStudentHomeroom(feedbackStudent);
        const isMentor = isStudentMentor(feedbackStudent);
        let updatedJournal = { ...feedbackModalJournal, syncStatus: 'pending', updatedAt: new Date() };

        if (isHomeroom && isMentor) {
            if (dualMode === 'both_same') {
                const note = homeroomText.trim();
                updatedJournal.homeroomFeedback = note;
                updatedJournal.homeroomTeacherName = user.name;
                updatedJournal.mentorFeedback = note;
                updatedJournal.mentorTeacherName = user.name;
            } else {
                if (homeroomText.trim()) {
                    updatedJournal.homeroomFeedback = homeroomText.trim();
                    updatedJournal.homeroomTeacherName = user.name;
                }
                if (mentorText.trim()) {
                    updatedJournal.mentorFeedback = mentorText.trim();
                    updatedJournal.mentorTeacherName = user.name;
                }
            }
        } else if (isHomeroom) {
            updatedJournal.homeroomFeedback = homeroomText.trim();
            updatedJournal.homeroomTeacherName = user.name;
        } else if (isMentor) {
            updatedJournal.mentorFeedback = mentorText.trim();
            updatedJournal.mentorTeacherName = user.name;
        }

        await db.journals.put(updatedJournal);
        await db.syncQueue.put({
            id: `sync_fb_${Date.now()}`, tableName: 'journals', recordId: feedbackModalJournal.id, action: 'upsert', status: 'pending', createdAt: new Date()
        });

        showAlert.success('Apresiasi Tersimpan!', 'Catatan apresiasi Anda berhasil dikirim ke siswa.');
        setFeedbackModalJournal(null);
        setFeedbackStudent(null);
        triggerSync();
    };

    const handleOpenAddModal = () => {
        setEditingStudent(null);
        setAddMode('select');
        setSelectedExistingStudentId('');

        const defaultClassId = myHomeroomClasses[0]?.id || user.homeroomClassId || (classes[0]?.id || '');
        setStudentFormData({
            name: '', username: '', password: '', nisn: '', gender: 'Laki-laki', classId: defaultClassId
        });
        setIsStudentModalOpen(true);
    };

    const handleTeacherSaveStudent = async (e) => {
        e.preventDefault();
        const targetName = studentFormData.name.trim();
        const targetUsername = studentFormData.username.trim();
        const targetNisn = studentFormData.nisn.trim();
        const currentId = editingStudent ? editingStudent.id : null;
        const allUsers = await db.users.toArray();

        if (!editingStudent && addMode === 'select') {
            if (!selectedExistingStudentId) {
                return showAlert.warning('Peringatan', 'Silakan pilih siswa dari daftar terlebih dahulu!');
            }

            const targetStudent = allStudents.find(s => s.id === selectedExistingStudentId);
            if (!targetStudent) return;

            const updated = {
                ...targetStudent,
                mentorId: user.id,
                mentorName: user.name,
                updatedAt: new Date()
            };

            await db.users.put(updated);
            await db.syncQueue.put({
                id: `sync_${Date.now()}`,
                tableName: 'users',
                recordId: targetStudent.id,
                action: 'update',
                status: 'pending',
                createdAt: new Date()
            });

            setIsStudentModalOpen(false);
            await loadData();
            triggerSync();
            return showAlert.success('Berhasil', `${targetStudent.name} berhasil ditambahkan ke daftar siswa binaan Anda.`);
        }

        if (allUsers.some(u => u.id !== currentId && u.username.toLowerCase() === targetUsername.toLowerCase())) {
            return showAlert.warning('Peringatan', `Username "@${targetUsername}" sudah digunakan.`);
        }

        const selectedClass = classes.find(c => c.id === studentFormData.classId);

        if (editingStudent) {
            const updated = {
                ...editingStudent,
                name: targetName,
                username: targetUsername,
                nisn: targetNisn,
                gender: studentFormData.gender,
                classId: studentFormData.classId,
                className: selectedClass?.name || editingStudent.className,
                avatar: studentFormData.gender === 'Laki-laki' ? '👦' : '👧',
                updatedAt: new Date()
            };
            await db.users.put(updated);
            await db.syncQueue.put({ id: `sync_${Date.now()}`, tableName: 'users', recordId: editingStudent.id, action: 'update', status: 'pending', createdAt: new Date() });
        } else {
            const newId = `u_siswa_${Date.now()}`;
            const defaultPass = studentFormData.password.trim() || 'siswa123';
            const hashedPassword = await hashPassword(defaultPass);
            const created = {
                id: newId,
                username: targetUsername,
                password: hashedPassword,
                name: targetName,
                nisn: targetNisn,
                classId: studentFormData.classId || '',
                className: selectedClass?.name || '',
                mentorId: user.id,
                mentorName: user.name,
                gender: studentFormData.gender,
                role: ROLES.SISWA,
                avatar: studentFormData.gender === 'Laki-laki' ? '👦' : '👧',
                createdBy: user.name,
                status: 'Aktif',
                createdAt: new Date()
            };
            await db.users.put(created);
            await db.syncQueue.put({ id: `sync_${Date.now()}`, tableName: 'users', recordId: newId, action: 'create', status: 'pending', createdAt: new Date() });
        }

        setIsStudentModalOpen(false);
        await loadData();
        triggerSync();
        showAlert.success('Berhasil', 'Data siswa berhasil disimpan.');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-brand-dark">Dashboard Guru & Pembimbing</h1>
                    <p className="text-gray-500 font-medium text-sm">Monitoring pembiasaan harian, analitik kelas, dan stempel apresiasi massal.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="primary" onClick={handleOpenAddModal} className="text-xs py-2 px-3">
                        <i className="fas fa-user-plus mr-1"></i> + Tambah Siswa
                    </Button>
                    <Button variant="white" onClick={triggerManualPull} className="text-xs py-2 px-3">
                        <i className="fas fa-sync-alt mr-1"></i> Tarik Cloud
                    </Button>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="p-2 border rounded-xl text-xs font-bold text-brand-red bg-white" />
                </div>
            </div>

            {/* WIDGET GRAFIK ANALITIK KEBIASAAN KELAS */}
            <Card className="space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-black text-sm text-brand-dark flex items-center gap-2">
                        <i className="fas fa-chart-bar text-brand-blue"></i> Analitik Ketercapaian Kebiasaan Kelas Hari Ini
                    </h3>
                    <button onClick={() => setShowAnalytics(!showAnalytics)} className="text-xs font-bold text-brand-blue hover:underline">
                        {showAnalytics ? 'Sembunyikan Grafik' : 'Tampilkan Grafik'}
                    </button>
                </div>

                {showAnalytics && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                        {habitAnalytics.map(h => (
                            <div key={h.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5">
                                <div className="flex justify-between items-center text-xs font-extrabold text-brand-dark">
                                    <span className="flex items-center gap-1.5"><span>{h.icon}</span> {h.shortName || h.name}</span>
                                    <span className="text-brand-red font-black">{h.percentage}%</span>
                                </div>
                                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${h.percentage >= 80 ? 'bg-green-500' : h.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                        style={{ width: `${h.percentage}%` }}
                                    ></div>
                                </div>
                                <div className="text-[10px] text-gray-400 font-bold text-right">
                                    {h.completedStudentsCount} dari {h.totalStudents} siswa
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* BAR KONTROL SELEKSI & FILTER */}
            <Card className="space-y-3 p-4">
                <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
                    <div className="relative w-full md:w-80">
                        <i className="fas fa-search absolute left-3.5 top-3 text-gray-400 text-xs"></i>
                        <input type="text" placeholder="Cari nama, NISN, atau username..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold" />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button onClick={() => setFilterAlphaOnly(!filterAlphaOnly)} className={`text-xs px-3.5 py-2 rounded-xl font-extrabold transition-all flex items-center gap-1.5 ${filterAlphaOnly ? 'bg-red-500 text-white shadow-md' : 'bg-red-50 text-brand-red hover:bg-red-100'}`}>
                            <i className="fas fa-user-clock"></i>
                            <span>{filterAlphaOnly ? 'Menampilkan: Belum Mengisi' : 'Tampilkan yang Belum Mengisi'}</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-t pt-3">
                    <div className="flex gap-2 overflow-x-auto text-xs font-bold w-full md:w-auto">
                        <button onClick={() => setSelectedTab('all')} className={`px-4 py-2 rounded-xl transition-all ${selectedTab === 'all' ? 'bg-brand-red text-white' : 'bg-gray-50 text-gray-600'}`}>
                            Semua Binaan ({allCount})
                        </button>
                        <button onClick={() => setSelectedTab('homeroom')} className={`px-4 py-2 rounded-xl transition-all ${selectedTab === 'homeroom' ? 'bg-brand-red text-white' : 'bg-gray-50 text-gray-600'}`}>
                            Kelas Binaan ({homeroomCount})
                        </button>
                        <button onClick={() => setSelectedTab('mentor')} className={`px-4 py-2 rounded-xl transition-all ${selectedTab === 'mentor' ? 'bg-brand-red text-white' : 'bg-gray-50 text-gray-600'}`}>
                            Mentoring ({mentorCount})
                        </button>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0">
                        <label className="flex items-center gap-2 text-xs font-extrabold text-gray-600 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={isAllVisibleSelected}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 text-brand-red rounded border-gray-300 focus:ring-brand-red cursor-pointer"
                            />
                            <span>Pilih Semua ({filteredStudents.length})</span>
                        </label>

                        {selectedBulkStudentIds.length > 0 && (
                            <Button variant="green" onClick={() => setIsBulkModalOpen(true)} className="text-xs py-2 px-3 flex items-center gap-1.5 shadow-md">
                                <i className="fas fa-stamp"></i> Stempel Massal ({selectedBulkStudentIds.length})
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {filteredStudents.length === 0 ? (
                <Card><EmptyState icon="👦" title="Tidak Ada Siswa Ditemukan" description="Coba sesuaikan pencarian atau nonaktifkan filter siswa belum mengisi." /></Card>
            ) : (
                <div className="space-y-4">
                    {filteredStudents.map(student => {
                        const studentLogs = classLogs.filter(l => l.userId === student.id && l.completed);
                        const count = studentLogs.length;
                        const isSelected = selectedBulkStudentIds.includes(student.id);

                        return (
                            <Card key={student.id} className={`space-y-3 border-2 transition-all ${isSelected ? 'border-brand-red bg-red-50/20 shadow-md' : 'border-gray-100'}`}>
                                <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-3 gap-2">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelectOne(student.id)}
                                            className="w-4 h-4 text-brand-red rounded border-gray-300 focus:ring-brand-red cursor-pointer shrink-0"
                                        />
                                        <div className="w-10 h-10 rounded-full bg-brand-yellow/20 text-brand-dark flex items-center justify-center font-black text-lg shrink-0">
                                            {student.avatar || '👦'}
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-brand-dark text-base">{student.name}</h3>
                                            <p className="text-xs text-gray-400 font-bold">@{student.username} • NISN: {student.nisn || '-'} • Kelas: {student.className || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap pl-7 md:pl-0">
                                        <span className={`text-xs px-3 py-1 rounded-full font-black ${count === 7 ? 'bg-green-100 text-green-700' : count > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                            {count === 0 ? '🔴 Belum Mengisi' : `${count} / 7 Selesai`}
                                        </span>

                                        <button onClick={() => {
                                            setEditingStudent(student);
                                            setStudentFormData({
                                                name: student.name,
                                                username: student.username,
                                                password: '',
                                                nisn: student.nisn || '',
                                                gender: student.gender || 'Laki-laki',
                                                classId: student.classId || myHomeroomClasses[0]?.id || ''
                                            });
                                            setIsStudentModalOpen(true);
                                        }} className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-brand-blue rounded-lg hover:bg-blue-100 flex items-center gap-1 transition-all" title="Edit Data Siswa">
                                            <i className="fas fa-edit text-[10px]"></i> Edit
                                        </button>
                                        <button onClick={async () => {
                                            const success = await promptResetPassword(student, 'siswa123');
                                            if (success) {
                                                await loadData();
                                                triggerSync();
                                            }
                                        }} className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 flex items-center gap-1 transition-all" title="Reset Kata Sandi Siswa">
                                            <i className="fas fa-key text-[10px]"></i> Reset Sandi
                                        </button>
                                        <button onClick={() => handleOpenFeedbackModal(student)} className="px-2.5 py-1 text-xs font-bold bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 flex items-center gap-1">
                                            <i className="fas fa-comment-dots"></i> Apresiasi
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                                    {habitsList.filter(h => h.active !== false).map(h => {
                                        const log = studentLogs.find(l => l.habitId === h.id);
                                        const isDone = !!log;
                                        return (
                                            <div key={h.id} className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between ${isDone ? 'bg-green-50/50 border-green-200' : 'bg-gray-50/60 border-gray-100 opacity-60'}`}>
                                                <div className="flex items-center justify-between font-bold mb-1">
                                                    <span className="flex items-center gap-1.5 text-gray-800">
                                                        <span>{h.icon}</span> {h.shortName || h.name}
                                                    </span>
                                                    <span className={isDone ? 'text-green-600 font-extrabold' : 'text-gray-400 font-normal'}>
                                                        {isDone ? `Pkl ${formatCleanTime(log.timeValue)} WITA` : 'Belum'}
                                                    </span>
                                                </div>
                                                {isDone && (
                                                    <p className="text-gray-600 text-[11px] bg-white p-1.5 rounded-lg border border-green-100 mt-1 line-clamp-2">{log.detailValue || '-'}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* MODAL STEMPEL APRESIASI MASSAL */}
            {isBulkModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg shadow-2xl space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h3 className="font-black text-base md:text-lg text-brand-dark flex items-center gap-2">
                                <i className="fas fa-stamp text-brand-green"></i> Stempel Apresiasi Massal
                            </h3>
                            <button onClick={() => setIsBulkModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs space-y-1">
                            <p className="font-bold text-green-900">
                                Apresiasi akan terkirim ke <b>{selectedBulkStudentIds.length} Siswa</b> terpilih untuk tanggal <b>{formatDisplayDate(selectedDate)}</b>.
                            </p>
                        </div>

                        <form onSubmit={handleApplyBulkStamp} className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Pilih Pesan Stempel Cepat:</label>
                                <select
                                    value={bulkStampPreset}
                                    onChange={e => setBulkStampPreset(e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-green outline-none"
                                >
                                    <option value="🌟 Luar biasa, pertahankan kebiasaan baikmu!">🌟 Luar biasa, pertahankan kebiasaan baikmu!</option>
                                    <option value="👍 Bagus sekali, tingkatkan terus ibadah dan belajarmu!">👍 Bagus sekali, tingkatkan terus ibadah dan belajarmu!</option>
                                    <option value="💪 Semangat terus, kamu anak Indonesia yang hebat!">💪 Semangat terus, kamu anak Indonesia yang hebat!</option>
                                    <option value="❤️ Hebat! Terima kasih sudah konsisten jujur dan disiplin.">❤️ Hebat! Terima kasih sudah konsisten jujur dan disiplin.</option>
                                    <option value="custom">✏️ Tulis Pesan Kustom Sendiri...</option>
                                </select>
                            </div>

                            {bulkStampPreset === 'custom' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Ketik Pesan Apresiasi Kustom:</label>
                                    <textarea
                                        rows="3"
                                        value={customBulkText}
                                        onChange={e => setCustomBulkText(e.target.value)}
                                        placeholder="Tuliskan kata-kata motivasi untuk siswa..."
                                        className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-green"
                                        required
                                    ></textarea>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <Button variant="white" onClick={() => setIsBulkModalOpen(false)}>Batal</Button>
                                <Button variant="green" type="submit">
                                    <i className="fas fa-check-circle mr-1"></i> Terapkan Stempel Massal
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* MODAL APRESIASI INDIVIDU */}
            {feedbackModalJournal && feedbackStudent && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg shadow-2xl space-y-3">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h3 className="font-black text-base md:text-lg text-brand-dark">💬 Berikan Apresiasi Jurnal</h3>
                            <button onClick={() => { setFeedbackModalJournal(null); setFeedbackStudent(null); }} className="text-gray-400 hover:text-gray-600">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                            <div className="flex justify-between font-bold text-gray-700">
                                <span>{feedbackModalJournal.studentName}</span>
                                <span className="text-brand-red">{feedbackModalJournal.mood}</span>
                            </div>
                            <p className="text-gray-600 italic">"{feedbackModalJournal.content}"</p>
                        </div>

                        <form onSubmit={handleSaveTeacherFeedback} className="space-y-3">
                            {isDualRole ? (
                                <div className="space-y-3">
                                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
                                        <p className="font-bold text-amber-900">
                                            ⭐ Anda terdata sebagai <b>Wali Kelas</b> sekaligus <b>Guru Mentor</b> untuk siswa ini.
                                        </p>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setDualMode('both_same')} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${dualMode === 'both_same' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-gray-700 border'}`}>
                                                Kirim Sekaligus (1 Pesan)
                                            </button>
                                            <button type="button" onClick={() => setDualMode('separate')} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${dualMode === 'separate' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-gray-700 border'}`}>
                                                Tulis Catatan Terpisah
                                            </button>
                                        </div>
                                    </div>

                                    {dualMode === 'both_same' ? (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Pesan Apresiasi (Otomatis tercatat sebagai Wali & Mentor):</label>
                                            <textarea rows="3" value={homeroomText} onChange={e => { setHomeroomText(e.target.value); setMentorText(e.target.value); }} placeholder="Tuliskan kata motivasi untuk siswa..." className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue" required></textarea>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div>
                                                <label className="block text-xs font-bold text-brand-blue mb-1">Catatan sebagai Wali Kelas:</label>
                                                <textarea rows="2" value={homeroomText} onChange={e => setHomeroomText(e.target.value)} placeholder="Catatan perkembangan kelas..." className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue"></textarea>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-emerald-600 mb-1">Catatan sebagai Guru Mentor:</label>
                                                <textarea rows="2" value={mentorText} onChange={e => setMentorText(e.target.value)} placeholder="Bimbingan karakter & motivasi..." className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"></textarea>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : isStudentHomeroom(feedbackStudent) ? (
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-xs font-bold text-brand-blue mb-1">Apresiasi sebagai Wali Kelas ({user.name}):</label>
                                        <textarea rows="3" value={homeroomText} onChange={e => setHomeroomText(e.target.value)} placeholder="Tuliskan pesan apresiasi atau bimbingan..." className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue" required></textarea>
                                    </div>
                                    {feedbackModalJournal.mentorFeedback && (
                                        <div className="p-2 bg-gray-50 border rounded-lg text-xs text-gray-500">
                                            <span className="font-bold text-gray-700 block">Catatan Guru Mentor ({feedbackModalJournal.mentorTeacherName || 'Mentor'}):</span>
                                            "{feedbackModalJournal.mentorFeedback}"
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-600 mb-1">Apresiasi sebagai Guru Mentor ({user.name}):</label>
                                        <textarea rows="3" value={mentorText} onChange={e => setMentorText(e.target.value)} placeholder="Tuliskan pesan motivasi pembiasaan karakter..." className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500" required></textarea>
                                    </div>
                                    {feedbackModalJournal.homeroomFeedback && (
                                        <div className="p-2 bg-gray-50 border rounded-lg text-xs text-gray-500">
                                            <span className="font-bold text-gray-700 block">Catatan Wali Kelas ({feedbackModalJournal.homeroomTeacherName || 'Wali Kelas'}):</span>
                                            "{feedbackModalJournal.homeroomFeedback}"
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="white" onClick={() => { setFeedbackModalJournal(null); setFeedbackStudent(null); }}>Batal</Button>
                                <Button variant="primary" type="submit">Kirim Apresiasi</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* MODAL EDIT / TAMBAH SISWA BINAAN */}
            {isStudentModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-2xl">
                        <h3 className="font-black text-lg mb-4 text-brand-dark">{editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Binaan'}</h3>
                        <form onSubmit={handleTeacherSaveStudent} className="space-y-3">
                            {!editingStudent && (
                                <div className="flex bg-gray-100 p-1 rounded-xl mb-4 text-xs font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setAddMode('select')}
                                        className={`flex-1 py-2 rounded-lg transition-all ${addMode === 'select' ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500'}`}
                                    >
                                        <i className="fas fa-list-ul mr-1"></i> Pilih dari Terdaftar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAddMode('manual')}
                                        className={`flex-1 py-2 rounded-lg transition-all ${addMode === 'manual' ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500'}`}
                                    >
                                        <i className="fas fa-user-plus mr-1"></i> Input Manual Baru
                                    </button>
                                </div>
                            )}

                            {!editingStudent && addMode === 'select' ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">
                                            Pilih Siswa Terdaftar (Master Admin):
                                        </label>
                                        {unassignedStudents.length === 0 ? (
                                            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
                                                Semua siswa yang terdaftar di sistem sudah masuk ke dalam daftar binaan Anda.
                                            </div>
                                        ) : (
                                            <select
                                                value={selectedExistingStudentId}
                                                onChange={e => setSelectedExistingStudentId(e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-red outline-none"
                                                required
                                            >
                                                <option value="">-- Pilih Nama Siswa --</option>
                                                {unassignedStudents.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name} (@{s.username}) {s.className ? `- Kelas ${s.className}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                                            Siswa yang dipilih akan otomatis dihubungkan ke akun guru Anda sebagai siswa binaan.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Nama Lengkap Siswa"
                                        value={studentFormData.name}
                                        onChange={e => setStudentFormData({ ...studentFormData, name: e.target.value })}
                                        className="w-full p-2.5 border rounded-xl text-sm font-medium"
                                        required
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Username"
                                            value={studentFormData.username}
                                            onChange={e => setStudentFormData({ ...studentFormData, username: e.target.value })}
                                            className="w-full p-2.5 border rounded-xl text-sm font-medium"
                                            required
                                        />
                                        <input
                                            type="text"
                                            placeholder="NISN (Opsional)"
                                            value={studentFormData.nisn}
                                            onChange={e => setStudentFormData({ ...studentFormData, nisn: e.target.value })}
                                            className="w-full p-2.5 border rounded-xl text-sm font-medium"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={studentFormData.classId}
                                            onChange={e => setStudentFormData({ ...studentFormData, classId: e.target.value })}
                                            className="w-full p-2.5 border rounded-xl text-sm font-semibold"
                                            required
                                        >
                                            <option value="">-- Pilih Kelas --</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <select
                                            value={studentFormData.gender}
                                            onChange={e => setStudentFormData({ ...studentFormData, gender: e.target.value })}
                                            className="w-full p-2.5 border rounded-xl text-sm font-semibold"
                                        >
                                            <option value="Laki-laki">Laki-laki</option>
                                            <option value="Perempuan">Perempuan</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <Button variant="white" onClick={() => setIsStudentModalOpen(false)}>Batal</Button>
                                <Button
                                    variant="primary"
                                    type="submit"
                                    disabled={!editingStudent && addMode === 'select' && unassignedStudents.length === 0}
                                >
                                    Simpan Siswa
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};
