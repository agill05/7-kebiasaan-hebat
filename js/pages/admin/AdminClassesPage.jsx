var AdminClassesPage = ({ triggerSync, triggerManualPull }) => {
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [className, setClassName] = useState('');
    const [teacherId, setTeacherId] = useState('');

    const loadData = async () => {
        const c = await db.classes.toArray();
        const t = await db.users.where('role').equals(ROLES.GURU).toArray();
        setClasses(c); setTeachers(t);
    };

    useEffect(() => { loadData(); }, []);

    const filteredClasses = useMemo(() => {
        return classes.filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.teacherName && c.teacherName.toLowerCase().includes(searchQuery.toLowerCase())));
    }, [classes, searchQuery]);

    const handleSave = async (e) => {
        e.preventDefault();
        const targetClassName = className.trim();
        const currentId = editingClass ? editingClass.id : null;
        const allClasses = await db.classes.toArray();

        if (allClasses.some(c => c.id !== currentId && c.name.toLowerCase() === targetClassName.toLowerCase())) {
            return showAlert.warning('Peringatan', `Kelas "${targetClassName}" sudah terdaftar.`);
        }

        const selectedTeacher = teachers.find(t => t.id === teacherId);

        if (editingClass) {
            const updated = { ...editingClass, name: targetClassName, teacherId: teacherId || '', teacherName: selectedTeacher ? selectedTeacher.name : '' };
            await db.classes.put(updated);
            await db.syncQueue.put({ id: `sync_c_${Date.now()}`, tableName: 'classes', recordId: editingClass.id, action: 'update', status: 'pending', createdAt: new Date() });
        } else {
            const newId = `c_${Date.now()}`;
            const created = { id: newId, name: targetClassName, teacherId: teacherId || '', teacherName: selectedTeacher ? selectedTeacher.name : '' };
            await db.classes.put(created);
            await db.syncQueue.put({ id: `sync_c_${Date.now()}`, tableName: 'classes', recordId: newId, action: 'create', status: 'pending', createdAt: new Date() });
        }

        setIsModalOpen(false);
        await loadData();
        triggerSync();
        showAlert.success('Berhasil', 'Data kelas berhasil disimpan.');
    };

    const handleDelete = async (id) => {
        const confirmRes = await showAlert.confirm('Hapus Kelas Ini?', 'Data kelas akan dihapus secara permanen.');
        if (confirmRes.isConfirmed) {
            await db.classes.delete(id);
            await db.syncQueue.put({ id: `sync_cdel_${Date.now()}`, tableName: 'classes', recordId: id, action: 'delete', status: 'pending', createdAt: new Date() });
            await loadData();
            triggerSync();
            showAlert.success('Terhapus', 'Data kelas berhasil dihapus.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-brand-dark">Kelola Data Kelas</h1>
                    <p className="text-gray-500 font-medium text-sm">Kelola rombel dan penugasan wali kelas.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="white" onClick={triggerManualPull} className="text-xs py-2 px-3"><i className="fas fa-sync-alt mr-1"></i> Tarik Cloud</Button>
                    <Button variant="primary" onClick={() => { setEditingClass(null); setClassName(''); setTeacherId(''); setIsModalOpen(true); }} className="text-sm py-2 px-4">+ Tambah Kelas</Button>
                </div>
            </div>

            <Card className="space-y-4">
                <div className="relative w-full md:w-80">
                    <i className="fas fa-search absolute left-3.5 top-3 text-gray-400 text-xs"></i>
                    <input type="text" placeholder="Cari nama kelas atau wali kelas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold" />
                </div>

                {filteredClasses.length === 0 ? (
                    <EmptyState icon="🏫" title="Belum Ada Kelas" description="Tambahkan rombel pertama atau sesuaikan pencarian." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 text-gray-500 font-bold">
                                <tr><th className="p-3">Nama Kelas</th><th className="p-3">Wali Kelas</th><th className="p-3 text-right">Aksi</th></tr>
                            </thead>
                            <tbody>
                                {filteredClasses.map(c => (
                                    <tr key={c.id} className="border-b border-gray-50">
                                        <td className="p-3 font-semibold">{c.name}</td>
                                        <td className="p-3 text-brand-blue font-bold">{c.teacherName || '-'}</td>
                                        <td className="p-3 text-right space-x-2">
                                            <button onClick={() => { setEditingClass(c); setClassName(c.name || ''); setTeacherId(c.teacherId || ''); setIsModalOpen(true); }} className="text-brand-blue hover:underline font-bold text-xs"><i className="fas fa-edit"></i> Edit</button>
                                            <button onClick={() => handleDelete(c.id)} className="text-brand-red hover:underline font-bold text-xs"><i className="fas fa-trash"></i> Hapus</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm">
                        <h3 className="font-black text-lg mb-4">{editingClass ? 'Edit Kelas' : 'Tambah Kelas Baru'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <input type="text" placeholder="Nama Kelas (Contoh: VII.1)" value={className} onChange={e => setClassName(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm" required />
                            <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm font-semibold">
                                <option value="">-- Pilih Wali Kelas --</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.subject || 'Guru'})</option>)}
                            </select>
                            <div className="flex justify-end gap-2">
                                <Button variant="white" onClick={() => setIsModalOpen(false)}>Batal</Button>
                                <Button variant="primary" type="submit">Simpan</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};
