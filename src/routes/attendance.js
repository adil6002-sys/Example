const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

// Calculate status and hours
function evaluateAttendanceStatus(clockIn, clockOut) {
  const startTimeStr = getSetting('work_start_time', '09:00');
  const graceMins = parseInt(getSetting('grace_period_mins', '15'), 10);
  const halfDayHours = parseFloat(getSetting('half_day_hours', '4.5'));

  const [startHour, startMin] = startTimeStr.split(':').map(Number);
  const thresholdMinutes = startHour * 60 + startMin + graceMins;

  const [inHour, inMin] = clockIn.split(':').map(Number);
  const inMinutes = inHour * 60 + inMin;

  let isLate = inMinutes > thresholdMinutes;
  let workHours = 0.0;
  let status = isLate ? 'LATE' : 'PRESENT';

  if (clockOut) {
    const [outHour, outMin, outSec = 0] = clockOut.split(':').map(Number);
    const [, , inSec = 0] = clockIn.split(':').map(Number);

    const totalInSec = inHour * 3600 + inMin * 60 + inSec;
    const totalOutSec = outHour * 3600 + outMin * 60 + outSec;
    const diffSec = Math.max(0, totalOutSec - totalInSec);
    workHours = Math.round((diffSec / 3600) * 10) / 10;

    if (workHours < halfDayHours && workHours > 0) {
      status = 'HALF_DAY';
    }
  }

  return { status, workHours };
}

// GET /api/attendance - List attendance records with filtering
router.get('/', (req, res) => {
  const { date, startDate, endDate, employee_id, department, status } = req.query;

  let query = `
    SELECT a.*, e.first_name, e.last_name, e.employee_code, e.department, e.role, e.avatar_url
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (date) {
    query += ' AND a.date = ?';
    params.push(date);
  } else if (startDate && endDate) {
    query += ' AND a.date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  if (employee_id) {
    query += ' AND a.employee_id = ?';
    params.push(employee_id);
  }

  if (department && department !== 'ALL') {
    query += ' AND e.department = ?';
    params.push(department);
  }

  if (status && status !== 'ALL') {
    query += ' AND a.status = ?';
    params.push(status);
  }

  query += ' ORDER BY a.date DESC, e.first_name ASC';

  const records = db.prepare(query).all(...params);
  res.json({ success: true, count: records.length, data: records });
});

// GET /api/attendance/daily-matrix - Returns status for all active employees for a given date
router.get('/daily-matrix', (req, res) => {
  const targetDate = req.query.date || new Date().toISOString().split('T')[0];

  const employees = db.prepare("SELECT * FROM employees WHERE status != 'INACTIVE' ORDER BY department, first_name").all();
  const records = db.prepare('SELECT * FROM attendance WHERE date = ?').all(targetDate);
  const recordMap = new Map(records.map(r => [r.employee_id, r]));

  const result = employees.map(emp => {
    const rec = recordMap.get(emp.id);
    return {
      employee: emp,
      attendance: rec || {
        id: null,
        employee_id: emp.id,
        date: targetDate,
        clock_in: null,
        clock_out: null,
        status: 'ABSENT',
        work_hours: 0,
        notes: null
      }
    };
  });

  res.json({ success: true, date: targetDate, data: result });
});

// POST /api/attendance/clock-in
router.post('/clock-in', (req, res) => {
  const { employee_id, date, clock_in, notes } = req.body;

  if (!employee_id) {
    return res.status(400).json({ success: false, error: 'Employee ID is required' });
  }

  const now = new Date();
  const targetDate = date || now.toISOString().split('T')[0];
  const timeStr = clock_in || now.toTimeString().split(' ')[0];

  // Check if record exists
  const existing = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, targetDate);

  if (existing && existing.clock_in) {
    return res.status(400).json({ success: false, error: 'Employee is already clocked in for this date' });
  }

  const { status, workHours } = evaluateAttendanceStatus(timeStr, null);

  let recordId;
  if (existing) {
    db.prepare(`
      UPDATE attendance
      SET clock_in = ?, status = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(timeStr, status, notes || null, existing.id);
    recordId = existing.id;
  } else {
    const result = db.prepare(`
      INSERT INTO attendance (employee_id, date, clock_in, status, work_hours, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(employee_id, targetDate, timeStr, status, workHours, notes || null);
    recordId = result.lastInsertRowid;
  }

  const record = db.prepare(`
    SELECT a.*, e.first_name, e.last_name, e.employee_code, e.department
    FROM attendance a JOIN employees e ON a.employee_id = e.id
    WHERE a.id = ?
  `).get(recordId);

  res.json({ success: true, message: 'Clocked in successfully', data: record });
});

// POST /api/attendance/clock-out
router.post('/clock-out', (req, res) => {
  const { employee_id, date, clock_out, notes } = req.body;

  if (!employee_id) {
    return res.status(400).json({ success: false, error: 'Employee ID is required' });
  }

  const now = new Date();
  const targetDate = date || now.toISOString().split('T')[0];
  const timeStr = clock_out || now.toTimeString().split(' ')[0];

  const existing = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, targetDate);

  if (!existing || !existing.clock_in) {
    return res.status(400).json({ success: false, error: 'Employee has not clocked in today' });
  }

  if (existing.clock_out) {
    return res.status(400).json({ success: false, error: 'Employee is already clocked out for today' });
  }

  const { status, workHours } = evaluateAttendanceStatus(existing.clock_in, timeStr);

  db.prepare(`
    UPDATE attendance
    SET clock_out = ?, status = ?, work_hours = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(timeStr, status, workHours, notes || null, existing.id);

  const record = db.prepare(`
    SELECT a.*, e.first_name, e.last_name, e.employee_code, e.department
    FROM attendance a JOIN employees e ON a.employee_id = e.id
    WHERE a.id = ?
  `).get(existing.id);

  res.json({ success: true, message: 'Clocked out successfully', data: record });
});

// POST /api/attendance/manual - Admin mark / update attendance
router.post('/manual', (req, res) => {
  const { employee_id, date, clock_in, clock_out, status, notes } = req.body;

  if (!employee_id || !date || !status) {
    return res.status(400).json({ success: false, error: 'Employee ID, date, and status are required' });
  }

  let computedHours = 0;
  if (clock_in && clock_out) {
    const [inH, inM] = clock_in.split(':').map(Number);
    const [outH, outM] = clock_out.split(':').map(Number);
    const diff = (outH * 60 + outM) - (inH * 60 + inM);
    computedHours = Math.max(0, Math.round((diff / 60) * 10) / 10);
  }

  const existing = db.prepare('SELECT id FROM attendance WHERE employee_id = ? AND date = ?').get(employee_id, date);

  if (existing) {
    db.prepare(`
      UPDATE attendance
      SET clock_in = ?, clock_out = ?, status = ?, work_hours = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(clock_in || null, clock_out || null, status, computedHours, notes || null, existing.id);
  } else {
    db.prepare(`
      INSERT INTO attendance (employee_id, date, clock_in, clock_out, status, work_hours, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(employee_id, date, clock_in || null, clock_out || null, status, computedHours, notes || null);
  }

  res.json({ success: true, message: 'Attendance record saved successfully' });
});

// DELETE /api/attendance/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM attendance WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Attendance record removed' });
});

module.exports = router;
