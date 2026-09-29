async function pushPendingQueue() {
    if (!navigator.onLine || !GAS_API_URL || GAS_API_URL.includes("MASUKKAN_URL")) return false;

    const pendingQueue = await db.syncQueue.where('status').equals('pending').toArray();
    if (pendingQueue.length === 0) return false;

    try {
        const habitUpsertIds = pendingQueue.filter(q => q.tableName === 'habitLogs' && q.action !== 'delete').map(q => q.recordId);
        if (habitUpsertIds.length > 0) {
            const logs = await db.habitLogs.bulkGet(habitUpsertIds);
            const validLogs = logs.filter(Boolean);
            if (validLogs.length > 0) {
                await fetch(GAS_API_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'syncHabits', payload: validLogs })
                });
            }
        }

        const userUpsertIds = pendingQueue.filter(q => q.tableName === 'users' && q.action !== 'delete').map(q => q.recordId);
        if (userUpsertIds.length > 0) {
            const users = await db.users.bulkGet(userUpsertIds);
            const validUsers = users.filter(Boolean);
            if (validUsers.length > 0) {
                await fetch(GAS_API_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'syncUser', payload: validUsers })
                });
            }
        }

        const classUpsertIds = pendingQueue.filter(q => q.tableName === 'classes' && q.action !== 'delete').map(q => q.recordId);
        if (classUpsertIds.length > 0) {
            const classes = await db.classes.bulkGet(classUpsertIds);
            const validClasses = classes.filter(Boolean);
            if (validClasses.length > 0) {
                await fetch(GAS_API_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'syncClass', payload: validClasses })
                });
            }
        }

        const journalUpsertIds = pendingQueue.filter(q => q.tableName === 'journals' && q.action !== 'delete').map(q => q.recordId);
        if (journalUpsertIds.length > 0) {
            const journals = await db.journals.bulkGet(journalUpsertIds);
            const validJournals = journals.filter(Boolean);
            if (validJournals.length > 0) {
                await fetch(GAS_API_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'syncJournal', payload: validJournals })
                });
            }
        }

        const habitConfigIds = pendingQueue.filter(q => q.tableName === 'habits' && q.action !== 'delete').map(q => q.recordId);
        if (habitConfigIds.length > 0) {
            const habitConfigs = await db.habits.bulkGet(habitConfigIds);
            const validConfigs = habitConfigs.filter(Boolean);
            if (validConfigs.length > 0) {
                await fetch(GAS_API_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'syncHabitConfig', payload: validConfigs })
                });
            }
        }

        const deleteItems = pendingQueue.filter(q => q.action === 'delete');
        const deletesByTable = { habitLogs: [], users: [], classes: [], journals: [] };
        deleteItems.forEach(d => {
            if (deletesByTable[d.tableName]) deletesByTable[d.tableName].push(d.recordId);
        });

        if (deletesByTable.habitLogs.length > 0) {
            await fetch(GAS_API_URL, {
                method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'deleteHabitLogs', payload: deletesByTable.habitLogs })
            });
        }
        if (deletesByTable.users.length > 0) {
            await fetch(GAS_API_URL, {
                method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'deleteUsers', payload: deletesByTable.users })
            });
        }
        if (deletesByTable.classes.length > 0) {
            await fetch(GAS_API_URL, {
                method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'deleteClasses', payload: deletesByTable.classes })
            });
        }
        if (deletesByTable.journals.length > 0) {
            await fetch(GAS_API_URL, {
                method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'deleteJournals', payload: deletesByTable.journals })
            });
        }

        await db.syncQueue.where('status').equals('pending').delete();
        return true;
    } catch (err) {
        console.error("Push queue error:", err);
        return false;
    }
}
