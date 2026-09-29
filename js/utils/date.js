var getTodayWitaDateString = () => {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' });
    return formatter.format(new Date());
};

var getNowWitaTimeString = () => {
    const formatter = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false });
    return formatter.format(new Date()).replace('.', ':');
};

var formatCleanTime = (timeVal) => {
    if (!timeVal || timeVal === '-' || timeVal === 'null' || timeVal === 'undefined') return '-';
    const str = String(timeVal).trim();
    if (str.includes('T')) {
        try {
            const d = new Date(str);
            if (!isNaN(d.getTime())) {
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                return `${hh}:${mm}`;
            }
        } catch (e) { }
    }
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
        return str.substring(0, 5);
    }
    return str;
};

var formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
};

var getDatesInRange = (startStr, endStr) => {
    const dates = [];
    let curr = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    while (curr <= end) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
};
