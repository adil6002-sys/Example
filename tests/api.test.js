const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Use an isolated test database
const TEST_DB = path.join(__dirname, 'test_attendance.db');
process.env.DB_PATH = TEST_DB;

if (fs.existsSync(TEST_DB)) {
  fs.unlinkSync(TEST_DB);
}

const { seed } = require('../src/db/seed');
const app = require('../src/app');

test.before(() => {
  seed();
});

test.after(() => {
  if (fs.existsSync(TEST_DB)) {
    try { fs.unlinkSync(TEST_DB); } catch (e) {}
  }
});

test('GET /api/health returns ok status', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.ok(res.body.timestamp);
});

test('Employees CRUD API', async (t) => {
  let createdEmpId;

  await t.test('POST /api/employees - creates a new employee', async () => {
    const newEmp = {
      employee_code: 'TEST-999',
      first_name: 'Test',
      last_name: 'User',
      email: 'test.user@techvision.com',
      department: 'Engineering',
      role: 'QA Engineer',
      phone: '+1-555-9999'
    };

    const res = await request(app).post('/api/employees').send(newEmp);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.employee_code, 'TEST-999');
    assert.strictEqual(res.body.data.role, 'QA Engineer');
    createdEmpId = res.body.data.id;
  });

  await t.test('POST /api/employees - prevents duplicate code/email', async () => {
    const dupEmp = {
      employee_code: 'TEST-999',
      first_name: 'Dup',
      last_name: 'User',
      email: 'test.user@techvision.com',
      department: 'Engineering',
      role: 'QA Engineer'
    };

    const res = await request(app).post('/api/employees').send(dupEmp);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  await t.test('GET /api/employees/:id - returns the created employee', async () => {
    const res = await request(app).get(`/api/employees/${createdEmpId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.first_name, 'Test');
  });

  await t.test('PUT /api/employees/:id - updates employee details', async () => {
    const res = await request(app)
      .put(`/api/employees/${createdEmpId}`)
      .send({ role: 'Senior QA Automation Engineer' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.role, 'Senior QA Automation Engineer');
  });

  await t.test('DELETE /api/employees/:id - deletes the employee', async () => {
    const res = await request(app).delete(`/api/employees/${createdEmpId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const getRes = await request(app).get(`/api/employees/${createdEmpId}`);
    assert.strictEqual(getRes.status, 404);
  });
});

test('Attendance Clock In / Out & Late evaluation', async (t) => {
  const testDate = '2026-11-01';

  await t.test('POST /api/attendance/clock-in - on-time clock-in marks PRESENT', async () => {
    const res = await request(app).post('/api/attendance/clock-in').send({
      employee_id: 1,
      date: testDate,
      clock_in: '08:50:00'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'PRESENT');
  });

  await t.test('POST /api/attendance/clock-out - calculates correct work hours', async () => {
    const res = await request(app).post('/api/attendance/clock-out').send({
      employee_id: 1,
      date: testDate,
      clock_out: '17:50:00'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.work_hours, 9);
    assert.strictEqual(res.body.data.status, 'PRESENT');
  });

  await t.test('POST /api/attendance/clock-in - late clock-in past grace period marks LATE', async () => {
    const lateDate = '2026-11-02';
    const res = await request(app).post('/api/attendance/clock-in').send({
      employee_id: 2,
      date: lateDate,
      clock_in: '09:35:00' // Shift starts at 09:00 with 15m grace period
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'LATE');
  });

  await t.test('POST /api/attendance/manual - admin manual attendance override', async () => {
    const manualDate = '2026-11-04';
    const res = await request(app).post('/api/attendance/manual').send({
      employee_id: 3,
      date: manualDate,
      clock_in: '09:00',
      clock_out: '13:00',
      status: 'HALF_DAY',
      notes: 'Doctor appointment afternoon'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });
});

test('Leave Request Workflow', async (t) => {
  let leaveId;

  await t.test('POST /api/leaves - creates a pending leave request', async () => {
    const res = await request(app).post('/api/leaves').send({
      employee_id: 1,
      leave_type: 'ANNUAL',
      start_date: '2026-12-01',
      end_date: '2026-12-03',
      reason: 'Winter vacation'
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.status, 'PENDING');
    assert.strictEqual(res.body.data.employee_id, 1);
    leaveId = res.body.data.id;
  });

  await t.test('PATCH /api/leaves/:id/status - approves leave and synchronizes attendance', async () => {
    const res = await request(app).patch(`/api/leaves/${leaveId}/status`).send({
      status: 'APPROVED',
      admin_comments: 'Approved by HR manager'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'APPROVED');

    // Verify attendance was updated for that day
    const attRes = await request(app).get('/api/attendance').query({
      employee_id: 1,
      date: '2026-12-01'
    });
    assert.strictEqual(attRes.status, 200);
    assert.ok(attRes.body.data.length > 0);
    assert.strictEqual(attRes.body.data[0].status, 'ON_LEAVE');
  });
});

test('Analytics and CSV Export APIs', async (t) => {
  await t.test('GET /api/analytics - provides complete summary and department metrics', async () => {
    const res = await request(app).get('/api/analytics');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.data.summary.totalEmployees === 'number');
    assert.ok(Array.isArray(res.body.data.deptStats));
    assert.ok(Array.isArray(res.body.data.dailyTrends));
  });

  await t.test('GET /api/export/csv - exports formatted CSV report', async () => {
    const res = await request(app).get('/api/export/csv');
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.text, /Date,Employee Code,Full Name,Department/);
  });
});
