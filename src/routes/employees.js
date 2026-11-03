const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

// GET /api/employees - list with optional search and department filter
router.get('/', (req, res) => {
  const { search, department, status } = req.query;
  let query = 'SELECT * FROM employees WHERE 1=1';
  const params = [];

  if (search) {
    query += ` AND (first_name LIKE ? OR last_name LIKE ? OR employee_code LIKE ? OR email LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (department && department !== 'ALL') {
    query += ' AND department = ?';
    params.push(department);
  }

  if (status && status !== 'ALL') {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY id ASC';
  const employees = db.prepare(query).all(...params);
  res.json({ success: true, count: employees.length, data: employees });
});

// GET /api/employees/departments
router.get('/departments', (req, res) => {
  const depts = db.prepare('SELECT DISTINCT department FROM employees ORDER BY department').all().map(d => d.department);
  res.json({ success: true, data: depts });
});

// GET /api/employees/:id
router.get('/:id', (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!employee) {
    return res.status(404).json({ success: false, error: 'Employee not found' });
  }
  res.json({ success: true, data: employee });
});

// POST /api/employees
router.post('/', (req, res) => {
  const { employee_code, first_name, last_name, email, phone, department, role, status, avatar_url } = req.body;

  if (!employee_code || !first_name || !last_name || !email || !department || !role) {
    return res.status(400).json({ success: false, error: 'Missing required fields (code, name, email, department, role)' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO employees (employee_code, first_name, last_name, email, phone, department, role, status, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      employee_code.trim(),
      first_name.trim(),
      last_name.trim(),
      email.trim().toLowerCase(),
      phone || null,
      department.trim(),
      role.trim(),
      status || 'ACTIVE',
      avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(first_name + ' ' + last_name)}&background=random`
    );

    const newEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: newEmployee });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, error: 'Employee code or email already exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/employees/:id
router.put('/:id', (req, res) => {
  const { first_name, last_name, email, phone, department, role, status, avatar_url } = req.body;
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);

  if (!employee) {
    return res.status(404).json({ success: false, error: 'Employee not found' });
  }

  try {
    const stmt = db.prepare(`
      UPDATE employees
      SET first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          department = COALESCE(?, department),
          role = COALESCE(?, role),
          status = COALESCE(?, status),
          avatar_url = COALESCE(?, avatar_url)
      WHERE id = ?
    `);

    stmt.run(
      first_name ? first_name.trim() : null,
      last_name ? last_name.trim() : null,
      email ? email.trim().toLowerCase() : null,
      phone !== undefined ? phone : null,
      department ? department.trim() : null,
      role ? role.trim() : null,
      status || null,
      avatar_url || null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/employees/:id
router.delete('/:id', (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!employee) {
    return res.status(404).json({ success: false, error: 'Employee not found' });
  }

  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Employee deleted successfully' });
});

module.exports = router;
