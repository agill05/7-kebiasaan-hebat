var StudentProfilePage = ({ user, onUpdateUser, triggerSync }) => {
    const [username, setUsername] = useState(user.username || '');
    const [oldPass, setOldPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');

    useEffect(() => {
        setUsername(user.username || '');
    }, [user.username]);

    const handleUpdateUsername = async (e) => {
        e.preventDefault();
        const cleanUsername = username.trim().toLowerCase();

        if (!/^[a-z0-9._]{3,20}$/.test(cleanUsername)) {
            return showAlert.warning('Format Tidak Valid', 'Username hanya boleh berisi huruf kecil, angka, titik (.), dan garis bawah (_) antara 3–20 karakter.');
        }

        if (cleanUsername === (user.username || '').toLowerCase()) {
            return showAlert.warning('Perhatian', 'Username baru sama dengan username saat ini.');
        }

        const allUsers = await db.users.toArray();
        const existingUser = allUsers.find(u => u.id !== user.id && (u.username || '').toLowerCase() === cleanUsername);

        if (existingUser) {
            return showAlert.warning('Username Sudah Digunakan', `Username "@${cleanUsername}" sudah dipakai oleh pengguna lain. Silakan pilih username lain.`);
        }

        const updated = { ...user, username: cleanUsername, updatedAt: new Date() };
        await db.users.put(updated);

        const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionRaw) {
            try {
                const session = JSON.parse(sessionRaw);
                session.user = updated;
                session.lastActive = Date.now();
                localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
            } catch (err) { }
        }

        if (onUpdateUser) onUpdateUser(updated);

        await db.syncQueue.put({ id: `sync_u_${Date.now()}`, tableName: 'users', recordId: user.id, action: 'update', status: 'pending', createdAt: new Date() });

        showAlert.success('Berhasil!', `Username Anda berhasil diperbarui menjadi @${cleanUsername}`);
        triggerSync();
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPass !== confirmPass) return showAlert.warning('Perhatian', 'Password baru dan konfirmasi tidak cocok!');
        const oldHash = await hashPassword(oldPass);
        const currentHash = user.password || await hashPassword('siswa123');

        if (oldHash !== currentHash) return showAlert.error('Gagal', 'Password lama salah!');

        const newHashed = await hashPassword(newPass);
        const updated = { ...user, password: newHashed };
        await db.users.put(updated);

        const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (sessionRaw) {
            try {
                const session = JSON.parse(sessionRaw);
                session.user = updated;
                session.lastActive = Date.now();
                localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
            } catch (err) { }
        }

        if (onUpdateUser) onUpdateUser(updated);

        await db.syncQueue.put({ id: `sync_p_${Date.now()}`, tableName: 'users', recordId: user.id, action: 'update', status: 'pending', createdAt: new Date() });

        showAlert.success('Berhasil!', 'Password akun Anda berhasil diubah.');
        setOldPass(''); setNewPass(''); setConfirmPass('');
        triggerSync();
    };

    return (
        <div className="max-w-md mx-auto space-y-6">
            <Card className="text-center space-y-4 py-8">
                <div className="w-20 h-20 rounded-full bg-brand-yellow text-white text-3xl flex items-center justify-center mx-auto shadow-md">{user.avatar || '👦'}</div>
                <div>
                    <h2 className="text-xl font-black text-brand-dark">{user.name}</h2>
                    <p className="text-xs font-bold text-gray-400">Username: @{user.username} • NISN: {user.nisn || '-'}</p>
                    <div className="mt-3 flex justify-center gap-2 flex-wrap">
                        <span className="px-3 py-1 bg-red-100 text-brand-red rounded-full text-xs font-bold">Kelas: {user.className || 'Belum Diatur'}</span>
                        {user.mentorName && <span className="px-3 py-1 bg-blue-100 text-brand-blue rounded-full text-xs font-bold">Guru Mentor: {user.mentorName}</span>}
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="font-black text-base text-brand-dark mb-3"><i className="fas fa-at text-brand-blue mr-1.5"></i> Ubah Username Siswa</h3>
                <form onSubmit={handleUpdateUsername} className="space-y-3 text-xs">
                    <div>
                        <label className="block font-bold text-gray-600 mb-1">Username Baru</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400 font-bold">@</span>
                            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="username_baru" className="w-full pl-7 p-2.5 bg-gray-50 border rounded-xl font-bold text-brand-dark" required />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Huruf kecil, angka, titik, atau underscore (3-20 karakter).</p>
                    </div>
                    <Button type="submit" fullWidth variant="secondary" className="py-2.5 text-xs">Simpan Username Baru</Button>
                </form>
            </Card>

            <Card>
                <h3 className="font-black text-base text-brand-dark mb-3"><i className="fas fa-key text-brand-red mr-1.5"></i> Ganti Password Siswa</h3>
                <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                    <div>
                        <label className="block font-bold text-gray-600 mb-1">Password Lama</label>
                        <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl" required />
                    </div>
                    <div>
                        <label className="block font-bold text-gray-600 mb-1">Password Baru</label>
                        <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl" required minLength="4" />
                    </div>
                    <div>
                        <label className="block font-bold text-gray-600 mb-1">Ulangi Password Baru</label>
                        <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full p-2.5 bg-gray-50 border rounded-xl" required minLength="4" />
                    </div>
                    <Button type="submit" fullWidth variant="primary" className="py-2.5 text-xs mt-2">Simpan Password Baru</Button>
                </form>
            </Card>
        </div>
    );
};
