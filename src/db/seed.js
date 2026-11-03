const { db } = require('./database');

function seed() {
  console.log('Seeding Attendance Management System database...');

  // Clear existing data for fresh seed
  db.exec(`
    DELETE FROM attendance;
    DELETE FROM leave_requests;
    DELETE FROM employees;
    DELETE FROM departments;
  `);

  const departments = [
    { name: 'Engineering', description: 'Software architecture, frontend, backend and QA' },
    { name: 'Product & Design', description: 'Product management and UI/UX design' },
    { name: 'Human Resources', description: 'People operations, recruitment, and culture' },
    { name: 'Sales & Marketing', description: 'Client acquisition, growth and marketing' },
    { name: 'Finance & Operations', description: 'Accounting, finance and office operations' }
  ];

  const insertDept = db.prepare('INSERT INTO departments (name, description) VALUES (@name, @description)');
  for (const dept of departments) {
    insertDept.run(dept);
  }

  const employees = [
    {
      employee_code: 'EMP-001',
      first_name: 'Alex',
      last_name: 'Rivera',
      email: 'alex.rivera@techvision.com',
      phone: '+1-555-0101',
      department: 'Engineering',
      role: 'Lead Architect',
      status: 'ACTIVE',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
    },
    {
      employee_code: 'EMP-002',
      first_name: 'Elena',
      last_name: 'Rostova',
      email: 'elena.rostova@techvision.com',
      phone: '+1-555-0102',
      department: 'Engineering',
      role: 'Senior Fullstack Engineer',
      status: 'ACTIVE',
      avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'
    },
    {
      employee_code: 'EMP-003',
      first_name: 'Marcus',
      last_name: 'Vance',
      email: 'marcus.vance@techvision.com',
      phone: '+1-555-0103',
      department: 'Product & Design',
      role: 'Product Lead',
      status: 'ACTIVE',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
    },
    {
      employee_code: 'EMP-004',
      first_name: 'Sarah',
      last_name: 'Chen',
      email: 'sarah.chen@techvision.com',
      phone: '+1-555-0104',
      department: 'Product & Design',
      role: 'Senior UX Designer',
      status: 'ACTIVE',
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'
    },
    {
      employee_code: 'EMP-005',
      first_name: 'David',
      last_name: 'Kim',
      email: 'david.kim@techvision.com',
      phone: '+1-555-0105',
      department: 'Human Resources',
      role: 'HR Director',
      status: 'ACTIVE',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
    },
    {
      employee_code: 'EMP-006',
      first_name: 'Amara',
      last_name: 'Diallo',
      email: 'amara.diallo@techvision.com',
      phone: '+1-555-0106',
      department: 'Sales & Marketing',
      role: 'Marketing Lead',
      status: 'ACTIVE',
      avatar_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150'
    },
    {
      employee_code: 'EMP-007',
      first_name: 'Jordan',
      last_name: 'Taylor',
      email: 'jordan.taylor@techvision.com',
      phone: '+1-555-0107',
      department: 'Sales & Marketing',
      role: 'Sales Representative',
      status: 'ACTIVE',
      avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150'
    },
    {
      employee_code: 'EMP-008',
      first_name: 'Chloe',
      last_name: 'Dubois',
      email: 'chloe.dubois@techvision.com',
      phone: '+1-555-0108',
      department: 'Finance & Operations',
      role: 'Operations Analyst',
      status: 'ACTIVE',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'
    }
  ];

  const insertEmp = db.prepare(`
    INSERT INTO employees (employee_code, first_name, last_name, email, phone, department, role, status, avatar_url)
    VALUES (@employee_code, @first_name, @last_name, @email, @phone, @department, @role, @status, @avatar_url)
  `);

  const empIds = [];
  for (const emp of employees) {
    const info = insertEmp.run(emp);
    empIds.push(info.lastInsertRowid);
  }

  // Seed attendance for today and past 14 days
  const insertAttendance = db.prepare(`
    INSERT INTO attendance (employee_id, date, clock_in, clock_out, status, work_hours, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();

  // Format date helper: YYYY-MM-DD
  const formatDate = (d) => d.toISOString().split('T')[0];

  for (let i = 14; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Skip weekends
      continue;
    }
    const dateStr = formatDate(d);

    empIds.forEach((empId, index) => {
      // Today (i === 0) has specific live records
      if (i === 0) {
        if (index === 0) {
          // Alex Rivera: Present, checked in on time
          insertAttendance.run(empId, dateStr, '08:52:10', '17:35:40', 'PRESENT', 8.7, 'On-time arrival');
        } else if (index === 1) {
          // Elena Rostova: Present, currently clocked in
          insertAttendance.run(empId, dateStr, '09:04:15', null, 'PRESENT', 0, 'Morning standup attended');
        } else if (index === 2) {
          // Marcus Vance: Late arrival
          insertAttendance.run(empId, dateStr, '09:42:00', null, 'LATE', 0, 'Traffic delay on transit');
        } else if (index === 3) {
          // Sarah Chen: Half day
          insertAttendance.run(empId, dateStr, '09:10:00', '13:40:00', 'HALF_DAY', 4.5, 'Medical appointment afternoon');
        } else if (index === 4) {
          // David Kim: Clocked in
          insertAttendance.run(empId, dateStr, '08:58:30', null, 'PRESENT', 0, 'HR quarterly reviews');
        } else if (index === 5) {
          // Amara Diallo: On Leave
          insertAttendance.run(empId, dateStr, null, null, 'ON_LEAVE', 0, 'Approved annual leave');
        } else if (index === 6) {
          // Jordan Taylor: Absent
          insertAttendance.run(empId, dateStr, null, null, 'ABSENT', 0, 'Unnotified absence');
        } else {
          // Chloe Dubois: Present
          insertAttendance.run(empId, dateStr, '09:00:00', null, 'PRESENT', 0, 'Quarterly audit');
        }
      } else {
        // Historical days
        // Pseudo-random deterministic behavior based on index + i
        const seedVal = (index * 7 + i * 13) % 10;
        if (seedVal === 0) {
          insertAttendance.run(empId, dateStr, null, null, 'ABSENT', 0, 'Sick leave requested after');
        } else if (seedVal === 1) {
          insertAttendance.run(empId, dateStr, '09:40:12', '18:15:30', 'LATE', 8.5, 'Arrived past grace period');
        } else if (seedVal === 2) {
          insertAttendance.run(empId, dateStr, '09:00:00', '13:30:00', 'HALF_DAY', 4.5, 'Half day leave taken');
        } else if (seedVal === 3) {
          insertAttendance.run(empId, dateStr, null, null, 'ON_LEAVE', 0, 'Pre-approved leave');
        } else {
          insertAttendance.run(empId, dateStr, '08:55:00', '17:50:00', 'PRESENT', 8.9, 'Standard workday');
        }
      }
    });
  }

  // Seed sample leave requests
  const insertLeave = db.prepare(`
    INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, admin_comments)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const todayStr = formatDate(now);
  const futureDate1 = new Date(now);
  futureDate1.setDate(futureDate1.getDate() + 2);
  const futureDate2 = new Date(now);
  futureDate2.setDate(futureDate2.getDate() + 5);

  insertLeave.run(empIds[5], 'ANNUAL', todayStr, formatDate(futureDate1), 'Family vacation', 'APPROVED', 'Approved by David Kim');
  insertLeave.run(empIds[1], 'SICK', formatDate(futureDate1), formatDate(futureDate2), 'Recovery from surgery', 'PENDING', null);
  insertLeave.run(empIds[6], 'CASUAL', todayStr, todayStr, 'Personal errand', 'PENDING', null);
  insertLeave.run(empIds[3], 'UNPAID', '2025-01-10', '2025-01-12', 'Extended travel', 'REJECTED', 'Team sprint deadline');

  console.log(`Database seeded successfully! Total employees: ${empIds.length}`);
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
