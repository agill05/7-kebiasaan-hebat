var AdminArchivesPage = () => {
    const [archiveList, setArchiveList] = useState([]);
    const [selectedSheetName, setSelectedSheetName] = useState('');
    const [archiveRows, setArchiveRows] = useState([]);
    const [isLoadingList, setIsLoadingList] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClass, setFilterClass] = useState('all');

    const fetchArchiveList = async () => {
        if (!navigator.onLine || !GAS_API_URL || GAS_API_URL.includes("MASUKKAN_URL")) {
            return showAlert.warning('Koneksi Diperlukan', 'Harap hubungkan perangkat ke internet untuk melihat daftar arsip di Google Sheets.');
        }
        setIsLoadingList(true);
        try {
            const res = await fetch(`${GAS_API_URL}?action=getArchiveList`);
            const json = await res.json();
            if (json.status === 'success') {
                setArchiveList(json.archives || []);
                if (json.archives && json.archives.length > 0) {
                    setSelectedSheetName(json.archives[0].sheetName);
                }
            } else {
                showAlert.error('Gagal', json.message || 'Gagal memuat daftar arsip.');
            }
        } catch (e) {
            showAlert.error('Kesalahan Jaringan', 'Tidak dapat terhubung ke backend server.');
        } finally {
            setIsLoadingList(false);
        }
    };

    useEffect(() => {
        fetchArchiveList();
    }, []);

    const handleLoadArchiveData = async () => {
        if (!selectedSheetName) return showAlert.warning('Perhatian', 'Pilih salah satu arsip semester.');
        setIsLoadingData(true);
        try {
            const res = await fetch(`${GAS_API_URL}?action=getArchiveData&sheetName=${encodeURIComponent(selectedSheetName)}`);
            const json = await res.json();
            if (json.status === 'success') {
                setArchiveRows(json.data || []);
                showAlert.success('Arsip Dimuat!', `${json.data?.length || 0} baris data kebiasaan berhasil dimuat dari server.`);
            } else {
                showAlert.error('Gagal', json.message || 'Gagal memuat data arsip.');
            }
        } catch (e) {
            showAlert.error('Kesalahan Jaringan', 'Gagal memuat data arsip.');
        } finally {
            setIsLoadingData(false);
        }
    };

    const availableClasses = useMemo(() => {
        const classesSet = new Set();
        archiveRows.forEach(r => {
            const cls = r['Kelas'] || r['className'];
            if (cls) classesSet.add(cls);
        });
        return Array.from(classesSet).sort();
    }, [archiveRows]);

    const filteredRows = useMemo(() => {
        return archiveRows.filter(r => {
            const name = (r['Nama Siswa'] || r['studentName'] || '').toLowerCase();
            const habit = (r['Nama Kebiasaan'] || r['habitName'] || '').toLowerCase();
            const cls = r['Kelas'] || r['className'] || '';
            const query = searchQuery.toLowerCase().trim();

            const matchesSearch = !query || name.includes(query) || habit.includes(query);
            const matchesClass = filterClass === 'all' || cls === filterClass;
            return matchesSearch && matchesClass;
        });
    }, [archiveRows, searchQuery, filterClass]);

    const handleExportArchiveExcel = () => {
        if (filteredRows.length === 0) return showAlert.warning('Data Kosong', 'Tidak ada baris data arsip untuk diekspor.');

        const aoaData = [
            [SCHOOL_IDENTITY.name.toUpperCase()],
            [`DOKUMEN ARSIP DATA 7 KEBIASAAN ANAK INDONESIA HEBAT`],
            [`Nama Lembar: ${selectedSheetName} | Total Data: ${filteredRows.length} baris`],
            [],
            ['No', 'ID Log', 'Nama Siswa', 'Kelas', 'Pilar Kebiasaan', 'Tanggal', 'Status Selesai', 'Jam / Waktu', 'Detail / Keterangan']
        ];

        filteredRows.forEach((r, idx) => {
            aoaData.push([
                idx + 1,
                r['ID Log'] || r['id'] || '-',
                r['Nama Siswa'] || r['studentName'] || '-',
                r['Kelas'] || r['className'] || '-',
                r['Nama Kebiasaan'] || r['habitName'] || '-',
                r['Tanggal'] || r['date'] || '-',
                r['Status Selesai'] || (r['completed'] === 'true' || r['completed'] === true ? 'Selesai' : 'Belum Selesai'),
                formatCleanTime(r['Jam / Waktu'] || r['timeValue']),
                r['Detail / Keterangan'] || r['detailValue'] || '-'
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoaData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Arsip");
        XLSX.writeFile(wb, `${selectedSheetName}_Export.xlsx`);
        showAlert.success('Berhasil Diunduh', 'Berkas Excel arsip berhasil disimpan.');
    };

    const handleExportArchivePDF = () => {
        if (filteredRows.length === 0) return showAlert.warning('Data Kosong', 'Tidak ada data arsip untuk dicetak.');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(SCHOOL_IDENTITY.name.toUpperCase(), pageWidth / 2, 35, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`LEMBAR ARSIP DATA PEMBIASAAN 7 KEBIASAAN SISWA`, pageWidth / 2, 48, { align: 'center' });
        doc.text(`Sumber Lembar: ${selectedSheetName}`, pageWidth / 2, 60, { align: 'center' });

        doc.setDrawColor(200, 200, 200);
        doc.line(40, 68, pageWidth - 40, 68);

        const tableBody = filteredRows.map((r, idx) => [
            idx + 1,
            r['Nama Siswa'] || r['studentName'] || '-',
            r['Kelas'] || r['className'] || '-',
            r['Nama Kebiasaan'] || r['habitName'] || '-',
            r['Tanggal'] || r['date'] || '-',
            r['Status Selesai'] || (r['completed'] ? 'Selesai' : 'Belum'),
            formatCleanTime(r['Jam / Waktu'] || r['timeValue']),
            r['Detail / Keterangan'] || r['detailValue'] || '-'
        ]);

        doc.autoTable({
            startY: 78,
            head: [['No', 'Nama Siswa', 'Kelas', 'Pilar Kebiasaan', 'Tanggal', 'Status', 'Jam', 'Detail / Keterangan']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 3, valign: 'middle' },
            columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 1: { cellWidth: 110, fontStyle: 'bold' }, 2: { halign: 'center', cellWidth: 45 }, 3: { cellWidth: 100 }, 4: { halign: 'center', cellWidth: 65 }, 5: { halign: 'center', cellWidth: 55 }, 6: { halign: 'center', cellWidth: 45 }, 7: { cellWidth: 'auto' } }
        });

        doc.save(`${selectedSheetName}_Dokumen_Arsip.pdf`);
        showAlert.success('Berhasil Diunduh', 'Berkas PDF arsip berhasil disimpan.');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-brand-dark">📦 Pusat Data Arsip Semester</h1>
                    <p className="text-gray-500 font-medium text-sm">Lihat, telaah riwayat masa lalu, dan ekspor lembar arsip semester secara instan tanpa membebani sistem aktif.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="white" onClick={fetchArchiveList} disabled={isLoadingList} className="text-xs py-2 px-3">
                        <i className={`fas fa-sync-alt mr-1 ${isLoadingList ? 'fa-spin' : ''}`}></i> Segarkan Daftar Arsip
                    </Button>
                </div>
            </div>

            <Card className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-600 mb-1">Pilih Lembar Arsip Semester (Dari Google Sheets):</label>
                        {isLoadingList ? (
                            <div className="p-2.5 bg-gray-50 border rounded-xl text-xs text-gray-500 font-bold">
                                <i className="fas fa-spinner fa-spin mr-1"></i> Membaca daftar lembar arsip di Google Sheets...
                            </div>
                        ) : archiveList.length === 0 ? (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold">
                                Belum ada lembar arsip semester yang dibuat. Anda dapat membuatnya via tombol "Arsipkan Semester" di Dashboard Admin.
                            </div>
                        ) : (
                            <select value={selectedSheetName} onChange={e => { setSelectedSheetName(e.target.value); setArchiveRows([]); }} className="w-full p-2.5 bg-gray-50 border rounded-xl text-xs font-black text-brand-dark focus:ring-2 focus:ring-brand-red outline-none">
                                {archiveList.map(a => (
                                    <option key={a.sheetName} value={a.sheetName}>
                                        📁 {a.sheetName} ({a.rowCount} Baris Log Habit)
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div>
                        <Button fullWidth variant="primary" onClick={handleLoadArchiveData} disabled={!selectedSheetName || isLoadingData || isLoadingList} className="text-xs py-2.5">
                            <i className={`fas ${isLoadingData ? 'fa-spinner fa-spin' : 'fa-cloud-download-alt'} mr-1.5`}></i>
                            {isLoadingData ? 'Memuat Data...' : 'Muat Data Arsip Ini'}
                        </Button>
                    </div>
                </div>

                {archiveRows.length > 0 && (
                    <div className="pt-3 border-t flex flex-col md:flex-row gap-3 justify-between items-center">
                        <div className="flex gap-2 w-full md:w-auto">
                            <div className="relative w-full md:w-64">
                                <i className="fas fa-search absolute left-3 top-2.5 text-gray-400 text-xs"></i>
                                <input type="text" placeholder="Cari nama siswa atau kebiasaan..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border rounded-xl text-xs font-semibold" />
                            </div>
                            <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="p-1.5 bg-gray-50 border rounded-xl text-xs font-bold">
                                <option value="all">Semua Kelas</option>
                                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto justify-end">
                            <Button variant="green" onClick={handleExportArchiveExcel} className="text-xs py-1.5 px-3">
                                <i className="fas fa-file-excel mr-1"></i> Excel
                            </Button>
                            <Button variant="primary" onClick={handleExportArchivePDF} className="text-xs py-1.5 px-3">
                                <i className="fas fa-file-pdf mr-1"></i> Cetak PDF
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {isLoadingData ? (
                <Card><div className="text-center py-12 text-gray-500 text-sm font-bold"><i className="fas fa-spinner fa-spin text-2xl text-brand-red mb-2 block"></i> Mengunduh dan menata baris data arsip...</div></Card>
            ) : archiveRows.length === 0 ? (
                <Card><EmptyState icon="📦" title="Belum Ada Data Arsip Ditampilkan" description="Pilih semester arsip di atas lalu klik tombol 'Muat Data Arsip Ini'." /></Card>
            ) : (
                <Card className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500 px-1">
                        <span>Menampilkan <b>{filteredRows.length}</b> dari {archiveRows.length} baris data arsip</span>
                        <span className="bg-red-50 text-brand-red px-2.5 py-1 rounded-lg">Lembar: {selectedSheetName}</span>
                    </div>

                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-brand-red text-white font-extrabold sticky top-0 z-10">
                                <tr>
                                    <th className="p-2.5 text-center w-10">No</th>
                                    <th className="p-2.5">Nama Siswa</th>
                                    <th className="p-2.5 text-center">Kelas</th>
                                    <th className="p-2.5">Pilar Kebiasaan</th>
                                    <th className="p-2.5 text-center">Tanggal</th>
                                    <th className="p-2.5 text-center">Status</th>
                                    <th className="p-2.5 text-center">Jam</th>
                                    <th className="p-2.5">Detail Aktivitas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredRows.map((row, idx) => {
                                    const isDone = String(row['Status Selesai'] || row['completed']).toLowerCase() === 'selesai' || row['completed'] === true || row['completed'] === 'true';
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="p-2.5 text-center text-gray-400 font-bold">{idx + 1}</td>
                                            <td className="p-2.5 font-bold text-gray-800">{row['Nama Siswa'] || row['studentName'] || '-'}</td>
                                            <td className="p-2.5 text-center font-bold text-brand-red">{row['Kelas'] || row['className'] || '-'}</td>
                                            <td className="p-2.5 font-bold text-brand-dark">{row['Nama Kebiasaan'] || row['habitName'] || '-'}</td>
                                            <td className="p-2.5 text-center text-gray-600 font-semibold">{row['Tanggal'] || row['date'] || '-'}</td>
                                            <td className="p-2.5 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {isDone ? 'Selesai' : 'Belum Selesai'}
                                                </span>
                                            </td>
                                            <td className="p-2.5 text-center font-bold text-brand-blue">{formatCleanTime(row['Jam / Waktu'] || row['timeValue'])}</td>
                                            <td className="p-2.5 text-gray-600 italic max-w-xs truncate">{row['Detail / Keterangan'] || row['detailValue'] || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
};
