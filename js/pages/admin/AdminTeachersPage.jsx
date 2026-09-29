var AdminTeachersPage = ({ triggerSync, triggerManualPull }) => {
    const [teachers, setTeachers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [formData, setFormData] = useState({ name: '', username: '', password: '', phone: '', nip: '', subject: '', homeroomClassId: '' });
    const fileInputRef = useRef(null);

    const loadData = async () => {
        const t = await db.users.where('role').equals(ROLES.GURU).toArray();
        setTeachers(t);
    };

    useEffect(() => { loadData(); }, []);

    const filteredTeachers = useMemo(() => {
        return teachers.filter(t => !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.username.toLowerCase().includes(searchQuery.toLowerCase()) || (t.nip && t.nip.includes(searchQuery)));
    }, [teachers, searchQuery]);

    const isAllVisibleSelected = filteredTeachers.length > 0 && filteredTeachers.every(t => selectedTeacherIds.includes(t.id));

    const toggleSelectAll = () => {
        if (isAllVisibleSelected) {
            const visibleIds = new Set(filteredTeachers.map(t => t.id));
            setSelectedTeacherIds(prev => prev.filter(id => !visibleIds.has(id)));
        } else {
            const newIds = new Set([...selectedTeacherIds, ...filteredTeachers.map(t => t.id)]);
            setSelectedTeacherIds(Array.from(newIds));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedTeacherIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const handleBulkResetPassword = async () => {
        if (selectedTeacherIds.length === 0) return;
        const { value: passResult } = await Swal.fire({
            title: `Reset Sandi Massal`,
            html: `
                <div class="text-left text-xs space-y-3 pt-2 text-gray-700">
                    <p>Mereset kata sandi untuk <b>${selectedTeacherIds.length} Guru</b> terpilih:</p>
                    <div>
                        <label class="block font-bold text-gray-600 mb-1">Pilihan Sandi Baru:</label>
                        <select id="swal-bulk-pass-type" class="w-full p-2.5 bg-gray-50 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-red">
                            <option value="default">Reset ke Sandi Standar ("guru123")</option>
                            <option value="custom">Tentukan Sandi Seragam Baru</option>
                        </select>
                    </div>
                    <div id="swal-bulk-custom-container" style="display:none;">
                        <label class="block font-bold text-gray-600 mb-1">Ketik Sandi Baru:</label>
                        <input id="swal-bulk-custom-pass" type="text" placeholder="Minimal 4 karakter" class="w-full p-2.5 bg-gray-50 border rounded-xl text-xs font-bold text-brand-red focus:ring-2 focus:ring-brand-red" />
                    </div>
                </div>
            `,
            didOpen: () => {
                const typeEl = document.getElementById('swal-bulk-pass-type');
                const customBox = document.getElementById('swal-bulk-custom-container');
                const customInput = document.getElementById('swal-bulk-custom-pass');
                typeEl.addEventListener('change', (e) => {
                    if (e.target.value === 'custom') {
                        customBox.style.display = 'block';
                        customInput.focus();
                    } else {
                        customBox.style.display = 'none';
                    }
                });
            },
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#6B7280',
            confirmButtonText: '🔑 Terapkan Reset Massal',
            cancelButtonText: 'Batal',
            customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5', cancelButton: 'rounded-xl font-bold px-5 py-2.5' },
            preConfirm: () => {
                const type = document.getElementById('swal-bulk-pass-type').value;
                const customVal = document.getElementById('swal-bulk-custom-pass').value.trim();
                if (type === 'custom') {
                    if (!customVal || customVal.length < 4) {
                        Swal.showValidationMessage('Kata sandi baru minimal 4 karakter!');
                        return false;
                    }
                    return customVal;
                }
                return 'guru123';
            }
        });

        if (passResult) {
            const hashed = await hashPassword(passResult);
            const selectedUsers = await db.users.where('id').anyOf(selectedTeacherIds).toArray();
            const updatedUsers = selectedUsers.map(u => ({ ...u, password: hashed, updatedAt: new Date() }));

            await db.users.bulkPut(updatedUsers);

            for (let u of updatedUsers) {
                await db.syncQueue.put({
                    id: `sync_reset_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    tableName: 'users',
                    recordId: u.id,
                    action: 'update',
                    status: 'pending',
                    createdAt: new Date()
                });
            }

            await loadData();
            triggerSync();
            setSelectedTeacherIds([]);
            showAlert.success('Reset Berhasil', `Kata sandi ${updatedUsers.length} guru berhasil diubah menjadi: "${passResult}"`);
        }
    };

    const handleBulkDeleteTeachers = async () => {
        if (selectedTeacherIds.length === 0) return;
        const confirmRes = await showAlert.confirm(
            `Hapus ${selectedTeacherIds.length} Guru Sekaligus?`,
            'Akun guru terpilih akan dihapus permanen. Seluruh penugasan wali kelas dan mentoring terkait akan dikosongkan.',
            'Ya, Hapus Semua Terpilih'
        );
        if (!confirmRes.isConfirmed) return;

        const assignedClasses = await db.classes.where('teacherId').anyOf(selectedTeacherIds).toArray();
        for (let c of assignedClasses) {
            await db.classes.update(c.id, { teacherId: '', teacherName: '' });
            await db.syncQueue.put({ id: `sync_c_${Date.now()}_${Math.random()}`, tableName: 'classes', recordId: c.id, action: 'update', status: 'pending', createdAt: new Date() });
        }

        const assignedStudents = await db.users.where('mentorId').anyOf(selectedTeacherIds).toArray();
        for (let s of assignedStudents) {
            await db.users.update(s.id, { mentorId: '', mentorName: '' });
            await db.syncQueue.put({ id: `sync_s_${Date.now()}_${Math.random()}`, tableName: 'users', recordId: s.id, action: 'update', status: 'pending', createdAt: new Date() });
        }

        await db.users.bulkDelete(selectedTeacherIds);
        for (let id of selectedTeacherIds) {
            await db.syncQueue.put({ id: `sync_tdel_${Date.now()}_${Math.random()}`, tableName: 'users', recordId: id, action: 'delete', status: 'pending', createdAt: new Date() });
        }

        await loadData();
        triggerSync();
        const deletedCount = selectedTeacherIds.length;
        setSelectedTeacherIds([]);
        showAlert.success('Terhapus', `${deletedCount} akun guru berhasil dihapus.`);
    };

    const handleDownloadTeacherTemplate = () => {
        const headers = [['Nama Lengkap', 'Username', 'Password', 'NIP', 'Nomor Telepon', 'Mata Pelajaran']];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 22 }, { wch: 18 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template_Guru");
        XLSX.writeFile(wb, "Template_Import_Guru.xlsx");
        showAlert.success("Template Diunduh", "Silakan isi data guru mulai dari baris ke-2.");
    };

    const handleShowTeacherGuide = () => {
        Swal.fire({
            title: 'Panduan Import Excel Guru',
            html: `
                <div class="text-left text-xs space-y-2.5 text-gray-700 pt-1 leading-relaxed">
                    <p><b>Ketentuan Pengisian Kolom:</b></p>
                    <ul class="list-disc pl-4 space-y-1">
                        <li><b>Nama Lengkap</b>: Wajib diisi (Contoh: <i>Ahmad Fauzi, S.Pd.</i>).</li>
                        <li><b>Username</b>: Wajib diisi, unik, huruf kecil tanpa spasi (Contoh: <i>ahmad.fauzi</i>).</li>
                        <li><b>Password</b>: Opsional (Jika kosong, otomatis diset <code>guru123</code>).</li>
                        <li><b>NIP</b>: Opsional (Nomor NIP / NIK guru).</li>
                        <li><b>Nomor Telepon</b>: Opsional (Nomor WhatsApp aktif).</li>
                        <li><b>Mata Pelajaran</b>: Opsional (Contoh: <i>Informatika</i>, <i>Matematika</i>).</li>
                    </ul>
                </div>
            `,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'Saya Mengerti',
            customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5' }
        });
    };

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

                if (data.length === 0) return showAlert.warning('File Kosong', 'Tidak ada baris data pada berkas Excel.');

                const existingUsers = await db.users.toArray();
                const existingUserMap = new Map(existingUsers.map(u => [(u.username || '').toLowerCase(), u]));

                const teachersToSave = [];
                const seenBatchUsernames = new Set();
                let addedCount = 0;
                let updatedCount = 0;
                let skippedCount = 0;

                for (let row of data) {
                    const name = String(row['Nama Lengkap'] || row['Nama'] || '').trim();
                    const rawUsername = String(row['Username'] || '').trim().toLowerCase();

                    if (!name || !rawUsername) {
                        skippedCount++;
                        continue;
                    }

                    if (seenBatchUsernames.has(rawUsername)) {
                        skippedCount++;
                        continue;
                    }
                    seenBatchUsernames.add(rawUsername);

                    const existingUser = existingUserMap.get(rawUsername);
                    const rawPass = String(row['Password'] || '').trim();

                    if (existingUser) {
                        let hashedPassword = existingUser.password;
                        if (rawPass) {
                            hashedPassword = await hashPassword(rawPass);
                        }

                        const teacherObj = {
                            ...existingUser,
                            name,
                            phone: String(row['Nomor Telepon'] || row['Telepon'] || existingUser.phone || '').trim(),
                            nip: String(row['NIP'] || existingUser.nip || '').trim(),
                            subject: String(row['Mata Pelajaran'] || row['Mapel'] || existingUser.subject || 'Umum').trim(),
                            password: hashedPassword,
                            updatedAt: new Date()
                        };

                        teachersToSave.push(teacherObj);
                        updatedCount++;
                        await db.syncQueue.put({
                            id: `sync_t_upd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                            tableName: 'users',
                            recordId: existingUser.id,
                            action: 'update',
                            status: 'pending',
                            createdAt: new Date()
                        });
                    } else {
                        const defaultPass = rawPass || 'guru123';
                        const hashedPassword = await hashPassword(defaultPass);
                        const id = `u_guru_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

                        const teacherObj = {
                            id,
                            username: rawUsername,
                            password: hashedPassword,
                            name,
                            phone: String(row['Nomor Telepon'] || row['Telepon'] || '').trim(),
                            nip: String(row['NIP'] || '').trim(),
                            subject: String(row['Mata Pelajaran'] || row['Mapel'] || 'Umum').trim(),
                            homeroomClassId: '',
                            role: ROLES.GURU,
                            avatar: '👨‍🏫',
                            status: 'Aktif',
                            createdAt: new Date()
                        };

                        teachersToSave.push(teacherObj);
                        addedCount++;
                        await db.syncQueue.put({
                            id: `sync_t_add_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                            tableName: 'users',
                            recordId: id,
                            action: 'create',
                            status: 'pending',
                            createdAt: new Date()
                        });
                    }
                }

                if (teachersToSave.length > 0) {
                    await db.users.bulkPut(teachersToSave);
                    await loadData();
                    triggerSync();
                    showAlert.success(
                        'Import Berhasil!',
                        `${addedCount} guru baru ditambahkan, ${updatedCount} data guru diperbarui.${skippedCount > 0 ? ` (${skippedCount} baris tidak valid/duplikat dilewati)` : ''}`
                    );
                } else {
                    showAlert.warning('Tidak Ada Data Diproses', 'Semua baris kosong atau format tidak sesuai.');
                }
            } catch (err) {
                showAlert.error('Gagal Membaca Excel', err.message);
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = null;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const targetName = formData.name.trim();
        const targetUsername = formData.username.trim();
        const currentId = editingTeacher ? editingTeacher.id : null;
        const allUsers = await db.users.toArray();

        if (allUsers.some(u => u.id !== currentId && u.username.toLowerCase() === targetUsername.toLowerCase())) {
            return showAlert.warning('Peringatan', `Username "@${targetUsername}" sudah digunakan.`);
        }

        if (editingTeacher) {
            const updated = { ...editingTeacher, name: targetName, username: targetUsername, phone: formData.phone.trim(), nip: formData.nip.trim(), subject: formData.subject.trim(), updatedAt: new Date() };
            await db.users.put(updated);
            await db.syncQueue.put({ id: `sync_t_${Date.now()}`, tableName: 'users', recordId: editingTeacher.id, action: 'update', status: 'pending', createdAt: new Date() });
        } else {
            const newId = `u_guru_${Date.now()}`;
            const defaultPass = formData.password.trim() || 'guru123';
            const hashedPassword = await hashPassword(defaultPass);
            const created = { id: newId, username: targetUsername, password: hashedPassword, phone: formData.phone.trim(), name: targetName, nip: formData.nip.trim(), subject: formData.subject.trim(), homeroomClassId: '', role: ROLES.GURU, avatar: '👨‍🏫', status: 'Aktif', createdAt: new Date() };
            await db.users.put(created);
            await db.syncQueue.put({ id: `sync_t_${Date.now()}`, tableName: 'users', recordId: newId, action: 'create', status: 'pending', createdAt: new Date() });
        }

        setIsModalOpen(false);
        await loadData();
        triggerSync();
        showAlert.success('Berhasil', 'Data guru berhasil disimpan.');
    };

    const handleDeleteTeacher = async (teacher) => {
        const confirmRes = await showAlert.confirm(
            `Hapus Guru ${teacher.name}?`,
            'Akun guru ini akan dihapus permanen dari sistem dan penugasan wali kelas terkait akan dikosongkan.',
            'Ya, Hapus Guru'
        );
        if (!confirmRes.isConfirmed) return;

        const assignedClasses = await db.classes.where('teacherId').equals(teacher.id).toArray();
        for (let c of assignedClasses) {
            await db.classes.update(c.id, { teacherId: '', teacherName: '' });
            await db.syncQueue.put({ id: `sync_c_${Date.now()}_${Math.random()}`, tableName: 'classes', recordId: c.id, action: 'update', status: 'pending', createdAt: new Date() });
        }

        const assignedStudents = await db.users.where('mentorId').equals(teacher.id).toArray();
        for (let s of assignedStudents) {
            await db.users.update(s.id, { mentorId: '', mentorName: '' });
            await db.syncQueue.put({ id: `sync_s_${Date.now()}_${Math.random()}`, tableName: 'users', recordId: s.id, action: 'update', status: 'pending', createdAt: new Date() });
        }

        await db.users.delete(teacher.id);
        await db.syncQueue.put({ id: `sync_tdel_${Date.now()}`, tableName: 'users', recordId: teacher.id, action: 'delete', status: 'pending', createdAt: new Date() });

        await loadData();
        triggerSync();
        showAlert.success('Terhapus', 'Data guru berhasil dihapus.');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-brand-dark">Kelola Data Guru</h1>
                    <p className="text-gray-500 font-medium text-sm">Pendaftaran, template & import massal Excel, multi-select, reset password, dan master kontrol guru.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <input type="file" ref={fileInputRef} onChange={handleExcelUpload} accept=".xlsx, .xls, .csv" className="hidden" />
                    <Button variant="white" onClick={handleDownloadTeacherTemplate} className="text-xs py-2 px-3 text-brand-dark font-bold"><i className="fas fa-download mr-1 text-brand-blue"></i> Unduh Template</Button>
                    <Button variant="white" onClick={handleShowTeacherGuide} className="text-xs py-2 px-3 text-gray-600"><i className="fas fa-info-circle mr-1 text-amber-500"></i> Panduan Format</Button>
                    <Button variant="green" onClick={() => fileInputRef.current?.click()} className="text-xs py-2 px-3"><i className="fas fa-file-excel mr-1"></i> Import Excel</Button>
                    <Button variant="white" onClick={triggerManualPull} className="text-xs py-2 px-3"><i className="fas fa-sync-alt mr-1"></i> Tarik Cloud</Button>
                    <Button variant="primary" onClick={() => { setEditingTeacher(null); setFormData({ name: '', username: '', password: '', phone: '', nip: '', subject: '' }); setIsModalOpen(true); }} className="text-sm py-2 px-4">+ Tambah Guru</Button>
                </div>
            </div>

            {selectedTeacherIds.length > 0 && (
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-3 md:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center font-black text-xs">{selectedTeacherIds.length}</span>
                        <div>
                            <h4 className="font-extrabold text-sm">{selectedTeacherIds.length} Guru Dipilih</h4>
                            <p className="text-[11px] text-gray-300">Aksi akan diterapkan pada semua akun guru yang dicentang.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={handleBulkResetPassword} className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5">
                            <i className="fas fa-key"></i> Reset Sandi Terpilih
                        </button>
                        <button onClick={handleBulkDeleteTeachers} className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5">
                            <i className="fas fa-trash"></i> Hapus Terpilih
                        </button>
                        <button onClick={() => setSelectedTeacherIds([])} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs font-bold rounded-xl transition-all">
                            Batal
                        </button>
                    </div>
                </div>
            )}

            <Card className="space-y-4">
                <div className="relative w-full md:w-80">
                    <i className="fas fa-search absolute left-3.5 top-3 text-gray-400 text-xs"></i>
                    <input type="text" placeholder="Cari nama guru, NIP, atau username..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold" />
                </div>

                {filteredTeachers.length === 0 ? (
                    <EmptyState icon="👨‍🏫" title="Belum Ada Guru" description="Tambahkan data guru pengajar atau unduh template lalu unggah berkas Excel." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 text-gray-500 font-bold">
                                <tr>
                                    <th className="p-3 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={isAllVisibleSelected}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 text-brand-red rounded border-gray-300 focus:ring-brand-red cursor-pointer"
                                        />
                                    </th>
                                    <th className="p-3">Nama Guru</th>
                                    <th className="p-3">Username</th>
                                    <th className="p-3">No. Telepon</th>
                                    <th className="p-3">Mata Pelajaran</th>
                                    <th className="p-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTeachers.map(t => {
                                    const isSelected = selectedTeacherIds.includes(t.id);
                                    return (
                                        <tr key={t.id} className={`border-b border-gray-50 transition-colors ${isSelected ? 'bg-red-50/60' : 'hover:bg-gray-50/50'}`}>
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectOne(t.id)}
                                                    className="w-4 h-4 text-brand-red rounded border-gray-300 focus:ring-brand-red cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-3 font-semibold">{t.name}</td>
                                            <td className="p-3 text-gray-500">@{t.username}</td>
                                            <td className="p-3 text-gray-600 font-bold">{t.phone || '-'}</td>
                                            <td className="p-3 font-bold text-brand-blue">{t.subject || 'Umum'}</td>
                                            <td className="p-3 text-right space-x-2">
                                                <button onClick={async () => {
                                                    const success = await promptResetPassword(t, 'guru123');
                                                    if (success) {
                                                        await loadData();
                                                        triggerSync();
                                                    }
                                                }} className="text-amber-600 hover:underline font-bold text-xs" title="Reset Kata Sandi Guru">
                                                    <i className="fas fa-key"></i> Reset Pass
                                                </button>
                                                <button onClick={() => { setEditingTeacher(t); setFormData({ name: t.name, username: t.username, password: '', phone: t.phone, nip: t.nip, subject: t.subject }); setIsModalOpen(true); }} className="text-brand-blue hover:underline font-bold text-xs"><i className="fas fa-edit"></i> Edit</button>
                                                <button onClick={() => handleDeleteTeacher(t)} className="text-brand-red hover:underline font-bold text-xs"><i className="fas fa-trash"></i> Hapus</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md">
                        <h3 className="font-black text-lg mb-4">{editingTeacher ? 'Edit Data Guru' : 'Tambah Guru Baru'}</h3>
                        <form onSubmit={handleSave} className="space-y-3">
                            <input type="text" placeholder="Nama Lengkap" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm" required />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="Username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm" required />
                                <input type="text" placeholder="Telepon" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm" />
                            </div>
                            <input type="text" placeholder="NIP / NIK" value={formData.nip} onChange={e => setFormData({ ...formData, nip: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm" />
                            <input type="text" placeholder="Mata Pelajaran" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm" />
                            <div className="flex justify-end gap-2 pt-2">
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
