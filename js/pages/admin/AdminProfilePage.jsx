var AdminProfilePage = ({ user, onUpdateAdmin, triggerSync }) => {
    const [username, setUsername] = useState(user.username || 'admin');
    const [password, setPassword] = useState(user.password || 'admin');
    const [phone, setPhone] = useState(user.phone || '');

    const handleSave = async (e) => {
        e.preventDefault();
        const updated = { ...user, username: username.trim(), password: password.trim(), phone: phone.trim() };
        await db.users.put(updated);
        onUpdateAdmin(updated);
        await db.syncQueue.put({ id: `sync_adm_${Date.now()}`, tableName: 'users', recordId: user.id, action: 'update', status: 'pending', createdAt: new Date() });
        showAlert.success('Disimpan!', 'Kredensial Admin berhasil diperbarui.');
        triggerSync();
    };

    return (
        <div className="max-w-md mx-auto space-y-6">
            <Card className="text-center space-y-4 py-8">
                <div className="w-20 h-20 rounded-full bg-brand-dark text-white text-3xl flex items-center justify-center mx-auto shadow-md">⚙️</div>
                <div>
                    <h2 className="text-xl font-black text-brand-dark">{user.name}</h2>
                    <p className="text-xs font-bold text-brand-red">Super Administrator Sistem</p>
                </div>
            </Card>

            <Card>
                <h3 className="font-black text-base text-brand-dark mb-3"><i className="fas fa-user-cog mr-1 text-brand-blue"></i> Pengaturan Akun Admin</h3>
                <form onSubmit={handleSave} className="space-y-3 text-xs">
                    <input type="text" placeholder="Username Admin" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold" required />
                    <input type="text" placeholder="Password Admin" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold text-brand-red" required />
                    <input type="text" placeholder="Nomor Telepon" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2.5 border rounded-xl font-bold" />
                    <Button type="submit" fullWidth variant="primary" className="py-2.5 text-xs mt-2">Simpan Akun Admin</Button>
                </form>
            </Card>
        </div>
    );
};
