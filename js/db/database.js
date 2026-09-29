var db = new Dexie('SevenHabitsWitaDB');
db.version(2).stores({
    users: 'id, username, role, password, phone, classId, mentorId, nisn, nip, gender, status',
    classes: 'id, name, teacherId',
    habits: 'id, name, active',
    habitLogs: 'id, userId, habitId, date, completed, timeValue, detailValue, studentName, className, syncStatus',
    points: 'id, userId, totalPoints',
    streaks: 'userId, currentStreak, longestStreak',
    journals: 'id, userId, date, teacherFeedback, syncStatus',
    syncQueue: 'id, tableName, recordId, action, status, createdAt'
});
