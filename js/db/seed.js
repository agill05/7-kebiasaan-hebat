async function seedDatabaseClean() {
    try {
        const habitCount = await db.habits.count();
        if (habitCount === 0) await db.habits.bulkPut(HABITS_CONFIG);

        const adminCount = await db.users.where('role').equals(ROLES.ADMIN).count();
        if (adminCount === 0) {
            await db.users.put({
                id: 'u_admin_default',
                username: 'admin',
                name: 'Administrator Talaga Jaya',
                role: ROLES.ADMIN,
                password: 'admin',
                phone: '',
                avatar: '⚙️',
                status: 'Aktif',
                createdAt: new Date()
            });
        }
    } catch (err) {
        console.error("Master DB Seed notice:", err);
    }
}
