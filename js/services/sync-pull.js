async function pullAllCloudData() {
    if (!navigator.onLine || !GAS_API_URL || GAS_API_URL.includes("MASUKKAN_URL")) return false;
    try {
        const res = await fetch(`${GAS_API_URL}?action=getAllData`);
        const json = await res.json();

        if (json.status === 'success') {
            const pendingQueue = await db.syncQueue.where('status').equals('pending').toArray();
            const pendingIdsByTable = {
                classes: new Set(pendingQueue.filter(q => q.tableName === 'classes').map(q => q.recordId)),
                users: new Set(pendingQueue.filter(q => q.tableName === 'users').map(q => q.recordId)),
                habitLogs: new Set(pendingQueue.filter(q => q.tableName === 'habitLogs').map(q => q.recordId)),
                journals: new Set(pendingQueue.filter(q => q.tableName === 'journals').map(q => q.recordId))
            };

            if (Array.isArray(json.classes)) {
                const formattedClasses = json.classes.map(c => ({
                    id: String(c['Class ID'] || c['id'] || '').trim(),
                    name: String(c['Nama Kelas'] || c['name'] || '').trim(),
                    teacherId: String(c['Teacher ID (Wali)'] || c['teacherId'] || '').trim(),
                    teacherName: String(c['Nama Wali Kelas'] || c['teacherName'] || '').trim()
                })).filter(c => c.id);

                const cloudClassIds = new Set(formattedClasses.map(c => c.id));
                const localClasses = await db.classes.toArray();
                const staleClassIds = localClasses
                    .map(c => c.id)
                    .filter(id => !cloudClassIds.has(id) && !pendingIdsByTable.classes.has(id));

                if (formattedClasses.length > 0) await db.classes.bulkPut(formattedClasses);
                if (staleClassIds.length > 0) await db.classes.bulkDelete(staleClassIds);
            }

            if (Array.isArray(json.users)) {
                const formattedUsers = json.users.map(u => {
                    const genderVal = String(u['Jenis Kelamin'] || u['gender'] || (u['Role'] === 'guru' || u['Role'] === 'admin' ? '' : 'Laki-laki')).trim();
                    return {
                        id: String(u['User ID'] || u['id'] || '').trim(),
                        username: String(u['Username'] || u['username'] || '').trim(),
                        name: String(u['Nama Lengkap'] || u['name'] || '').trim(),
                        role: String(u['Role'] || u['role'] || 'siswa').trim().toLowerCase(),
                        password: String(u['Password'] || u['password'] || '').trim(),
                        phone: String(u['Nomor Telepon'] || u['phone'] || '').trim(),
                        className: String(u['Kelas'] || u['className'] || '').trim(),
                        classId: String(u['Class ID'] || u['classId'] || '').trim(),
                        nisn: String(u['NISN'] || u['nisn'] || '').trim(),
                        nip: String(u['NIP'] || u['nip'] || '').trim(),
                        gender: genderVal,
                        subject: String(u['Mata Pelajaran'] || u['subject'] || '').trim(),
                        homeroomClassId: String(u['Homeroom Class ID'] || u['homeroomClassId'] || '').trim(),
                        mentorId: String(u['Mentor ID'] || u['mentorId'] || '').trim(),
                        mentorName: String(u['Mentor Name'] || u['mentorName'] || '').trim(),
                        createdBy: String(u['Created By'] || u['createdBy'] || 'admin').trim(),
                        status: String(u['Status'] || u['status'] || 'Aktif').trim(),
                        avatar: (u['Role'] === 'guru' ? '👨‍🏫' : u['Role'] === 'admin' ? '⚙️' : (genderVal.toLowerCase().includes('perempuan') ? '👧' : '👦'))
                    };
                }).filter(u => u.id);

                const cloudUserIds = new Set(formattedUsers.map(u => u.id));
                const localUsers = await db.users.toArray();
                const staleUserIds = localUsers
                    .map(u => u.id)
                    .filter(id => id !== 'u_admin_default' && !cloudUserIds.has(id) && !pendingIdsByTable.users.has(id));

                if (formattedUsers.length > 0) await db.users.bulkPut(formattedUsers);
                if (staleUserIds.length > 0) await db.users.bulkDelete(staleUserIds);
            }

            if (Array.isArray(json.habitLogs)) {
                const formattedLogs = json.habitLogs.map(l => ({
                    id: String(l['ID Log'] || l['id'] || '').trim(),
                    userId: String(l['User ID'] || l['userId'] || '').trim(),
                    studentName: String(l['Nama Siswa'] || l['studentName'] || '').trim(),
                    className: String(l['Kelas'] || l['className'] || '').trim(),
                    habitId: String(l['Habit ID'] || l['habitId'] || '').trim(),
                    habitName: String(l['Nama Kebiasaan'] || l['habitName'] || '').trim(),
                    date: String(l['Tanggal'] || l['date'] || '').trim().split('T')[0],
                    completed: String(l['Status Selesai'] || l['completed']).trim() === 'Selesai' || l['completed'] === true,
                    timeValue: formatCleanTime(l['Jam / Waktu'] || l['timeValue'] || ''),
                    detailValue: String(l['Detail / Keterangan'] || l['detailValue'] || '').trim(),
                    syncStatus: 'synced'
                })).filter(l => l.id);

                const cloudLogIds = new Set(formattedLogs.map(l => l.id));
                const localLogs = await db.habitLogs.toArray();
                const staleLogIds = localLogs
                    .map(l => l.id)
                    .filter(id => !cloudLogIds.has(id) && !pendingIdsByTable.habitLogs.has(id));

                if (formattedLogs.length > 0) await db.habitLogs.bulkPut(formattedLogs);
                if (staleLogIds.length > 0) await db.habitLogs.bulkDelete(staleLogIds);
            }

            if (Array.isArray(json.journals)) {
                const formattedJournals = json.journals.map(j => ({
                    id: String(j['ID Jurnal'] || j['id'] || '').trim(),
                    userId: String(j['User ID'] || j['userId'] || '').trim(),
                    studentName: String(j['Nama Siswa'] || j['studentName'] || '').trim(),
                    className: String(j['Kelas'] || j['className'] || '').trim(),
                    date: String(j['Tanggal'] || j['date'] || '').trim().split('T')[0],
                    mood: String(j['Mood'] || j['mood'] || '').trim(),
                    content: String(j['Isi Jurnal'] || j['content'] || '').trim(),
                    homeroomFeedback: String(j['Catatan Wali Kelas'] || j['homeroomFeedback'] || j['Catatan Guru'] || j['teacherFeedback'] || '').trim(),
                    homeroomTeacherName: String(j['Nama Wali Kelas'] || j['homeroomTeacherName'] || '').trim(),
                    mentorFeedback: String(j['Catatan Guru Mentor'] || j['mentorFeedback'] || '').trim(),
                    mentorTeacherName: String(j['Nama Guru Mentor'] || j['mentorTeacherName'] || '').trim(),
                    syncStatus: 'synced'
                })).filter(j => j.id);

                const cloudJournalIds = new Set(formattedJournals.map(j => j.id));
                const localJournals = await db.journals.toArray();
                const staleJournalIds = localJournals
                    .map(j => j.id)
                    .filter(id => !cloudJournalIds.has(id) && !pendingIdsByTable.journals.has(id));

                if (formattedJournals.length > 0) await db.journals.bulkPut(formattedJournals);
                if (staleJournalIds.length > 0) await db.journals.bulkDelete(staleJournalIds);
            }

            if (Array.isArray(json.habits)) {
                const formattedHabits = json.habits.map(h => ({
                    id: String(h['Habit ID'] || h['id'] || '').trim(),
                    shortName: String(h['Nama Singkat'] || h['shortName'] || '').trim(),
                    name: String(h['Nama Kebiasaan'] || h['name'] || '').trim(),
                    defaultTime: formatCleanTime(h['Jam Default'] || h['defaultTime'] || ''),
                    defaultDetail: String(h['Detail Default'] || h['defaultDetail'] || '').trim(),
                    icon: String(h['Ikon'] || h['icon'] || '⭐').trim(),
                    color: String(h['Warna'] || h['color'] || 'bg-blue-100 text-blue-600').trim(),
                    timeLabel: String(h['Label Jam'] || h['timeLabel'] || 'Waktu').trim(),
                    detailLabel: String(h['Label Detail'] || h['detailLabel'] || 'Detail').trim(),
                    detailPlaceholder: String(h['Placeholder Detail'] || h['detailPlaceholder'] || '').trim(),
                    sortOrder: Number(h['Urutan'] || h['sortOrder'] || 0),
                    active: String(h['Status Aktif'] || h['active']).trim() === 'Aktif' || h['active'] === true
                })).filter(h => h.id);

                if (formattedHabits.length > 0) await db.habits.bulkPut(formattedHabits);
            }

            return true;
        }
    } catch (err) {
        console.warn("Pull data notice:", err);
    }
    return false;
}
