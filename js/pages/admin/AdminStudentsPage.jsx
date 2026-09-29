var AdminStudentsPage = ({ triggerSync, triggerManualPull }) => {
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClassId, setFilterClassId] = useState('all');
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [formData, setFormData] = useState({ name: '', username: '', password: '', nisn: '', classId: '', mentorId: '', gender: 'Laki-laki' });
    const fileInputRef = useRef(null);

    const loadData = async () => {
        const s = await db.users.where('role').equals(ROLES.SISWA).toArray();
        const c = await db.classes.toArray();
        const t = await db.users.where('role').equals(ROLES.GURU).toArray();
        setStudents(s); setClasses(c); setTeachers(t);
    };

    useEffect(() => { loadData(); }, []);

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const matchesClass = filterClassId === 'all' || s.classId === filterClassId;
            const query = searchQuery.toLowerCase().trim();
            const matchesSearch = !query || s.name.toLowerCase().includes(query) || s.username.toLowerCase().includes(query) || (s.nisn && s.nisn.includes(query));
            return matchesClass && matchesSearch;
        });
    }, [students, searchQuery, filterClassId]);

    const isAllVisibleSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id));

    const toggleSelectAll = () => {
        if (isAllVisibleSelected) {
            const visibleIds = new Set(filteredStudents.map(s => s.id));
            setSelectedStudentIds(prev => prev.filter(id => !visibleIds.has(id)));
        } else {
            const newIds = new Set([...selectedStudentIds, ...filteredStudents.map(s => s.id)]);
            setSelectedStudentIds(Array.from(newIds));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const handleBulkResetPassword = async () => {
        if (selectedStudentIds.length === 0) return;
        const { value: passResult } = await Swal.fire({
            title: `Reset Sandi Massal`,
            html: `
                <div class="text-left text-xs space-y-3 pt-2 text-gray-700">
                    <p>Mereset kata sandi untuk <b>${selectedStudentIds.length} Siswa</b> terpilih:</p>
                    <div>
                        <label class="block font-bold text-gray-600 mb-1">Pilihan Sandi Baru:</label>
                        <select id="swal-bulk-pass-type" class="w-full p-2.5 bg-gray-50 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-red">
                            <option value="default">Reset ke Sandi Standar ("siswa123")</option>
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
                return 'siswa123';
            }
        });

        if (passResult) {
            const hashed = await hashPassword(passResult);
            const selectedUsers = await db.users.where('id').anyOf(selectedStudentIds).toArray();
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
            setSelectedStudentIds([]);
            showAlert.success('Reset Berhasil', `Kata sandi ${updatedUsers.length} siswa berhasil diubah menjadi: "${passResult}"`);
        }
    };

    const handleBulkMoveClass = async () => {
        if (selectedStudentIds.length === 0) return;
        if (classes.length === 0) return showAlert.warning('Perhatian', 'Belum ada data kelas yang terdaftar.');

        const classOptionsHtml = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        const { value: targetClassId } = await Swal.fire({
            title: 'Pindah Kelas Massal',
            html: `
                <div class="text-left text-xs space-y-2 pt-2 text-gray-700">
                    <p>Pindahkan <b>${selectedStudentIds.length} Siswa</b> terpilih ke rombel baru:</p>
                    <select id="swal-target-class" class="w-full p-2.5 bg-gray-50 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-red">
                        ${classOptionsHtml}
                    </select>
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#6B7280',
            confirmButtonText: '🏫 Terapkan Perpindahan',
            cancelButtonText: 'Batal',
            customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5', cancelButton: 'rounded-xl font-bold px-5 py-2.5' },
            preConfirm: () => document.getElementById('swal-target-class').value
        });

        if (targetClassId) {
            const targetClass = classes.find(c => c.id === targetClassId);
            const selectedUsers = await db.users.where('id').anyOf(selectedStudentIds).toArray();
            const updatedUsers = selectedUsers.map(u => ({ ...u, classId: targetClass.id, className: targetClass.name, updatedAt: new Date() }));

            await db.users.bulkPut(updatedUsers);

            for (let u of updatedUsers) {
                await db.syncQueue.put({
                    id: `sync_c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    tableName: 'users',
                    recordId: u.id,
                    action: 'update',
                    status: 'pending',
                    createdAt: new Date()
                });
            }

            await loadData();
            triggerSync();
            setSelectedStudentIds([]);
            showAlert.success('Perpindahan Selesai', `${updatedUsers.length} siswa berhasil dipindahkan ke rombel "${targetClass.name}".`);
        }
    };

    const handleBulkDeleteStudents = async () => {
        if (selectedStudentIds.length === 0) return;
        const confirmRes = await showAlert.confirm(
            `Hapus ${selectedStudentIds.length} Siswa Sekaligus?`,
            'Seluruh akun siswa terpilih beserta data pembiasaan (habit logs), jurnal, dan poin karakter akan dihapus permanen.',
            'Ya, Hapus Semua Terpilih'
        );
        if (!confirmRes.isConfirmed) return;

        const studentLogs = await db.habitLogs.where('userId').anyOf(selectedStudentIds).toArray();
        for (let l of studentLogs) {
            await db.habitLogs.delete(l.id);
            await db.syncQueue.put({ id: `sync_hdel_${Date.now()}_${Math.random()}`, tableName: 'habitLogs', recordId: l.id, action: 'delete', status: 'pending', createdAt: new Date() });
        }

        const studentJournals = await db.journals.where('userId').anyOf(selectedStudentIds).toArray();
        for (let j of studentJournals) {
            await db.journals.delete(j.id);
            await db.syncQueue.put({ id: `sync_jdel_${Date.now()}_${Math.random()}`, tableName: 'journals', recordId: j.id, action: 'delete', status: 'pending', createdAt: new Date() });
        }

        await db.points.where('userId').anyOf(selectedStudentIds).delete();
        await db.streaks.where('userId').anyOf(selectedStudentIds).delete();

        await db.users.bulkDelete(selectedStudentIds);
        for (let id of selectedStudentIds) {
            await db.syncQueue.put({ id: `sync_sdel_${Date.now()}`, tableName: 'users', recordId: id, action: 'delete', status: 'pending', createdAt: new Date() });
        }

        await loadData();
        triggerSync();
        const deletedCount = selectedStudentIds.length;
        setSelectedStudentIds([]);
        showAlert.success('Terhapus', `${deletedCount} akun siswa beserta seluruh rekam jejaknya berhasil dibersihkan.`);
    };

    const handleDownloadStudentTemplate = () => {
        const headers = [['Nama Lengkap', 'Username', 'Password', 'NISN', 'Kelas', 'Jenis Kelamin']];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        ws['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 15 }, { wch: 16 }, { wch: 12 }, { wch: 15 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template_Siswa");

        if (classes.length > 0) {
            const classRefData = [['Nama Kelas', 'Wali Kelas Terdaftar']];
            classes.forEach(c => classRefData.push([c.name, c.teacherName || '-']));
            const wsRef = XLSX.utils.aoa_to_sheet(classRefData);
            wsRef['!cols'] = [{ wch: 15 }, { wch: 25 }];
            XLSX.utils.book_append_sheet(wb, wsRef, "Referensi_Kelas");
        }

        XLSX.writeFile(wb, "Template_Import_Siswa.xlsx");
        showAlert.success("Template Diunduh", "Silakan isi data siswa pada sheet 'Template_Siswa' mulai dari baris ke-2.");
    };

    const handleShowStudentGuide = () => {
        const classListText = classes.map(c => c.name).join(', ') || 'Belum ada kelas terdaftar';
        Swal.fire({
            title: 'Panduan Import Excel Siswa',
            html: `
                <div class="text-left text-xs space-y-2.5 text-gray-700 pt-1 leading-relaxed">
                    <p><b>Ketentuan Pengisian Kolom:</b></p>
                    <ul class="list-disc pl-4 space-y-1">
                        <li><b>Nama Lengkap</b>: Wajib diisi (Contoh: <i>Muhammad Rizky</i>).</li>
                        <li><b>Username</b>: Wajib diisi, unik, huruf kecil tanpa spasi (Contoh: <i>rizky.pratama</i>).</li>
                        <li><b>Password</b>: Opsional (Jika kosong, otomatis diset <code>siswa123</code>).</li>
                        <li><b>NISN</b>: Opsional (10 digit angka).</li>
                        <li><b>Kelas</b>: Wajib diisi persis sesuai nama rombel aktif:<br><span class="font-black text-brand-red">${classListText}</span>.</li>
                        <li><b>Jenis Kelamin</b>: Diisi <i>Laki-laki</i> atau <i>Perempuan</i>.</li>
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

                if (data.length === 0) return showAlert.warning('File Kosong', 'Tidak ada baris data siswa pada berkas Excel.');

                const existingUsers = await db.users.toArray();
                const existingUserMap = new Map(existingUsers.map(u => [(u.username || '').toLowerCase(), u]));

                const studentsToSave = [];
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
                    const classNameVal = String(row['Kelas'] || '').trim();
                    const matchingClass = classes.find(c => c.name.toLowerCase() === classNameVal.toLowerCase());
                    const genderVal = String(row['Jenis Kelamin'] || row['Gender'] || '').trim();

                    if (existingUser) {
                        let hashedPassword = existingUser.password;
                        if (rawPass) {
                            hashedPassword = await hashPassword(rawPass);
                        }

                        const finalGender = genderVal || existingUser.gender || 'Laki-laki';

                        const stdObj = {
                            ...existingUser,
                            name,
                            nisn: String(row['NISN'] || existingUser.nisn || '').trim(),
                            classId: matchingClass ? matchingClass.id : existingUser.classId,
                            className: matchingClass ? matchingClass.name : (classNameVal || existingUser.className),
                            gender: finalGender,
                            avatar: finalGender.toLowerCase().includes('perempuan') ? '👧' : '👦',
                            password: hashedPassword,
                            updatedAt: new Date()
                        };

                        studentsToSave.push(stdObj);
                        updatedCount++;
                        await db.syncQueue.put({
                            id: `sync_s_upd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                            tableName: 'users',
                            recordId: existingUser.id,
                            action: 'update',
                            status: 'pending',
                            createdAt: new Date()
                        });
                    } else {
                        const defaultPass = rawPass || 'siswa123';
                        const hashedPassword = await hashPassword(defaultPass);
                        const id = `u_siswa_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
                        const finalGender = genderVal || 'Laki-laki';

                        const stdObj = {
                            id,
                            username: rawUsername,
                            password: hashedPassword,
                            name,
                            nisn: String(row['NISN'] || '').trim(),
                            classId: matchingClass ? matchingClass.id : '',
                            className: matchingClass ? matchingClass.name : classNameVal,
                            mentorId: '',
                            mentorName: '',
                            gender: finalGender,
                            role: ROLES.SISWA,
                            avatar: finalGender.toLowerCase().includes('perempuan') ? '👧' : '👦',
                            createdBy: 'admin',
                            status: 'Aktif',
                            createdAt: new Date()
                        };

                        studentsToSave.push(stdObj);
                        addedCount++;
                        await db.syncQueue.put({
                            id: `sync_s_add_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                            tableName: 'users',
                            recordId: id,
                            action: 'create',
                            status: 'pending',
                            createdAt: new Date()
                        });
                    }
                }

                if (studentsToSave.length > 0) {
                    await db.users.bulkPut(studentsToSave);
                    await loadData();
                    triggerSync();
                    showAlert.success(
                        'Import Berhasil!',
                        `${addedCount} siswa baru ditambahkan, ${updatedCount} data siswa diperbarui.${skippedCount > 0 ? ` (${skippedCount} baris tidak valid/duplikat dilewati)` : ''}`
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

    const handlePrintAccountCards = () => {
        if (students.length === 0) return showAlert.warning('Data Kosong', 'Tidak ada siswa untuk dicetak kartu akun.');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait', 'pt', 'a4');
        const cardW = 250;
        const cardH = 130;
        const marginX = 40;
        const marginY = 40;
        let col = 0;
        let row = 0;

        students.forEach((s, idx) => {
            const x = marginX + (col * (cardW + 15));
            const y = marginY + (row * (cardH + 15));

            doc.setDrawColor(200, 200, 200);
            doc.setLineDashPattern([3, 3], 0);
            doc.roundedRect(x, y, cardW, cardH, 8, 8);

            doc.setFillColor(239, 68, 68);
            doc.roundedRect(x, y, cardW, 28, 8, 8, 'F');
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text("KARTU AKSES SISWA — 7 KEBIASAAN", x + (cardW / 2), y + 18, { align: 'center' });

            doc.setTextColor(0, 0, 0);
            doc.setFontSize(8.5);
            doc.text(`Nama     : ${s.name}`, x + 12, y + 48);
            doc.text(`Kelas     : ${s.className || '-'}`, x + 12, y + 63);
            doc.text(`NISN     : ${s.nisn || '-'}`, x + 12, y + 78);
            doc.setFont('helvetica', 'bold');
            doc.text(`User ID  : @${s.username}`, x + 12, y + 96);
            doc.text(`Pass       : siswa123 (Default)`, x + 12, y + 111);

            col++;
            if (col >= 2) {
                col = 0;
                row++;
                if (row >= 5 && idx < students.length - 1) {
                    doc.addPage();
                    row = 0;
                }
            }
        });

        doc.save(`Kartu_Akun_Siswa_${SCHOOL_IDENTITY.name.replace(/\s+/g, '_')}.pdf`);
        showAlert.success('Berhasil Diunduh', 'Lembar kartu akun siswa siap dicetak.');
    };

    const handleDeleteStudent = async (student) => {
        const confirmRes = await showAlert.confirm(
            `Hapus Siswa ${student.name}?`,
            'Data akun siswa beserta seluruh catatan habit, jurnal, dan capaian poin akan dihapus permanen.',
            'Ya, Hapus Siswa'
        );
        if (!confirmRes.isConfirmed) return;

        const studentLogs = await db.habitLogs.where('userId').equals(student.id).toArray();
        for (let l of studentLogs) {
            await db.habitLogs.delete(l.id);
            await db.syncQueue.put({ id: `sync_hdel_${Date.now()}_${Math.random()}`, tableName: 'habitLogs', recordId: l.id, action: 'delete', status: 'pending', createdAt: new Date() });
        }

        const studentJournals = await db.journals.where('userId').equals(student.id).toArray();
        for (let j of studentJournals) {
            await db.journals.delete(j.id);
            await db.syncQueue.put({ id: `sync_jdel_${Date.now()}_${Math.random()}`, tableName: 'journals', recordId: j.id, action: 'delete', status: 'pending', createdAt: new Date() });
        }

        await db.points.where('userId').equals(student.id).delete();
        await db.streaks.where('userId').equals(student.id).delete();

        await db.users.delete(student.id);
        await db.syncQueue.put({ id: `sync_sdel_${Date.now()}`, tableName: 'users', recordId: student.id, action: 'delete', status: 'pending', createdAt: new Date() });

        await loadData();
        triggerSync();
        showAlert.success('Terhapus', 'Data siswa dan riwayat log berhasil dihapus.');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-brand-dark">Kelola Data Siswa</h1>
                    <p className="text-gray-500 font-medium text-sm">Pendaftaran, template & import massal Excel, multi-select, pindah kelas, reset sandi, dan master kontrol siswa.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <input type="file" ref={fileInputRef} onChange={handleExcelUpload} accept=".xlsx, .xls, .csv" className="hidden" />
                    <Button variant="white" onClick={handleDownloadStudentTemplate} className="text-xs py-2 px-3 text-brand-dark font-bold"><i className="fas fa-download mr-1 text-brand-blue"></i> Unduh Template</Button>
                    <Button variant="white" onClick={handleShowStudentGuide} className="text-xs py-2 px-3 text-gray-600"><i className="fas fa-info-circle mr-1 text-amber-500"></i> Panduan Format</Button>
                    <Button variant="green" onClick={() => fileInputRef.current?.click()} className="text-xs py-2 px-3"><i className="fas fa-file-excel mr-1"></i> Import Excel</Button>
                    <Button variant="amber" onClick={handlePrintAccountCards} className="text-xs py-2 px-3"><i className="fas fa-id-card mr-1"></i> Cetak Kartu Akun</Button>
                    <Button variant="white" onClick={triggerManualPull} className="text-xs py-2 px-3"><i className="fas fa-sync-alt mr-1"></i> Tarik Cloud</Button>
                    <Button variant="primary" onClick={() => { setEditingStudent(null); setFormData({ name: '', username: '', password: '', nisn: '', classId: classes[0]?.id || '', mentorId: '', gender: 'Laki-laki' }); setIsModalOpen(true); }} className="text-sm py-2 px-4">+ Tambah Siswa</Button>
                </div>
            </div>

            {selectedStudentIds.length > 0 && (
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-3 md:p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center font-black text-xs">{selectedStudentIds.length}</span>
                        <div>
                            <h4 className="font-extrabold text-sm">{selectedStudentIds.length} Siswa Dipilih</h4>
                            <p className="text-[11px] text-gray-300">Aksi akan diterapkan pada seluruh siswa yang Anda pilih.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={handleBulkMoveClass} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5">
                            <i className="fas fa-exchange-alt"></i> Pindah Rombel
                        </button>
                        <button onClick={handleBulkResetPassword} className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5">
                            <i className="fas fa-key"></i> Reset Sandi
                        </button>
                        <button onClick={handleBulkDeleteStudents} className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5">
                            <i className="fas fa-trash"></i> Hapus Terpilih
                        </button>
                        <button onClick={() => setSelectedStudentIds([])} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs font-bold rounded-xl transition-all">
                            Batal
                        </button>
                    </div>
                </div>
            )}

            <Card className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
                    <div className="relative w-full md:w-80">
                        <i className="fas fa-search absolute left-3.5 top-3 text-gray-400 text-xs"></i>
                        <input type="text" placeholder="Cari nama siswa, NISN, atau username..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold" />
                    </div>
                    <div className="w-full md:w-auto">
                        <select value={filterClassId} onChange={e => { setFilterClassId(e.target.value); setSelectedStudentIds([]); }} className="w-full md:w-auto p-2 bg-gray-50 border rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-brand-red">
                            <option value="all">-- Semua Rombel / Kelas ({students.length}) --</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>Kelas {c.name} ({students.filter(s => s.classId === c.id).length} Siswa)</option>
                            ))}
                        </select>
                    </div>
                </div>

                {filteredStudents.length === 0 ? (
                    <EmptyState icon="👦" title="Belum Ada Siswa" description="Tambahkan data siswa atau unduh template lalu unggah berkas Excel." />
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
                                    <th className="p-3">Nama Siswa</th>
                                    <th className="p-3">Username</th>
                                    <th className="p-3">NISN</th>
                                    <th className="p-3">Kelas</th>
                                    <th className="p-3">Mentor</th>
                                    <th className="p-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map(s => {
                                    const isSelected = selectedStudentIds.includes(s.id);
                                    return (
                                        <tr key={s.id} className={`border-b border-gray-50 transition-colors ${isSelected ? 'bg-red-50/60' : 'hover:bg-gray-50/50'}`}>
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectOne(s.id)}
                                                    className="w-4 h-4 text-brand-red rounded border-gray-300 focus:ring-brand-red cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-3 font-semibold">{s.name}</td>
                                            <td className="p-3 text-gray-500">@{s.username}</td>
                                            <td className="p-3 text-gray-500">{s.nisn || '-'}</td>
                                            <td className="p-3 font-bold text-brand-red">{s.className || '-'}</td>
                                            <td className="p-3 text-brand-blue font-bold text-xs">{s.mentorName || '-'}</td>
                                            <td className="p-3 text-right space-x-2">
                                                <button onClick={async () => {
                                                    const success = await promptResetPassword(s, 'siswa123');
                                                    if (success) {
                                                        await loadData();
                                                        triggerSync();
                                                    }
                                                }} className="text-amber-600 hover:underline font-bold text-xs" title="Reset Kata Sandi Siswa">
                                                    <i className="fas fa-key"></i> Reset Pass
                                                </button>
                                                <button onClick={() => { setEditingStudent(s); setFormData({ name: s.name, username: s.username, password: '', nisn: s.nisn, classId: s.classId, mentorId: s.mentorId, gender: s.gender }); setIsModalOpen(true); }} className="text-brand-blue hover:underline font-bold text-xs"><i className="fas fa-edit"></i> Edit</button>
                                                <button onClick={() => handleDeleteStudent(s)} className="text-brand-red hover:underline font-bold text-xs"><i className="fas fa-trash"></i> Hapus</button>
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
                        <h3 className="font-black text-lg mb-4">{editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}</h3>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const targetName = formData.name.trim();
                            const targetUsername = formData.username.trim();
                            const selectedClass = classes.find(c => c.id === formData.classId);
                            const selectedMentor = teachers.find(t => t.id === formData.mentorId);

                            if (editingStudent) {
                                const updated = { ...editingStudent, name: targetName, username: targetUsername, nisn: formData.nisn.trim(), classId: formData.classId, className: selectedClass?.name || editingStudent.className, mentorId: formData.mentorId, mentorName: selectedMentor?.name || '', gender: formData.gender, avatar: formData.gender === 'Laki-laki' ? '👦' : '👧', updatedAt: new Date() };
                                await db.users.put(updated);
                                await db.syncQueue.put({ id: `sync_s_${Date.now()}`, tableName: 'users', recordId: editingStudent.id, action: 'update', status: 'pending', createdAt: new Date() });
                            } else {
                                const newId = `u_siswa_${Date.now()}`;
                                const hashedPassword = await hashPassword(formData.password.trim() || 'siswa123');
                                const created = { id: newId, username: targetUsername, password: hashedPassword, name: targetName, nisn: formData.nisn.trim(), classId: formData.classId, className: selectedClass?.name || '', mentorId: formData.mentorId, mentorName: selectedMentor?.name || '', gender: formData.gender, role: ROLES.SISWA, avatar: formData.gender === 'Laki-laki' ? '👦' : '👧', createdBy: 'admin', status: 'Aktif', createdAt: new Date() };
                                await db.users.put(created);
                                await db.syncQueue.put({ id: `sync_s_${Date.now()}`, tableName: 'users', recordId: newId, action: 'create', status: 'pending', createdAt: new Date() });
                            }

                            setIsModalOpen(false);
                            await loadData();
                            triggerSync();
                            showAlert.success('Berhasil', 'Data siswa berhasil disimpan.');
                        }} className="space-y-3">
                            <input type="text" placeholder="Nama Lengkap" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm" required />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" placeholder="Username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm" required />
                                <input type="text" placeholder="NISN" value={formData.nisn} onChange={e => setFormData({ ...formData, nisn: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <select value={formData.classId} onChange={e => setFormData({ ...formData, classId: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm font-semibold" required>
                                    <option value="">-- Pilih Kelas --</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm font-semibold">
                                    <option value="Laki-laki">Laki-laki</option>
                                    <option value="Perempuan">Perempuan</option>
                                </select>
                            </div>
                            <select value={formData.mentorId} onChange={e => setFormData({ ...formData, mentorId: e.target.value })} className="w-full p-2.5 border rounded-xl text-sm font-semibold">
                                <option value="">-- Tanpa Mentor Khusus --</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
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
