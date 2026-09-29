async function hashPassword(text) {
    if (!text) return '';
    const msgBuffer = new TextEncoder().encode(String(text).trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function promptResetPassword(targetUser, defaultPass = 'siswa123') {
    const { value: newPasswordResult } = await Swal.fire({
        title: `Reset Kata Sandi`,
        html: `
            <div class="text-left text-xs space-y-3 pt-2 text-gray-700">
                <p class="leading-relaxed">Mereset kata sandi akun <b>${targetUser.name}</b> (@${targetUser.username}):</p>
                <div>
                    <label class="block font-bold text-gray-600 mb-1">Opsi Kata Sandi Baru:</label>
                    <select id="swal-reset-type" class="w-full p-2.5 bg-gray-50 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-red">
                        <option value="default">Reset ke Kata Sandi Standar ("${defaultPass}")</option>
                        <option value="custom">Tentukan Kata Sandi Baru (Kustom)</option>
                    </select>
                </div>
                <div id="swal-custom-pass-container" style="display:none;">
                    <label class="block font-bold text-gray-600 mb-1">Ketik Kata Sandi Baru:</label>
                    <input id="swal-custom-pass" type="text" placeholder="Minimal 4 karakter" class="w-full p-2.5 bg-gray-50 border rounded-xl text-xs font-bold text-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red" />
                </div>
            </div>
        `,
        didOpen: () => {
            const resetType = document.getElementById('swal-reset-type');
            const customContainer = document.getElementById('swal-custom-pass-container');
            const customInput = document.getElementById('swal-custom-pass');
            resetType.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    customContainer.style.display = 'block';
                    customInput.focus();
                } else {
                    customContainer.style.display = 'none';
                }
            });
        },
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280',
        confirmButtonText: '🔑 Terapkan Reset',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5', cancelButton: 'rounded-xl font-bold px-5 py-2.5' },
        preConfirm: () => {
            const type = document.getElementById('swal-reset-type').value;
            const customVal = document.getElementById('swal-custom-pass').value.trim();
            if (type === 'custom') {
                if (!customVal || customVal.length < 4) {
                    Swal.showValidationMessage('Kata sandi baru minimal 4 karakter!');
                    return false;
                }
                return customVal;
            }
            return defaultPass;
        }
    });

    if (newPasswordResult) {
        const newPlainPass = newPasswordResult;
        const hashedPass = await hashPassword(newPlainPass);
        const updatedUser = { ...targetUser, password: hashedPass, updatedAt: new Date() };

        await db.users.put(updatedUser);
        await db.syncQueue.put({
            id: `sync_reset_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            tableName: 'users',
            recordId: targetUser.id,
            action: 'update',
            status: 'pending',
            createdAt: new Date()
        });

        await Swal.fire({
            icon: 'success',
            title: 'Kata Sandi Berhasil Direset!',
            html: `
                <div class="text-sm text-gray-700 space-y-2 pt-1">
                    <p>Kata sandi untuk <b>${targetUser.name}</b> (@${targetUser.username}) berhasil diubah menjadi:</p>
                    <div class="p-3 bg-red-50 border border-red-200 rounded-xl font-mono text-lg font-black text-brand-red select-all tracking-wider">
                        ${newPlainPass}
                    </div>
                    <p class="text-xs text-gray-400">Silakan sampaikan kata sandi baru ini kepada pengguna bersangkutan.</p>
                </div>
            `,
            confirmButtonColor: '#EF4444',
            confirmButtonText: 'Selesai',
            customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl font-bold px-5 py-2.5' }
        });

        return true;
    }
    return false;
}
