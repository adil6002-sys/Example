// Attendance Management System Frontend Application Logic

// Application State
const state = {
  activeTab: 'tab-dashboard',
  employees: [],
  departments: [],
  selectedDate: new Date().toISOString().split('T')[0],
  dashboardStats: null,
  attendanceRecords: [],
  leaves: []
};

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-xmark';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Live Clock & Date display
function initClock() {
  function update() {
    const now = new Date();
    const clockEl = document.getElementById('clock-text');
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString();
    }
  }
  update();
  setInterval(update, 1000);

  const dateBanner = document.getElementById('today-date-str');
  if (dateBanner) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateBanner.textContent = `Today is ${new Date().toLocaleDateString(undefined, options)} • Real-time Monitoring`;
  }
}

// Navigation Tabs
function initTabs() {
  const tabBtns = document.querySelectorAll('.nav-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  // Fetch data appropriate for tab
  if (tabId === 'tab-dashboard') {
    loadDashboard();
  } else if (tabId === 'tab-attendance') {
    loadAttendanceMatrix();
  } else if (tabId === 'tab-employees') {
    loadEmployees();
  } else if (tabId === 'tab-leaves') {
    loadLeaves();
  } else if (tabId === 'tab-reports') {
    loadReports();
  }
}

// Load Employees cache & populate dropdowns
async function loadEmployeesCache() {
  try {
    const res = await window.api.get('/api/employees');
    state.employees = res.data;

    // Populate dropdowns
    const clockSelect = document.getElementById('clock-emp-select');
    const leaveSelect = document.getElementById('leave-emp-select');
    const manualSelect = document.getElementById('manual-emp-select');

    const optionsHtml = state.employees
      .filter(e => e.status !== 'INACTIVE')
      .map(e => `<option value="${e.id}">${e.employee_code} - ${e.first_name} ${e.last_name} (${e.department})</option>`)
      .join('');

    if (clockSelect) clockSelect.innerHTML = optionsHtml;
    if (leaveSelect) leaveSelect.innerHTML = optionsHtml;
    if (manualSelect) manualSelect.innerHTML = optionsHtml;

    // Populate department filters and datalist
    const deptRes = await window.api.get('/api/employees/departments');
    state.departments = deptRes.data;

    const datalist = document.getElementById('dept-datalist');
    if (datalist) {
      datalist.innerHTML = state.departments.map(d => `<option value="${d}">`).join('');
    }

    const deptFilters = ['att-dept-filter', 'emp-dept-filter', 'rep-dept-filter'];
    deptFilters.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = '<option value="ALL">All Departments</option>' +
          state.departments.map(d => `<option value="${d}">${d}</option>`).join('');
      }
    });

  } catch (err) {
    console.error('Failed to load employees cache', err);
  }
}

// 1. Dashboard
async function loadDashboard() {
  try {
    const res = await window.api.get('/api/analytics');
    const { summary, deptStats } = res.data;
    state.dashboardStats = summary;

    document.getElementById('stat-total-employees').textContent = summary.totalEmployees;
    document.getElementById('stat-present-today').textContent = summary.presentToday;
    document.getElementById('stat-late-today').textContent = summary.lateToday;
    document.getElementById('stat-leave-today').textContent = summary.onLeaveToday;
    document.getElementById('stat-absent-today').textContent = summary.absentToday;
    document.getElementById('stat-attendance-rate').textContent = `${summary.attendanceRate}%`;

    // Render department breakdown
    const deptContainer = document.getElementById('dept-stats-container');
    if (deptContainer) {
      if (deptStats.length === 0) {
        deptContainer.innerHTML = '<p class="user-sub">No department data available.</p>';
      } else {
        deptContainer.innerHTML = deptStats.map(d => `
          <div class="dept-stat-row">
            <div class="dept-stat-header">
              <span>${d.department} <small style="color:var(--text-muted);">(${d.staff_count} staff)</small></span>
              <span>${d.rate}%</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${d.rate}%;"></div>
            </div>
          </div>
        `).join('');
      }
    }

    // Render recent live feed
    const attRes = await window.api.get('/api/attendance', { date: new Date().toISOString().split('T')[0] });
    const feedBody = document.getElementById('dashboard-recent-feed');
    if (feedBody) {
      if (attRes.data.length === 0) {
        feedBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;">No clock-in records yet today.</td></tr>';
      } else {
        feedBody.innerHTML = attRes.data.slice(0, 7).map(r => `
          <tr>
            <td>
              <div class="user-cell">
                <img src="${r.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.first_name + ' ' + r.last_name)}`}" class="avatar" alt="">
                <div>
                  <div class="user-name">${r.first_name} ${r.last_name}</div>
                  <div class="user-sub">${r.department}</div>
                </div>
              </div>
            </td>
            <td><i class="fa-regular fa-clock" style="color:var(--text-muted);margin-right:4px;"></i> ${r.clock_in || '--:--'}</td>
            <td><i class="fa-regular fa-clock" style="color:var(--text-muted);margin-right:4px;"></i> ${r.clock_out || '--:--'}</td>
            <td>${renderStatusBadge(r.status)}</td>
          </tr>
        `).join('');
      }
    }

  } catch (err) {
    showToast('Failed to load dashboard data', 'error');
  }
}

function renderStatusBadge(status) {
  const map = {
    PRESENT: { label: 'Present', class: 'badge-present', icon: 'fa-check' },
    LATE: { label: 'Late', class: 'badge-late', icon: 'fa-clock' },
    HALF_DAY: { label: 'Half Day', class: 'badge-half_day', icon: 'fa-adjust' },
    ABSENT: { label: 'Absent', class: 'badge-absent', icon: 'fa-xmark' },
    ON_LEAVE: { label: 'On Leave', class: 'badge-on_leave', icon: 'fa-umbrella-beach' },
    PENDING: { label: 'Pending', class: 'badge-pending', icon: 'fa-hourglass-half' },
    APPROVED: { label: 'Approved', class: 'badge-approved', icon: 'fa-circle-check' },
    REJECTED: { label: 'Rejected', class: 'badge-rejected', icon: 'fa-ban' }
  };
  const item = map[status] || { label: status, class: 'badge-pending', icon: 'fa-info' };
  return `<span class="badge ${item.class}"><i class="fa-solid ${item.icon}"></i> ${item.label}</span>`;
}

// 2. Daily Attendance Matrix
async function loadAttendanceMatrix() {
  const datePicker = document.getElementById('att-date-picker');
  const targetDate = datePicker.value || state.selectedDate;
  datePicker.value = targetDate;

  const deptFilter = document.getElementById('att-dept-filter').value;
  const statusFilter = document.getElementById('att-status-filter').value;
  const searchFilter = (document.getElementById('att-search-input').value || '').toLowerCase();

  try {
    const res = await window.api.get('/api/attendance/daily-matrix', { date: targetDate });
    let items = res.data;

    // Filters
    if (deptFilter && deptFilter !== 'ALL') {
      items = items.filter(i => i.employee.department === deptFilter);
    }
    if (statusFilter && statusFilter !== 'ALL') {
      items = items.filter(i => i.attendance.status === statusFilter);
    }
    if (searchFilter) {
      items = items.filter(i =>
        i.employee.first_name.toLowerCase().includes(searchFilter) ||
        i.employee.last_name.toLowerCase().includes(searchFilter) ||
        i.employee.employee_code.toLowerCase().includes(searchFilter)
      );
    }

    const tbody = document.getElementById('attendance-table-body');
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted);">No employees found matching criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(item => {
      const emp = item.employee;
      const att = item.attendance;
      const isClockedIn = !!att.clock_in;
      const isClockedOut = !!att.clock_out;

      return `
        <tr>
          <td>
            <div class="user-cell">
              <img src="${emp.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.first_name + ' ' + emp.last_name)}`}" class="avatar" alt="">
              <div>
                <div class="user-name">${emp.first_name} ${emp.last_name}</div>
                <div class="user-sub">${emp.employee_code}</div>
              </div>
            </div>
          </td>
          <td>${emp.department}</td>
          <td>${att.clock_in || '<span style="color:var(--text-muted);">--:--</span>'}</td>
          <td>${att.clock_out || '<span style="color:var(--text-muted);">--:--</span>'}</td>
          <td><strong>${att.work_hours ? att.work_hours + ' hrs' : '-'}</strong></td>
          <td>${renderStatusBadge(att.status)}</td>
          <td><small style="color:var(--text-muted);">${att.notes || '-'}</small></td>
          <td>
            <div style="display:flex;gap:0.35rem;">
              ${!isClockedIn ? `
                <button class="btn btn-primary btn-sm btn-action-in" data-id="${emp.id}" title="Clock In">
                  <i class="fa-solid fa-arrow-right-to-bracket"></i> In
                </button>
              ` : (!isClockedOut ? `
                <button class="btn btn-secondary btn-sm btn-action-out" data-id="${emp.id}" title="Clock Out">
                  <i class="fa-solid fa-arrow-right-from-bracket"></i> Out
                </button>
              ` : '')}
              <button class="btn btn-secondary btn-sm btn-action-adjust" data-emp='${JSON.stringify(emp)}' data-att='${JSON.stringify(att)}' title="Adjust Record">
                <i class="fa-solid fa-pencil"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach inline button handlers
    document.querySelectorAll('.btn-action-in').forEach(b => {
      b.addEventListener('click', () => quickClockDirect(b.dataset.id, 'IN'));
    });
    document.querySelectorAll('.btn-action-out').forEach(b => {
      b.addEventListener('click', () => quickClockDirect(b.dataset.id, 'OUT'));
    });
    document.querySelectorAll('.btn-action-adjust').forEach(b => {
      b.addEventListener('click', () => {
        const emp = JSON.parse(b.dataset.emp);
        const att = JSON.parse(b.dataset.att);
        openManualAdjustModal(emp, att);
      });
    });

  } catch (err) {
    showToast('Failed to load daily attendance matrix', 'error');
  }
}

async function quickClockDirect(employeeId, type) {
  try {
    const endpoint = type === 'IN' ? '/api/attendance/clock-in' : '/api/attendance/clock-out';
    const datePicker = document.getElementById('att-date-picker');
    const date = datePicker.value || new Date().toISOString().split('T')[0];

    await window.api.post(endpoint, {
      employee_id: employeeId,
      date: date
    });

    showToast(`Successfully clocked ${type === 'IN' ? 'in' : 'out'}!`, 'success');
    loadAttendanceMatrix();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openManualAdjustModal(emp, att) {
  document.getElementById('manual-emp-select').value = emp.id;
  document.getElementById('manual-date').value = att.date || document.getElementById('att-date-picker').value;
  document.getElementById('manual-status').value = att.status || 'PRESENT';
  document.getElementById('manual-clock-in').value = att.clock_in ? att.clock_in.substring(0, 5) : '';
  document.getElementById('manual-clock-out').value = att.clock_out ? att.clock_out.substring(0, 5) : '';
  document.getElementById('manual-notes').value = att.notes || '';

  openModal('modal-manual-att');
}

// 3. Employees Management
async function loadEmployees() {
  const search = document.getElementById('emp-search-input').value;
  const dept = document.getElementById('emp-dept-filter').value;
  const status = document.getElementById('emp-status-filter').value;

  try {
    const res = await window.api.get('/api/employees', { search, department: dept, status });
    const employees = res.data;
    const tbody = document.getElementById('employees-table-body');

    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No employees found.</td></tr>';
      return;
    }

    tbody.innerHTML = employees.map(e => `
      <tr>
        <td><strong>${e.employee_code}</strong></td>
        <td>
          <div class="user-cell">
            <img src="${e.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(e.first_name + ' ' + e.last_name)}`}" class="avatar" alt="">
            <div>
              <div class="user-name">${e.first_name} ${e.last_name}</div>
              <div class="user-sub">${e.email}</div>
            </div>
          </div>
        </td>
        <td><span class="badge" style="background:#f1f5f9;color:#334155;">${e.department}</span></td>
        <td>${e.role}</td>
        <td>${e.phone || '<span style="color:var(--text-muted);">-</span>'}</td>
        <td>
          <span class="badge ${e.status === 'ACTIVE' ? 'badge-approved' : 'badge-rejected'}">
            ${e.status}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:0.35rem;">
            <button class="btn btn-secondary btn-sm btn-edit-emp" data-emp='${JSON.stringify(e)}' title="Edit Employee">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-danger btn-sm btn-delete-emp" data-id="${e.id}" data-name="${e.first_name} ${e.last_name}" title="Delete Employee">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attach actions
    document.querySelectorAll('.btn-edit-emp').forEach(b => {
      b.addEventListener('click', () => {
        const emp = JSON.parse(b.dataset.emp);
        openEditEmployeeModal(emp);
      });
    });

    document.querySelectorAll('.btn-delete-emp').forEach(b => {
      b.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete employee ${b.dataset.name}?`)) {
          try {
            await window.api.delete(`/api/employees/${b.dataset.id}`);
            showToast('Employee deleted successfully', 'success');
            loadEmployees();
            loadEmployeesCache();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });

  } catch (err) {
    showToast('Failed to load employees', 'error');
  }
}

function openEditEmployeeModal(emp) {
  document.getElementById('modal-emp-title').innerHTML = '<i class="fa-solid fa-user-pen"></i> Edit Employee';
  document.getElementById('emp-edit-id').value = emp.id;
  document.getElementById('emp-code').value = emp.employee_code;
  document.getElementById('emp-code').disabled = true; // Code shouldn't change
  document.getElementById('emp-firstname').value = emp.first_name;
  document.getElementById('emp-lastname').value = emp.last_name;
  document.getElementById('emp-email').value = emp.email;
  document.getElementById('emp-department').value = emp.department;
  document.getElementById('emp-role').value = emp.role;
  document.getElementById('emp-phone').value = emp.phone || '';
  document.getElementById('emp-status').value = emp.status || 'ACTIVE';

  openModal('modal-employee');
}

// 4. Leaves
async function loadLeaves() {
  const statusFilter = document.getElementById('leaves-status-filter').value;

  try {
    const res = await window.api.get('/api/leaves', { status: statusFilter });
    state.leaves = res.data;
    const tbody = document.getElementById('leaves-table-body');

    if (state.leaves.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No leave requests found.</td></tr>';
      return;
    }

    tbody.innerHTML = state.leaves.map(l => `
      <tr>
        <td>
          <div class="user-name">${l.first_name} ${l.last_name}</div>
          <div class="user-sub">${l.employee_code}</div>
        </td>
        <td>${l.department}</td>
        <td><strong>${l.leave_type}</strong></td>
        <td>${l.start_date} <i class="fa-solid fa-arrow-right" style="font-size:0.75rem;margin:0 4px;color:var(--text-muted);"></i> ${l.end_date}</td>
        <td>${l.reason || '<span style="color:var(--text-muted);">-</span>'}</td>
        <td>${renderStatusBadge(l.status)}</td>
        <td>
          ${l.status === 'PENDING' ? `
            <div style="display:flex;gap:0.35rem;">
              <button class="btn btn-success btn-sm btn-approve-leave" data-id="${l.id}">
                <i class="fa-solid fa-check"></i> Approve
              </button>
              <button class="btn btn-danger btn-sm btn-reject-leave" data-id="${l.id}">
                <i class="fa-solid fa-xmark"></i> Reject
              </button>
            </div>
          ` : `<small style="color:var(--text-muted);">${l.admin_comments || 'Processed'}</small>`}
        </td>
      </tr>
    `).join('');

    // Attach leave actions
    document.querySelectorAll('.btn-approve-leave').forEach(b => {
      b.addEventListener('click', () => updateLeaveStatus(b.dataset.id, 'APPROVED'));
    });
    document.querySelectorAll('.btn-reject-leave').forEach(b => {
      b.addEventListener('click', () => updateLeaveStatus(b.dataset.id, 'REJECTED'));
    });

  } catch (err) {
    showToast('Failed to load leave requests', 'error');
  }
}

async function updateLeaveStatus(leaveId, status) {
  try {
    await window.api.patch(`/api/leaves/${leaveId}/status`, {
      status,
      admin_comments: `Action taken by Admin on ${new Date().toLocaleDateString()}`
    });
    showToast(`Leave request ${status.toLowerCase()}!`, 'success');
    loadLeaves();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 5. Reports & Export
async function loadReports() {
  const startDateInput = document.getElementById('rep-start-date');
  const endDateInput = document.getElementById('rep-end-date');
  const deptSelect = document.getElementById('rep-dept-filter');

  // Default dates: past 7 days up to today
  if (!endDateInput.value) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);

    endDateInput.value = end.toISOString().split('T')[0];
    startDateInput.value = start.toISOString().split('T')[0];
  }

  try {
    const res = await window.api.get('/api/attendance', {
      startDate: startDateInput.value,
      endDate: endDateInput.value,
      department: deptSelect.value
    });

    const rows = res.data;
    const tbody = document.getElementById('reports-table-body');

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted);">No attendance records found for selected period.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.date}</strong></td>
        <td>${r.employee_code}</td>
        <td>${r.first_name} ${r.last_name}</td>
        <td>${r.department}</td>
        <td>${r.clock_in || '-'}</td>
        <td>${r.clock_out || '-'}</td>
        <td>${r.work_hours ? r.work_hours + ' hrs' : '-'}</td>
        <td>${renderStatusBadge(r.status)}</td>
        <td><small style="color:var(--text-muted);">${r.notes || '-'}</small></td>
      </tr>
    `).join('');

  } catch (err) {
    showToast('Failed to load reports', 'error');
  }
}

// Modal management
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

function initModals() {
  // Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.getAttribute('data-close'));
    });
  });

  // Quick Clock Modal trigger
  const btnQuickClock = document.getElementById('btn-quick-clock-modal');
  if (btnQuickClock) {
    btnQuickClock.addEventListener('click', () => openModal('modal-clock'));
  }

  const btnBannerClockIn = document.getElementById('btn-banner-clock-in');
  if (btnBannerClockIn) {
    btnBannerClockIn.addEventListener('click', () => {
      document.getElementById('clock-action-type').value = 'IN';
      openModal('modal-clock');
    });
  }

  const btnBannerClockOut = document.getElementById('btn-banner-clock-out');
  if (btnBannerClockOut) {
    btnBannerClockOut.addEventListener('click', () => {
      document.getElementById('clock-action-type').value = 'OUT';
      openModal('modal-clock');
    });
  }

  // Open Leave Modal
  const btnBannerLeave = document.getElementById('btn-open-leave-modal');
  const btnLeavesApply = document.getElementById('btn-leaves-apply-modal');
  [btnBannerLeave, btnLeavesApply].forEach(b => {
    if (b) {
      b.addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('leave-start-date').value = today;
        document.getElementById('leave-end-date').value = today;
        openModal('modal-leave');
      });
    }
  });

  // Open Add Employee Modal
  const btnAddEmp = document.getElementById('btn-open-add-emp-modal');
  if (btnAddEmp) {
    btnAddEmp.addEventListener('click', () => {
      document.getElementById('modal-emp-title').innerHTML = '<i class="fa-solid fa-user-plus"></i> Add New Employee';
      document.getElementById('emp-edit-id').value = '';
      document.getElementById('emp-code').value = `EMP-00${state.employees.length + 1}`;
      document.getElementById('emp-code').disabled = false;
      document.getElementById('emp-firstname').value = '';
      document.getElementById('emp-lastname').value = '';
      document.getElementById('emp-email').value = '';
      document.getElementById('emp-department').value = '';
      document.getElementById('emp-role').value = '';
      document.getElementById('emp-phone').value = '';
      document.getElementById('emp-status').value = 'ACTIVE';
      openModal('modal-employee');
    });
  }

  // Open Manual Log Modal
  const btnManualLog = document.getElementById('btn-open-manual-log-modal');
  if (btnManualLog) {
    btnManualLog.addEventListener('click', () => {
      document.getElementById('manual-date').value = document.getElementById('att-date-picker').value || new Date().toISOString().split('T')[0];
      document.getElementById('manual-status').value = 'PRESENT';
      document.getElementById('manual-clock-in').value = '09:00';
      document.getElementById('manual-clock-out').value = '17:30';
      document.getElementById('manual-notes').value = '';
      openModal('modal-manual-att');
    });
  }

  // Form: Clock In/Out submit
  const formClock = document.getElementById('form-clock');
  if (formClock) {
    formClock.addEventListener('submit', async (e) => {
      e.preventDefault();
      const empId = document.getElementById('clock-emp-select').value;
      const type = document.getElementById('clock-action-type').value;
      const customTime = document.getElementById('clock-custom-time').value;
      const notes = document.getElementById('clock-notes').value;

      const endpoint = type === 'IN' ? '/api/attendance/clock-in' : '/api/attendance/clock-out';
      const body = {
        employee_id: empId,
        date: new Date().toISOString().split('T')[0],
        notes
      };

      if (customTime) {
        if (type === 'IN') body.clock_in = customTime + ':00';
        else body.clock_out = customTime + ':00';
      }

      try {
        await window.api.post(endpoint, body);
        showToast(`Clocked ${type === 'IN' ? 'in' : 'out'} recorded successfully!`, 'success');
        closeModal('modal-clock');
        formClock.reset();
        loadDashboard();
        if (state.activeTab === 'tab-attendance') loadAttendanceMatrix();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Form: Employee Add / Edit submit
  const formEmployee = document.getElementById('form-employee');
  if (formEmployee) {
    formEmployee.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = document.getElementById('emp-edit-id').value;
      const payload = {
        employee_code: document.getElementById('emp-code').value,
        first_name: document.getElementById('emp-firstname').value,
        last_name: document.getElementById('emp-lastname').value,
        email: document.getElementById('emp-email').value,
        department: document.getElementById('emp-department').value,
        role: document.getElementById('emp-role').value,
        phone: document.getElementById('emp-phone').value,
        status: document.getElementById('emp-status').value
      };

      try {
        if (editId) {
          await window.api.put(`/api/employees/${editId}`, payload);
          showToast('Employee details updated successfully!', 'success');
        } else {
          await window.api.post('/api/employees', payload);
          showToast('New employee created successfully!', 'success');
        }

        closeModal('modal-employee');
        await loadEmployeesCache();
        loadEmployees();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Form: Apply Leave submit
  const formLeave = document.getElementById('form-leave');
  if (formLeave) {
    formLeave.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        employee_id: document.getElementById('leave-emp-select').value,
        leave_type: document.getElementById('leave-type-select').value,
        start_date: document.getElementById('leave-start-date').value,
        end_date: document.getElementById('leave-end-date').value,
        reason: document.getElementById('leave-reason').value
      };

      try {
        await window.api.post('/api/leaves', payload);
        showToast('Leave request submitted successfully!', 'success');
        closeModal('modal-leave');
        formLeave.reset();
        loadLeaves();
        loadDashboard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Form: Manual attendance log submit
  const formManual = document.getElementById('form-manual-att');
  if (formManual) {
    formManual.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        employee_id: document.getElementById('manual-emp-select').value,
        date: document.getElementById('manual-date').value,
        status: document.getElementById('manual-status').value,
        clock_in: document.getElementById('manual-clock-in').value ? document.getElementById('manual-clock-in').value + ':00' : null,
        clock_out: document.getElementById('manual-clock-out').value ? document.getElementById('manual-clock-out').value + ':00' : null,
        notes: document.getElementById('manual-notes').value
      };

      try {
        await window.api.post('/api/attendance/manual', payload);
        showToast('Attendance recorded successfully!', 'success');
        closeModal('modal-manual-att');
        formManual.reset();
        loadAttendanceMatrix();
        loadDashboard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

// Initial Listeners & Boot
document.addEventListener('DOMContentLoaded', async () => {
  initClock();
  initTabs();
  initModals();

  await loadEmployeesCache();
  loadDashboard();

  // Filters listeners
  document.getElementById('att-date-picker').value = new Date().toISOString().split('T')[0];
  document.getElementById('att-date-picker').addEventListener('change', loadAttendanceMatrix);
  document.getElementById('att-dept-filter').addEventListener('change', loadAttendanceMatrix);
  document.getElementById('att-status-filter').addEventListener('change', loadAttendanceMatrix);
  document.getElementById('att-search-input').addEventListener('input', loadAttendanceMatrix);

  document.getElementById('emp-search-input').addEventListener('input', loadEmployees);
  document.getElementById('emp-dept-filter').addEventListener('change', loadEmployees);
  document.getElementById('emp-status-filter').addEventListener('change', loadEmployees);

  document.getElementById('leaves-status-filter').addEventListener('change', loadLeaves);

  document.getElementById('btn-rep-filter').addEventListener('click', loadReports);

  // CSV export handler
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    const sDate = document.getElementById('rep-start-date').value;
    const eDate = document.getElementById('rep-end-date').value;
    const dept = document.getElementById('rep-dept-filter').value;
    window.location.href = `/api/export/csv?startDate=${sDate}&endDate=${eDate}&department=${dept}`;
  });

  const btnRefresh = document.getElementById('btn-refresh-dashboard');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadDashboard();
      showToast('Dashboard metrics refreshed');
    });
  }
});
