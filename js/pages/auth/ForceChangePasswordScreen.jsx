var ForceChangePasswordScreen = ({ user, onPasswordChanged, onLogout }) => {
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const defaultPassText = user.role === ROLES.GURU ? 'guru123' : 'siswa123';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        const cleanPass = newPass.trim();
        const cleanConfirm = confirmPass.trim();

        if (cleanPass.length < 8) {
            setErrorMsg('Kata sandi baru minimal harus 8 karakter!');
            return;
        }

        if (cleanPass === defaultPassText) {
            setErrorMsg(`Kata sandi baru tidak boleh sama dengan kata sandi bawaan ("${defaultPassText}")!`);
            return;
        }

        if (cleanPass !== cleanConfirm) {
            setErrorMsg('Konfirmasi kata sandi baru tidak cocok!');
            return;
        }

        setIsSubmitting(true);
        try {
            const hashedNewPass = await hashPassword(cleanPass);
            const updatedUser = {
                ...user,
                password: hashedNewPass,
                updatedAt: new Date()
            };

            await db.users.put(updatedUser);

            await db.syncQueue.put({
                id: `sync_force_pass_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                tableName: 'users',
                recordId: user.id,
                action: 'update',
                status: 'pending',
                createdAt: new Date()
            });

            const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
            if (sessionRaw) {
                try {
                    const session = JSON.parse(sessionRaw);
                    session.user = updatedUser;
                    session.lastActive = Date.now();
                    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
                } catch (err) { }
            }

            showAlert.success('Kata Sandi Diperbarui!', 'Kata sandi akun Anda berhasil diubah. Selamat melanjutkan!');
            onPasswordChanged(updatedUser);
        } catch (err) {
            setErrorMsg('Gagal memperbarui kata sandi: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-6 sm:p-8 space-y-6 shadow-2xl border-2 border-red-200">
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-red-100 text-brand-red rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
                        <i className="fas fa-user-lock"></i>
                    </div>
                    <h2 className="text-xl font-black text-brand-dark">Wajib Ubah Kata Sandi</h2>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                        Halo <b>{user.name}</b> (@{user.username}), akun Anda masih menggunakan kata sandi bawaan (<code>{defaultPassText}</code>). Demi keamanan akun, Anda diwajibkan membuat kata sandi baru sebelum mengakses dashboard.
                    </p>
                </div>

                {errorMsg && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-brand-red text-xs font-bold flex items-center gap-2">
                        <i className="fas fa-exclamation-circle text-base shrink-0"></i>
                        <span>{errorMsg}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    <div>
                        <label className="block font-bold text-gray-700 mb-1">
                            Kata Sandi Baru <span className="text-brand-red">* (Min. 8 karakter)</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showPass ? "text" : "password"}
                                value={newPass}
                                onChange={e => setNewPass(e.target.value)}
                                placeholder="Minimal 8 karakter..."
                                className="w-full p-3 pr-10 bg-gray-50 border rounded-xl font-semibold focus:ring-2 focus:ring-brand-red outline-none text-sm"
                                required
                                minLength={8}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <i className={`fas ${showPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block font-bold text-gray-700 mb-1">
                            Ulangi Kata Sandi Baru <span className="text-brand-red">*</span>
                        </label>
                        <input
                            type={showPass ? "text" : "password"}
                            value={confirmPass}
                            onChange={e => setConfirmPass(e.target.value)}
                            placeholder="Ketik ulang kata sandi baru..."
                            className="w-full p-3 bg-gray-50 border rounded-xl font-semibold focus:ring-2 focus:ring-brand-red outline-none text-sm"
                            required
                            minLength={8}
                        />
                    </div>

                    <div className="pt-2 space-y-2">
                        <Button type="submit" fullWidth disabled={isSubmitting} variant="primary" className="py-3 text-sm">
                            {isSubmitting ? (
                                <span><i className="fas fa-spinner fa-spin mr-2"></i> Menyimpan...</span>
                            ) : (
                                <span><i className="fas fa-shield-alt mr-2"></i> Simpan & Lanjutkan ke Dashboard</span>
                            )}
                        </Button>

                        <button
                            type="button"
                            onClick={() => onLogout(false)}
                            className="w-full text-center text-xs font-bold text-gray-400 hover:text-gray-600 py-1 transition-colors"
                        >
                            <i className="fas fa-sign-out-alt mr-1"></i> Keluar / Ganti Akun
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
