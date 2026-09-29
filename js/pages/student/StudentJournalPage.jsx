var StudentJournalPage = ({ user, triggerSync }) => {
    const todayStr = getTodayWitaDateString();
    const [mood, setMood] = useState('😊 Senang');
    const [content, setContent] = useState('');
    const [savedJournals, setSavedJournals] = useState([]);

    const loadJournals = async () => {
        const list = await db.journals.where('userId').equals(user.id).toArray();
        setSavedJournals(list.sort((a, b) => b.date.localeCompare(a.date)));
    };

    useEffect(() => { loadJournals(); }, [user.id]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!content.trim()) return showAlert.warning('Jurnal Kosong', 'Silakan tuliskan refleksi harianmu.');

        const jId = `j_${user.id}_${todayStr}`;
        const existing = await db.journals.get(jId);

        await db.journals.put({
            id: jId,
            userId: user.id,
            studentName: user.name,
            className: user.className || '',
            date: todayStr,
            mood,
            content: content.trim(),
            homeroomFeedback: existing?.homeroomFeedback || existing?.teacherFeedback || '',
            homeroomTeacherName: existing?.homeroomTeacherName || '',
            mentorFeedback: existing?.mentorFeedback || '',
            mentorTeacherName: existing?.mentorTeacherName || '',
            syncStatus: 'pending',
            updatedAt: new Date()
        });

        await db.syncQueue.put({
            id: `sync_j_${Date.now()}`, tableName: 'journals', recordId: jId, action: 'upsert', status: 'pending', createdAt: new Date()
        });

        showAlert.success('Jurnal Tersimpan!', 'Catatan refleksi harianmu berhasil dikirimkan ke guru.');
        setContent('');
        loadJournals();
        triggerSync();
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-dark">📖 Refleksi & Jurnal Harian Siswa</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <label className="text-xs font-bold text-gray-600">Tanggal Refleksi:</label>
                            <span className="px-3 py-1.5 bg-red-50 border border-red-200 text-brand-red rounded-xl text-xs font-black">
                                {formatDisplayDate(todayStr)} (WITA)
                            </span>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1.5">Bagaimana perasaanmu hari ini?</label>
                            <div className="flex flex-wrap gap-2">
                                {['😊 Senang', '🌟 Semangat', '😐 Biasa Saja', '😔 Sedih', '😴 Lelah'].map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setMood(m)}
                                        className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all border ${mood === m
                                                ? 'bg-amber-400 text-brand-dark border-amber-500 shadow-sm scale-105'
                                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Kebaikan & Pengalaman Positif Hari Ini:</label>
                            <textarea
                                rows="5"
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="Tuliskan cerita pengalaman atau kebaikan yang kamu lakukan hari ini..."
                                className="w-full p-3 bg-gray-50 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-red outline-none"
                                required
                            ></textarea>
                        </div>

                        <Button type="submit" fullWidth variant="primary" className="py-2.5">
                            <i className="fas fa-paper-plane mr-1.5"></i> Simpan & Kirim Refleksi
                        </Button>
                    </form>
                </Card>

                <Card className="space-y-3">
                    <h3 className="font-bold text-sm text-gray-700">Riwayat Jurnal & Apresiasi Guru</h3>
                    {savedJournals.length === 0 ? (
                        <EmptyState icon="📝" title="Belum Ada Jurnal" description="Tulis refleksi harian pertamamu hari ini." />
                    ) : (
                        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                            {savedJournals.map(j => {
                                const hrFb = j.homeroomFeedback || j.teacherFeedback || '';
                                const hrName = j.homeroomTeacherName || 'Wali Kelas';
                                const mtFb = j.mentorFeedback || '';
                                const mtName = j.mentorTeacherName || 'Guru Mentor';
                                const isSameDual = hrFb && mtFb && (hrFb === mtFb) && (hrName === mtName);

                                return (
                                    <div key={j.id} className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs space-y-2">
                                        <div className="flex justify-between font-extrabold text-brand-red">
                                            <span>{formatDisplayDate(j.date)}</span>
                                            <span>{j.mood}</span>
                                        </div>
                                        <p className="text-gray-700 leading-relaxed italic">"{j.content}"</p>

                                        {isSameDual && (
                                            <div className="mt-2 p-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl text-gray-800 space-y-0.5">
                                                <span className="font-extrabold text-brand-blue flex items-center gap-1">
                                                    <span>💬</span> Apresiasi Wali Kelas & Mentor ({hrName}):
                                                </span>
                                                <p className="italic text-gray-700">{hrFb}</p>
                                            </div>
                                        )}

                                        {!isSameDual && (
                                            <div className="space-y-2 pt-1">
                                                {hrFb && (
                                                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl space-y-0.5">
                                                        <span className="font-extrabold text-brand-blue block">
                                                            👨‍🏫 Wali Kelas ({hrName}):
                                                        </span>
                                                        <p className="italic text-gray-700">{hrFb}</p>
                                                    </div>
                                                )}
                                                {mtFb && (
                                                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-0.5">
                                                        <span className="font-extrabold text-emerald-700 block">
                                                            🌟 Guru Mentor ({mtName}):
                                                        </span>
                                                        <p className="italic text-gray-700">{mtFb}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};
