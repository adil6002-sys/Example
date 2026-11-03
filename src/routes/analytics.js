const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

// GET /api/analytics
router.get('/', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  // 1. Total employees count
  const totalEmployees = db.prepare("SELECT COUNT(*) as count FROM employees WHERE status != 'INACTIVE'").get().count;

  // 2. Today's breakdown
  const todayRecords = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM attendance
    WHERE date = ?
    GROUP BY status
  `).all(today);

  let presentToday = 0;
  let lateToday = 0;
  let halfDayToday = 0;
  let onLeaveToday = 0;
  let absentToday = 0;

  todayRecords.forEach(r => {
    if (r.status === 'PRESENT') presentToday = r.count;
    if (r.status === 'LATE') lateToday = r.count;
    if (r.status === 'HALF_DAY') halfDayToday = r.count;
    if (r.status === 'ON_LEAVE') onLeaveToday = r.count;
    if (r.status === 'ABSENT') absentToday = r.count;
  });

  const accountedToday = presentToday + lateToday + halfDayToday + onLeaveToday + absentToday;
  if (accountedToday < totalEmployees) {
    absentToday += (totalEmployees - accountedToday);
  }

  // Attendance rate (present + late + halfday) / total
  const attendanceRate = totalEmployees > 0
    ? Math.round(((presentToday + lateToday + halfDayToday) / totalEmployees) * 100)
    : 0;

  // 3. Department-wise stats for current month
  const firstDayOfMonth = today.slice(0, 7) + '-01';
  const deptStats = db.prepare(`
    SELECT
      e.department,
      COUNT(DISTINCT e.id) as staff_count,
      SUM(CASE WHEN a.status IN ('PRESENT', 'LATE', 'HALF_DAY') THEN 1 ELSE 0 END) as attended_records,
      COUNT(a.id) as total_expected_records
    FROM employees e
    LEFT JOIN attendance a ON e.id = a.employee_id AND a.date >= ? AND a.date <= ?
    WHERE e.status != 'INACTIVE'
    GROUP BY e.department
    ORDER BY e.department ASC
  `).all(firstDayOfMonth, today);

  // 4. Daily attendance trend for last 7 active weekdays
  const dailyTrends = db.prepare(`
    SELECT
      date,
      SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late,
      SUM(CASE WHEN status = 'HALF_DAY' THEN 1 ELSE 0 END) as half_day,
      SUM(CASE WHEN status = 'ON_LEAVE' THEN 1 ELSE 0 END) as on_leave,
      SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent
    FROM attendance
    GROUP BY date
    ORDER BY date DESC
    LIMIT 10
  `).all().reverse();

  // 5. Pending leaves
  const pendingLeavesCount = db.prepare("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'PENDING'").get().count;

  res.json({
    success: true,
    data: {
      summary: {
        totalEmployees,
        presentToday,
        lateToday,
        halfDayToday,
        onLeaveToday,
        absentToday,
        attendanceRate,
        pendingLeavesCount
      },
      deptStats: deptStats.map(d => ({
        ...d,
        rate: d.total_expected_records > 0 ? Math.round((d.attended_records / d.total_expected_records) * 100) : 100
      })),
      dailyTrends
    }
  });
});

module.exports = router;
