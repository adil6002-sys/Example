const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

// GET /api/export/csv
router.get('/csv', (req, res) => {
  const { startDate, endDate, department } = req.query;

  let query = `
    SELECT
      a.date,
      e.employee_code,
      e.first_name || ' ' || e.last_name as full_name,
      e.department,
      e.role,
      COALESCE(a.clock_in, '') as clock_in,
      COALESCE(a.clock_out, '') as clock_out,
      a.status,
      COALESCE(a.work_hours, 0) as work_hours,
      COALESCE(a.notes, '') as notes
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (startDate && endDate) {
    query += ' AND a.date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  if (department && department !== 'ALL') {
    query += ' AND e.department = ?';
    params.push(department);
  }

  query += ' ORDER BY a.date DESC, e.employee_code ASC';
  const rows = db.prepare(query).all(...params);

  // CSV generation
  const headers = ['Date', 'Employee Code', 'Full Name', 'Department', 'Role', 'Clock In', 'Clock Out', 'Status', 'Work Hours', 'Notes'];

  const csvRows = [headers.join(',')];

  for (const row of rows) {
    const formattedValues = [
      row.date,
      `"${row.employee_code}"`,
      `"${row.full_name}"`,
      `"${row.department}"`,
      `"${row.role}"`,
      `"${row.clock_in}"`,
      `"${row.clock_out}"`,
      row.status,
      row.work_hours,
      `"${(row.notes || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(formattedValues.join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
  res.send(csvRows.join('\n'));
});

module.exports = router;
