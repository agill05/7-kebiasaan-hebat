var LoginPage = ({ onLogin, triggerManualPull }) => {
    const [users, setUsers] = useState([]);
    const [selectedRole, setSelectedRole] = useState(ROLES.SISWA);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [inputPassword, setInputPassword] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSyncingCloud, setIsSyncingCloud] = useState(false);
    const selectedRoleRef = useRef(selectedRole);

    useEffect(() => {
        selectedRoleRef.current = selectedRole;
    }, [selectedRole]);

    const loadUsers = async () => {
        const activeRole = selectedRoleRef.current;
        const res = await db.users.where('role').equals(activeRole).toArray();

        // Hanya set data jika role target masih sesuai dengan pilihan di layar
        if (activeRole === selectedRoleRef.current) {
            setUsers(res);
        }
    };

    useEffect(() => {
        selectedRoleRef.current = selectedRole;
        loadUsers();
        setInputPassword('');
        setSearchQuery('');
        setShowPassword(false);
    }, [selectedRole]);

    useEffect(() => {
        loadUsers();
        if (navigator.onLine) {
            setIsSyncingCloud(true);
            pullAllCloudData()
                .then(() => loadUsers())
                .finally(() => setIsSyncingCloud(false));
        }
    }, []);

    const filteredUsers = useMemo(() => {
        if (selectedRole === ROLES.ADMIN) return users;
        const q = searchQuery.toLowerCase().trim();
        if (!q) return users;
        return users.filter(u =>
            (u.name && u.name.toLowerCase().includes(q)) ||
            (u.username && u.username.toLowerCase().includes(q)) ||
            (u.nisn && u.nisn.includes(q)) ||
            (u.nip && u.nip.includes(q))
        );
    }, [users, searchQuery, selectedRole]);

    useEffect(() => {
        if (filteredUsers.length > 0) {
            if (!filteredUsers.some(u => u.id === selectedUserId)) {
                setSelectedUserId(filteredUsers[0].id);
            }
        } else {
            setSelectedUserId('');
        }
    }, [filteredUsers, selectedUserId]);

    const handleForgotPassword = () => {
        if (selectedRole === ROLES.SISWA) {
            Swal.fire({
                icon: 'info',
                title: 'Lupa Kata Sandi?',
                html: `
                    <div class="text-left text-xs space-y-2.5 text-gray-700 pt-2 leading-relaxed">
                        <p>Silakan hubungi <b>Guru Wali Kelas</b> atau <b>Guru Pembimbing / Mentor</b> Anda.</p>
                        <p class="bg-red-50 p-2.5 rounded-xl border border-red-200 text-brand-red font-medium">
                            💡 Guru Anda dapat langsung mereset kata sandi akun Anda melalui tombol <b>Reset Sandi</b> pada panel guru.
                        </p>
                    </div>
                `,
                confirmButtonColor: '#EF4444',
                confirmButtonText: 'Saya Mengerti',
                customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5' }
            });
        } else if (selectedRole === ROLES.GURU) {
            Swal.fire({
                icon: 'info',
                title: 'Lupa Kata Sandi Guru?',
                html: `
                    <div class="text-left text-xs space-y-2.5 text-gray-700 pt-2 leading-relaxed">
                        <p>Silakan hubungi <b>Administrator Sistem Sekolah</b> untuk mereset kata sandi akun Guru Anda.</p>
                        <p class="bg-blue-50 p-2.5 rounded-xl border border-blue-200 text-brand-blue font-medium">
                            💡 Administrator dapat mereset sandi Anda ke kata sandi standar (<code>guru123</code>) atau sandi kustom.
                        </p>
                    </div>
                `,
                confirmButtonColor: '#EF4444',
                confirmButtonText: 'Saya Mengerti',
                customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5' }
            });
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Lupa Sandi Administrator?',
                html: `
                    <div class="text-left text-xs space-y-2 text-gray-700 pt-2 leading-relaxed">
                        <p>Kata sandi bawaan Super Admin adalah <code>admin</code>.</p>
                        <p>Jika telah diubah dan Anda lupa, silakan periksa lembar spreadsheet <b>Users</b> pada Google Sheets backend.</p>
                    </div>
                `,
                confirmButtonColor: '#EF4444',
                confirmButtonText: 'Saya Mengerti',
                customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5' }
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedUserId) return showAlert.warning('Perhatian', 'Pilih akun Anda!');
        const user = await db.users.get(selectedUserId);
        if (!user) return showAlert.error('Gagal', 'Akun tidak ditemukan!');

        const typedPassword = String(inputPassword).trim();
        if (user.role === ROLES.ADMIN) {
            if (typedPassword !== String(user.password || 'admin').trim()) return showAlert.error('Akses Ditolak', 'Password salah!');
        } else {
            const inputHashed = await hashPassword(typedPassword);
            const defaultPass = user.role === ROLES.GURU ? 'guru123' : 'siswa123';
            const expectedHashed = user.password ? String(user.password).trim() : await hashPassword(defaultPass);
            if (inputHashed !== expectedHashed) return showAlert.error('Password Salah', 'Kata sandi yang Anda masukkan salah!');
        }
        onLogin(user);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-6 space-y-5">
                <div className="text-center">
                    <div className="text-3xl mb-1">🇮🇩</div>
                    <h2 className="text-lg font-black text-brand-dark">{SCHOOL_IDENTITY.name}</h2>
                    <p className="text-xs text-gray-400 font-bold">Masuk Sistem Pembiasaan Karakter</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { role: ROLES.SISWA, label: 'Siswa', icon: '👦' },
                        { role: ROLES.GURU, label: 'Guru', icon: '👨‍🏫' },
                        { role: ROLES.ADMIN, label: 'Admin', icon: '⚙️' }
                    ].map(r => (
                        <button key={r.role} type="button" onClick={() => setSelectedRole(r.role)} className={`p-3 rounded-xl flex flex-col items-center border-2 text-xs font-bold transition-all ${selectedRole === r.role ? 'border-brand-red bg-red-50 text-brand-red' : 'border-gray-100 text-gray-500'}`}>
                            <span className="text-xl mb-1">{r.icon}</span>
                            {r.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center justify-between">
                            <span>Pilih Nama Pengguna:</span>
                            {isSyncingCloud && (
                                <span className="text-[10px] text-brand-blue font-semibold flex items-center gap-1 animate-pulse">
                                    <i className="fas fa-spinner fa-spin"></i> Menyinkronkan...
                                </span>
                            )}
                        </label>
                        {selectedRole !== ROLES.ADMIN && users.length > 0 && (
                            <div className="relative mb-2">
                                <i className="fas fa-search absolute left-3.5 top-3 text-gray-400 text-xs"></i>
                                <input
                                    type="text"
                                    placeholder={`Ketik nama atau username ${selectedRole}...`}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-red outline-none"
                                />
                            </div>
                        )}
                        {users.length === 0 ? (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold text-center">
                                Belum ada akun {selectedRole}. Lakukan sync awal atau login sebagai Admin.
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-brand-red text-xs font-semibold text-center">
                                Tidak ada akun {selectedRole} dengan kata kunci "{searchQuery}".
                            </div>
                        ) : (
                            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-semibold">
                                {filteredUsers.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} (@{u.username}){u.role === ROLES.SISWA && u.className ? ` - ${u.className}` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-gray-600">Kata Sandi:</label>
                            <button type="button" onClick={handleForgotPassword} className="text-[11px] font-bold text-brand-red hover:underline transition-colors">
                                Lupa Kata Sandi?
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={inputPassword}
                                onChange={e => setInputPassword(e.target.value)}
                                placeholder="Masukkan kata sandi..."
                                className="w-full p-3 pr-11 bg-gray-50 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-red outline-none"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 focus:outline-none transition-colors"
                                title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                            >
                                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                            </button>
                        </div>
                    </div>
                    <Button type="submit" fullWidth disabled={!selectedUserId || filteredUsers.length === 0}>Masuk Sistem</Button>
                </form>
            </Card>
        </div>
    );
};
