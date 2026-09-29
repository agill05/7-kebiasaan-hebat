var AdminHabitsPage = ({ triggerSync, triggerManualPull }) => {
    const [habitsList, setHabitsList] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHabit, setEditingHabit] = useState(null);
    const [formData, setFormData] = useState({
        name: '', shortName: '', defaultTime: '', defaultDetail: '',
        icon: '⭐', color: 'bg-blue-100 text-blue-600',
        timeLabel: '', detailLabel: '', detailPlaceholder: '', sortOrder: 1, active: true
    });

    const loadHabits = async () => {
        const list = await db.habits.toArray();
        setHabitsList(list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
    };

    useEffect(() => { loadHabits(); }, []);

    const handleToggleActive = async (habit) => {
        const updated = { ...habit, active: !habit.active, updatedAt: new Date() };
        await db.habits.put(updated);
        await db.syncQueue.put({
            id: `sync_hcfg_${Date.now()}`, tableName: 'habits', recordId: habit.id, action: 'update', status: 'pending', createdAt: new Date()
        });
        await loadHabits();
        triggerSync();
    };

    const handleOpenEdit = (habit) => {
        setEditingHabit(habit);
        setFormData({
            name: habit.name || '',
            shortName: habit.shortName || '',
            defaultTime: habit.defaultTime || '07:00',
            defaultDetail: habit.defaultDetail || '',
            icon: habit.icon || '⭐',
            color: habit.color || 'bg-blue-100 text-blue-600',
            timeLabel: habit.timeLabel || '',
            detailLabel: habit.detailLabel || '',
            detailPlaceholder: habit.detailPlaceholder || '',
            sortOrder: habit.sortOrder || 1,
            active: habit.active !== false
        });
        setIsModalOpen(true);
    };

    const handleSaveHabit = async (e) => {
        e.preventDefault();
        if (!editingHabit) return;

        const updated = {
            ...editingHabit,
            ...formData,
            sortOrder: Number(formData.sortOrder),
            updatedAt: new Date()
        };

        await db.habits.put(updated);
        await db.syncQueue.put({
            id: `sync_hcfg_${Date.now()}`, tableName: 'habits', recordId: editingHabit.id, action: 'update', status: 'pending', createdAt: new Date()
        });

        setIsModalOpen(false);
        await loadHabits();
        triggerSync();
        showAlert.success('Berhasil Disimpan', `Pengaturan kebiasaan "${updated.name}" diperbarui.`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-brand-dark">⚙️ Pengaturan Kebiasaan Dinamis</h1>
                    <p className="text-gray-500 font-medium text-sm">Sesuaikan jam target, panduan, ikon, urutan, dan status aktif/nonaktif pilar kebiasaan.</p>
                </div>
                <Button variant="white" onClick={triggerManualPull} className="text-xs py-2 px-3">
                    <i className="fas fa-sync-alt mr-1"></i> Tarik Cloud
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {habitsList.map(h => (
                    <Card key={h.id} className={`space-y-3 border-2 ${h.active !== false ? 'border-gray-100' : 'border-dashed border-gray-300 opacity-60 bg-gray-50'}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 ${h.color}`}>{h.icon}</div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">Urutan #{h.sortOrder}</span>
                                        <h3 className="font-extrabold text-brand-dark text-base">{h.name}</h3>
                                    </div>
                                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{h.defaultDetail}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleToggleActive(h)}
                                className={`px-3 py-1 rounded-full text-xs font-black transition-all ${h.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
                            >
                                {h.active !== false ? 'Aktif' : 'Nonaktif'}
                            </button>
                        </div>

                        <div className="p-2.5 bg-gray-50 rounded-xl text-xs space-y-1 font-medium text-gray-600">
                            <div><b>Jam Target:</b> {h.defaultTime} WITA</div>
                            <div><b>Label Input:</b> {h.detailLabel || '-'}</div>
                        </div>

                        <div className="flex justify-end pt-1">
                            <Button variant="white" onClick={() => handleOpenEdit(h)} className="text-xs py-1.5 px-3">
                                <i className="fas fa-pen mr-1 text-brand-blue"></i> Edit Konfigurasi
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
                        <h3 className="font-black text-lg text-brand-dark border-b pb-2">Edit Kebiasaan: {editingHabit?.name}</h3>
                        <form onSubmit={handleSaveHabit} className="space-y-3 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block font-bold text-gray-600 mb-1">Nama Kebiasaan</label>
                                    <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border rounded-xl font-bold" required />
                                </div>
                                <div>
                                    <label className="block font-bold text-gray-600 mb-1">Nama Singkat (Tabel)</label>
                                    <input type="text" value={formData.shortName} onChange={e => setFormData({ ...formData, shortName: e.target.value })} className="w-full p-2.5 border rounded-xl font-bold" required />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block font-bold text-gray-600 mb-1">Ikon (Emoji)</label>
                                    <input type="text" value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} className="w-full p-2.5 border rounded-xl text-center text-lg font-bold" required />
                                </div>
                                <div>
                                    <label className="block font-bold text-gray-600 mb-1">Jam Target</label>
                                    <input type="time" value={formData.defaultTime} onChange={e => setFormData({ ...formData, defaultTime: e.target.value })} className="w-full p-2.5 border rounded-xl font-bold" required />
                                </div>
                                <div>
                                    <label className="block font-bold text-gray-600 mb-1">Urutan</label>
                                    <input type="number" value={formData.sortOrder} onChange={e => setFormData({ ...formData, sortOrder: e.target.value })} className="w-full p-2.5 border rounded-xl font-bold" min="1" required />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-gray-600 mb-1">Panduan / Deskripsi Target Bawaan</label>
                                <textarea rows="2" value={formData.defaultDetail} onChange={e => setFormData({ ...formData, defaultDetail: e.target.value })} className="w-full p-2.5 border rounded-xl font-medium" required></textarea>
                            </div>

                            <div>
                                <label className="block font-bold text-gray-600 mb-1">Label Jam Form Siswa</label>
                                <input type="text" value={formData.timeLabel} onChange={e => setFormData({ ...formData, timeLabel: e.target.value })} className="w-full p-2.5 border rounded-xl font-medium" />
                            </div>

                            <div>
                                <label className="block font-bold text-gray-600 mb-1">Label Catatan Form Siswa</label>
                                <input type="text" value={formData.detailLabel} onChange={e => setFormData({ ...formData, detailLabel: e.target.value })} className="w-full p-2.5 border rounded-xl font-medium" />
                            </div>

                            <div>
                                <label className="block font-bold text-gray-600 mb-1">Contoh Isian (Placeholder Form Siswa)</label>
                                <input type="text" value={formData.detailPlaceholder} onChange={e => setFormData({ ...formData, detailPlaceholder: e.target.value })} className="w-full p-2.5 border rounded-xl font-medium" />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <Button variant="white" onClick={() => setIsModalOpen(false)}>Batal</Button>
                                <Button variant="primary" type="submit">Simpan Perubahan</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};
