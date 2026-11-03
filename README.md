# Attendance Management System

A comprehensive, lightweight, and modern Attendance Management System built with Node.js, Express, SQLite (`better-sqlite3`), and vanilla HTML5/CSS3/JavaScript.

## Features

- **Real-Time Attendance Tracking**:
  - Employee Clock In and Clock Out with automatic status detection (On Time vs Late vs Half Day) based on configurable shifts and grace periods.
  - Work hour and overtime calculation.
  - Manual attendance log adjustment for managers/HR.
- **Interactive Dashboard**:
  - Today's metrics (Present, On Time, Late, On Leave, Absent).
  - Department-level attendance breakdown with progress bars.
  - Weekly attendance trends.
- **Daily Attendance Matrix**:
  - Filterable by date, department, and attendance status.
  - Live search by employee name.
- **Employee Management**:
  - Add, view, edit status (Active/Inactive), and manage staff across departments.
  - Filter by department and search employees.
- **Leave Management**:
  - Submit leave requests (Annual, Sick, Casual, Unpaid).
  - Review, approve, or reject leave requests.
  - Approving a leave automatically marks the employee as "On Leave" in attendance records for the given date range.
- **Reports & Exporting**:
  - Date-range attendance reporting with summary metrics.
  - Instant CSV export download for payroll and record keeping.
- **Company Shift Settings**:
  - Configurable standard shift start time, shift end time, and grace period (minutes).

---

## Tech Stack

- **Backend**: Node.js & Express 5
- **Database**: SQLite3 via `better-sqlite3` (fast, embedded, zero-configuration)
- **Frontend**: Clean modern Single Page Application (HTML5, responsive CSS3, vanilla JS)
- **Testing**: Node.js native test runner (`node --test`) & `supertest`

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm

### Installation

1. Clone the repository and navigate into the project directory:
   ```bash
   cd attendance-management-system
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Seed the database with sample employees and attendance records:
   ```bash
   npm run seed
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Open your web browser and visit:
   ```text
   http://localhost:3000
   ```

---

## Testing

Run the automated API test suite:
```bash
npm test
```

---

## API Endpoints

### Employees
- `GET /api/employees` - List all employees (supports `?department=` and `?search=`)
- `GET /api/employees/:id` - Get employee details
- `POST /api/employees` - Create a new employee
- `PUT /api/employees/:id` - Update employee details
- `DELETE /api/employees/:id` - Soft-delete (deactivate) an employee

### Attendance
- `GET /api/attendance/today` - Today's attendance list (supports `?department=` and `?status=`)
- `GET /api/attendance` - Query attendance history by `startDate`, `endDate`, `employeeId`, `department`, `status`
- `POST /api/attendance/clock-in` - Record employee clock-in
- `POST /api/attendance/clock-out` - Record employee clock-out
- `POST /api/attendance/manual` - Add or update a manual attendance record

### Leave Requests
- `GET /api/leaves` - List leave requests (supports `?status=`)
- `POST /api/leaves` - Submit a new leave request
- `PUT /api/leaves/:id` - Approve or reject leave request

### Analytics & Reports
- `GET /api/analytics/summary` - Today's overall attendance stats and breakdown
- `GET /api/analytics/trends` - Weekly attendance trends
- `GET /api/export/csv` - Export attendance data as CSV (`?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`)

### Settings
- `GET /api/settings` - Retrieve company work hours and grace period settings
- `PUT /api/settings` - Update work hours settings
