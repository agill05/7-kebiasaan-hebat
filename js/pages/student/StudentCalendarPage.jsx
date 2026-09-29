var StudentCalendarPage = ({ user }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [logsMap, setLogsMap] = useState({});

    useEffect(() => {
        async function loadMonthLogs() {
            const allLogs = await db.habitLogs.where('userId').equals(user.id).toArray();
            const map = {};
            allLogs.forEach(l => {
                if (!map[l.date]) map[l.date] = 0;
                if (l.completed) map[l.date] += 1;
            });
            setLogsMap(map);
        }
        loadMonthLogs();
    }, [user.id, currentMonth]);

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-black text-brand-dark">📅 Kalender Pembiasaan</h1>
                <div className="flex items-center gap-2">
                    <Button variant="white" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="py-2 px-3"><i className="fas fa-chevron-left"></i></Button>
                    <span className="font-extrabold text-brand-dark min-w-[130px] text-center text-sm">{monthNames[month]} {year}</span>
                    <Button variant="white" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="py-2 px-3"><i className="fas fa-chevron-right"></i></Button>
                </div>
            </div>

            <Card>
                <div className="grid grid-cols-7 gap-2 text-center font-bold text-xs text-gray-400 mb-2">
                    <span>Min</span><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span>
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`}></div>)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dayStr = String(day).padStart(2, '0');
                        const mStr = String(month + 1).padStart(2, '0');
                        const dateKey = `${year}-${mStr}-${dayStr}`;
                        const count = logsMap[dateKey] || 0;

                        let style = 'bg-gray-50 border-gray-100 text-gray-700';
                        if (count === 7) style = 'bg-green-100 border-brand-green text-brand-green font-black';
                        else if (count > 0) style = 'bg-yellow-50 border-yellow-300 text-yellow-700 font-bold';

                        return (
                            <div key={day} className={`p-2.5 rounded-xl border-2 flex flex-col items-center justify-center ${style}`}>
                                <span className="text-xs font-bold">{day}</span>
                                <span className="text-[9px] mt-0.5">{count}/7</span>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
};
