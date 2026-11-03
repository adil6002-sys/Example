const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

// GET /api/leaves
router.get('/', (req, res) => {
  const { status, employee_id } = req.query;
  let query = `
    SELECT l.*, e.first_name, e.last_name, e.employee_code, e.department, e.role
    FROM leave_requests l
    JOIN employees e ON l.employee_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'ALL') {
    query += ' AND l.status = ?';
    params.push(status);
  }

  if (employee_id) {
    query += ' AND l.employee_id = ?';
    params.push(employee_id);
  }

  query += ' ORDER BY l.created_at DESC';
  const requests = db.prepare(query).all(...params);
  res.json({ success: true, count: requests.length, data: requests });
});

// POST /api/leaves
router.post('/', (req, res) => {
  const { employee_id, leave_type, start_date, end_date, reason } = req.body;

  if (!employee_id || !leave_type || !start_date || !end_date) {
    return res.status(400).json({ success: false, error: 'Employee, leave type, start date, and end date are required' });
  }

  const stmt = db.prepare(`
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
    VALUES (?, ?, ?, ?, ?, 'PENDING')
  `);

  const result = stmt.run(employee_id, leave_type, start_date, end_date, reason || null);
  const created = db.prepare(`
    SELECT l.*, e.first_name, e.last_name, e.employee_code, e.department
    FROM leave_requests l JOIN employees e ON l.employee_id = e.id
    WHERE l.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ success: true, data: created });
});

// PATCH /api/leaves/:id/status - Approve or reject leave
router.patch('/:id/status', (req, res) => {
  const { status, admin_comments } = req.body;

  if (!status || !['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Valid status (APPROVED, REJECTED, PENDING) is required' });
  }

  const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id);
  if (!leave) {
    return res.status(404).json({ success: false, error: 'Leave request not found' });
  }

  db.prepare(`
    UPDATE leave_requests
    SET status = ?, admin_comments = COALESCE(?, admin_comments), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, admin_comments || null, req.params.id);

  // If approved, synchronize attendance table for those dates
  if (status === 'APPROVED') {
    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    const curr = new Date(start);

    const upsertAttendance = db.prepare(`
      INSERT INTO attendance (employee_id, date, status, notes)
      VALUES (?, ?, 'ON_LEAVE', ?)
      ON CONFLICT(employee_id, date) DO UPDATE SET
        status = 'ON_LEAVE',
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `);

    while (curr <= end) {
      const day = curr.getDay();
      if (day !== 0 && day !== 6) { // Weekdays only
        const dateStr = curr.toISOString().split('T')[0];
        upsertAttendance.run(leave.employee_id, dateStr, `Approved ${leave.leave_type} Leave`);
      }
      curr.setDate(curr.getDate() + 1);
    }
  }

  const updated = db.prepare(`
    SELECT l.*, e.first_name, e.last_name, e.employee_code, e.department
    FROM leave_requests l JOIN employees e ON l.employee_id = e.id
    WHERE l.id = ?
  `).get(req.params.id);

  res.json({ success: true, data: updated });
});

module.exports = router;
