var ReportsModule = ({ user }) => {
    const today = getTodayWitaDateString();
    const [reportType, setReportType] = useState('habits');
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [selectedClassId, setSelectedClassId] = useState('all');
    const [selectedStudentId, setSelectedStudentId] = useState('all');
    const [selectedScope, setSelectedScope] = useState('all');

    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [habitLogs, setHabitLogs] = useState([]);
    const [journals, setJournals] = useState([]);

    const loadReportData = async () => {
        const c = await db.classes.toArray();
        const s = await db.users.where('role').equals(ROLES.SISWA).toArray();
        const hl = await db.habitLogs.toArray();
        const j = await db.journals.toArray();
        setClasses(c); setStudents(s); setHabitLogs(hl); setJournals(j);
    };

    useEffect(() => { loadReportData(); }, []);

    const accessibleStudents = useMemo(() => {
        if (user.role === ROLES.ADMIN) return students;

        const myHomeroomClassIds = new Set(classes.filter(c => c.teacherId === user.id).map(c => c.id));
        const myHomeroomClassNames = new Set(classes.filter(c => c.teacherId === user.id).map(c => (c.name || '').toLowerCase().trim()));

        return students.filter(s => {
            const isHomeroom = (s.classId && myHomeroomClassIds.has(s.classId)) ||
                (s.className && myHomeroomClassNames.has(String(s.className).toLowerCase().trim())) ||
                (user.homeroomClassId && s.classId === user.homeroomClassId);
            const isMentor = s.mentorId === user.id;
            if (selectedScope === 'homeroom') return isHomeroom;
            if (selectedScope === 'mentor') return isMentor;
            return isHomeroom || isMentor;
        });
    }, [students, classes, user, selectedScope]);

    const filteredStudentList = useMemo(() => {
        let list = accessibleStudents;
        if (user.role === ROLES.ADMIN && selectedClassId !== 'all') list = list.filter(s => s.classId === selectedClassId);
        if (selectedStudentId !== 'all') list = list.filter(s => s.id === selectedStudentId);
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [accessibleStudents, selectedClassId, selectedStudentId, user.role]);

    const dateRangeList = useMemo(() => getDatesInRange(startDate, endDate), [startDate, endDate]);

    const studentDetailedHabits = useMemo(() => {
        return filteredStudentList.map(student => {
            const studentLogs = habitLogs.filter(l => l.userId === student.id && l.date >= startDate && l.date <= endDate);
            const logMap = {};
            studentLogs.forEach(l => { logMap[`${l.date}_${l.habitId}`] = l; });

            const daysBreakdown = dateRangeList.map(dateStr => {
                const habits = HABITS_CONFIG.map(h => {
                    const log = logMap[`${dateStr}_${h.id}`];
                    return {
                        habitId: h.id, habitName: h.name, icon: h.icon,
                        completed: log ? log.completed : false,
                        timeValue: log ? formatCleanTime(log.timeValue) : '-',
                        detailValue: log ? log.detailValue : '-'
                    };
                });
                return { date: dateStr, habits, completedCount: habits.filter(h => h.completed).length };
            });

            const flatRows = [];
            let rowCounter = 1;
            daysBreakdown.forEach(day => {
                day.habits.forEach(h => {
                    flatRows.push({
                        no: rowCounter++, date: day.date, habitName: h.habitName, icon: h.icon,
                        completed: h.completed, timeValue: h.timeValue, detailValue: h.detailValue
                    });
                });
            });

            const totalCompleted = flatRows.filter(r => r.completed).length;
            const totalPossible = flatRows.length;
            const percentage = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

            return { student, daysBreakdown, flatRows, totalCompleted, totalPossible, percentage };
        });
    }, [filteredStudentList, habitLogs, startDate, endDate, dateRangeList]);

    const handleExportExcel = () => {
        if (reportType === 'habits') {
            if (studentDetailedHabits.length === 0) return showAlert.warning('Data Kosong', 'Tidak ada data log kebiasaan.');

            const aoaData = [
                [SCHOOL_IDENTITY.name.toUpperCase()],
                [`LAPORAN RINCIAN PROGRAM 7 KEBIASAAN ANAK INDONESIA HEBAT (PER SISWA)`],
                [`Periode: ${startDate} s.d. ${endDate} | Tahun Ajaran: ${SCHOOL_IDENTITY.academicYear}`],
                []
            ];

            studentDetailedHabits.forEach((item, idx) => {
                const s = item.student;
                aoaData.push([`TABEL DATA SISWA ${idx + 1}: ${s.name.toUpperCase()}`]);
                aoaData.push([`NISN: ${s.nisn || '-'}`, `Kelas: ${s.className || '-'}`, `Guru Mentor: ${s.mentorName || '-'}`, `Total Capaian: ${item.totalCompleted}/${item.totalPossible} (${item.percentage}%)`]);
                aoaData.push(['No', 'Tanggal', 'Pilar Kebiasaan', 'Status', 'Jam (WITA)', 'Keterangan Aktivitas / Detail']);

                item.daysBreakdown.forEach(day => {
                    day.habits.forEach((h, hIdx) => {
                        aoaData.push([hIdx + 1, day.date, h.habitName, h.completed ? 'Selesai' : 'Belum Selesai', formatCleanTime(h.timeValue), h.detailValue || '-']);
                    });
                });
                aoaData.push([]);
            });

            const worksheet = XLSX.utils.aoa_to_sheet(aoaData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Rincian 7 Kebiasaan");
            XLSX.writeFile(workbook, `Laporan_Rinci_7Kebiasaan_${startDate}_sd_${endDate}.xlsx`);
            showAlert.success('Berhasil Diunduh', 'File Excel berhasil diekspor.');
        }
    };

    const handleExportPDF = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        if (studentDetailedHabits.length === 0) return showAlert.warning('Data Kosong', 'Tidak ada data siswa.');

        studentDetailedHabits.forEach((item, index) => {
            if (index > 0) doc.addPage('landscape');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(SCHOOL_IDENTITY.name.toUpperCase(), pageWidth / 2, 38, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`LAPORAN RINCIAN PEMBIASAAN 7 KEBIASAAN ANAK INDONESIA HEBAT`, pageWidth / 2, 52, { align: 'center' });
            doc.text(`Periode: ${formatDisplayDate(startDate)} s.d. ${formatDisplayDate(endDate)} • Tahun Ajaran ${SCHOOL_IDENTITY.academicYear}`, pageWidth / 2, 65, { align: 'center' });

            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(1);
            doc.line(40, 74, pageWidth - 40, 74);

            const s = item.student;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');

            const leftLabelX = 40;
            const leftColonX = 110;
            const leftValX = 118;

            doc.text("Nama Siswa", leftLabelX, 92);
            doc.text(":", leftColonX, 92);
            doc.text(s.name, leftValX, 92);

            doc.text("Kelas / Rombel", leftLabelX, 106);
            doc.text(":", leftColonX, 106);
            doc.text(s.className || '-', leftValX, 106);

            const rightLabelX = pageWidth - 260;
            const rightColonX = pageWidth - 190;
            const rightValX = pageWidth - 182;

            doc.text("NISN", rightLabelX, 92);
            doc.text(":", rightColonX, 92);
            doc.text(s.nisn || '-', rightValX, 92);

            doc.text("Guru Mentor", rightLabelX, 106);
            doc.text(":", rightColonX, 106);
            doc.text(s.mentorName || '-', rightValX, 106);

            const tableBody = item.flatRows.map(r => [
                r.no,
                r.date,
                r.habitName,
                r.completed ? 'Selesai' : 'Belum Selesai',
                formatCleanTime(r.timeValue),
                r.detailValue || '-'
            ]);

            doc.autoTable({
                startY: 116,
                head: [['No', 'Tanggal', 'Pilar Kebiasaan', 'Status', 'Jam (WITA)', 'Keterangan Aktivitas / Detail']],
                body: tableBody,
                foot: [['TOTAL', '', '', `${item.totalCompleted} / ${item.totalPossible} (${item.percentage}%) Selesai`, '', '']],
                theme: 'grid',
                headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
                footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold', halign: 'center', fontSize: 8 },
                styles: { fontSize: 8, cellPadding: 4, valign: 'middle' },
                columnStyles: { 0: { halign: 'center', cellWidth: 30 }, 1: { halign: 'center', cellWidth: 70 }, 2: { cellWidth: 120, fontStyle: 'bold' }, 3: { halign: 'center', cellWidth: 70 }, 4: { halign: 'center', cellWidth: 60 }, 5: { cellWidth: 'auto' } }
            });

            const finalY = doc.lastAutoTable.finalY + 25;
            const sigY = finalY > pageHeight - 85 ? pageHeight - 85 : finalY;
            const sigX = pageWidth - 190;

            doc.setTextColor(0, 0, 0);
            doc.setDrawColor(0, 0, 0);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Talaga Jaya, ${formatDisplayDate(today)}`, sigX, sigY);
            doc.text(user.role === ROLES.ADMIN ? 'Administrator Sistem,' : 'Guru Pembimbing / Wali Kelas,', sigX, sigY + 13);

            doc.setFontSize(9.5);
            doc.setFont('helvetica', 'bold');
            doc.text(user.name, sigX, sigY + 48);

            const nameWidth = doc.getTextWidth(user.name);
            doc.setLineWidth(1.1);
            doc.line(sigX, sigY + 50, sigX + nameWidth, sigY + 50);

            if (user.nip) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text(`NIP: ${user.nip}`, sigX, sigY + 62);
            }
        });

        doc.save(`Laporan_Rinci_7Kebiasaan_${startDate}_sd_${endDate}.pdf`);
        showAlert.success('Berhasil Diunduh', 'File PDF per siswa berhasil diekspor.');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h1 className="text-2xl font-black text-brand-dark">📊 Laporan Rinci Per Siswa & Harian</h1>
                    <p className="text-gray-500 font-medium text-sm">Laporan pembiasaan karakter dengan tabel mandiri per siswa yang dipisahkan per hari.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="green" onClick={handleExportExcel} className="text-xs py-2 px-3.5"><i className="fas fa-file-excel mr-1"></i> Ekspor Excel</Button>
                    <Button variant="primary" onClick={handleExportPDF} className="text-xs py-2 px-3.5"><i className="fas fa-file-pdf mr-1"></i> Cetak / Unduh PDF</Button>
                </div>
            </div>

            <Card className="no-print space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div>
                        <label className="block font-bold text-gray-600 mb-1">Mulai Tanggal</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold text-brand-dark" />
                    </div>
                    <div>
                        <label className="block font-bold text-gray-600 mb-1">Sampai Tanggal</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold text-brand-dark" />
                    </div>
                    {user.role === ROLES.ADMIN ? (
                        <div>
                            <label className="block font-bold text-gray-600 mb-1">Filter Kelas</label>
                            <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold">
                                <option value="all">-- Semua Kelas --</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="block font-bold text-gray-600 mb-1">Kategori Binaan Guru</label>
                            <select value={selectedScope} onChange={e => setSelectedScope(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold">
                                <option value="all">Semua Siswa Binaan</option>
                                <option value="homeroom">Kelas Binaan</option>
                                <option value="mentor">Kelompok Mentoring</option>
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block font-bold text-gray-600 mb-1">Pilih Siswa Spesifik</label>
                        <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl font-bold">
                            <option value="all">-- Semua Siswa ({filteredStudentList.length}) --</option>
                            {accessibleStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
            </Card>

            {studentDetailedHabits.length === 0 ? (
                <EmptyState icon="👦" title="Tidak Ada Data Siswa" description="Ubah filter kelas atau rentang tanggal untuk melihat data pembiasaan." />
            ) : (
                <div className="space-y-6">
                    {studentDetailedHabits.map(item => {
                        const s = item.student;
                        return (
                            <Card key={s.id} className="space-y-4 border-t-4 border-t-brand-red">
                                <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-3 gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-brand-red/10 text-brand-red flex items-center justify-center font-black text-xl">{s.avatar || '👦'}</div>
                                        <div>
                                            <h3 className="font-black text-brand-dark text-lg">{s.name}</h3>
                                            <p className="text-xs text-gray-500 font-bold">NISN: {s.nisn || '-'} • Kelas: <span className="text-brand-red font-black">{s.className || '-'}</span> • Mentor: <span className="text-brand-blue font-bold">{s.mentorName || '-'}</span></p>
                                        </div>
                                    </div>
                                    <span className="text-xs px-3.5 py-1.5 bg-green-50 border border-green-200 text-green-700 font-black rounded-xl">Capaian: {item.totalCompleted}/{item.totalPossible} ({item.percentage}%)</span>
                                </div>

                                <div className="space-y-4">
                                    {item.daysBreakdown.map(day => (
                                        <div key={day.date} className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="font-extrabold text-xs text-brand-dark flex items-center gap-1.5"><i className="far fa-calendar-alt text-brand-red"></i> {formatDisplayDate(day.date)} (WITA)</span>
                                                <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${day.completedCount === 7 ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{day.completedCount}/7 Selesai</span>
                                            </div>
                                            <div className="overflow-x-auto bg-white rounded-lg border border-gray-100 shadow-sm">
                                                <table className="w-full text-left text-xs whitespace-nowrap">
                                                    <thead className="bg-gray-100/70 text-gray-600 font-extrabold">
                                                        <tr><th className="p-2.5 text-center w-10">No</th><th className="p-2.5 w-48">Kebiasaan</th><th className="p-2.5 text-center w-28">Status</th><th className="p-2.5 text-center w-24">Jam</th><th className="p-2.5">Keterangan</th></tr>
                                                    </thead>
                                                    <tbody>
                                                        {day.habits.map((h, hIdx) => (
                                                            <tr key={h.habitId} className="border-b border-gray-50">
                                                                <td className="p-2.5 text-center text-gray-400">{hIdx + 1}</td>
                                                                <td className="p-2.5 font-bold text-gray-800">{h.icon} {h.habitName}</td>
                                                                <td className="p-2.5 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${h.completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{h.completed ? 'Selesai' : 'Belum'}</span></td>
                                                                <td className="p-2.5 text-center font-bold text-brand-blue">{formatCleanTime(h.timeValue)}</td>
                                                                <td className="p-2.5 text-gray-600 italic">{h.detailValue || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
