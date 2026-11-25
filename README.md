# Smart Exam Invigilation & Hall Allocation Engine

[![Node.js CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?style=flat&logo=githubactions)](.github/workflows/test.yml)
[![Node.js Runtime](https://img.shields.io/badge/Node.js-v18%20%7C%20v20%20%7C%20v22-339933?style=flat&logo=nodedotjs)](https://nodejs.org)
[![Architecture: Clean Service Layer](https://img.shields.io/badge/Architecture-Service%20Layer%20%26%20RBAC-6A1B9A?style=flat)](#system-architecture)
[![Test Coverage: 100% Native](https://img.shields.io/badge/Tests-33%20Passing%20(Native%20Runner)-success?style=flat)](#automated-testing--ci)

A domain-driven backend system built with **Node.js**, **Express**, and **MongoDB (Mongoose)** that automates university exam invigilation, supervisor ratios, lecturer seniority rank hierarchy, and physical hall collision detection.

---

## Authorship & Contribution Disclosure

> [!NOTE]
> **Engineering Scope**: This repository represents the backend core logic of the exam scheduling and hall allocation system. My primary focus and contributions include:
> - Architecting the **Allocation Service** (`services/allocationService.js`) implementing complex scheduling heuristics (staffing ratios, rank hierarchy, and hall conflict resolution).
> - Hardening authentication and authorization with **secure password hashing**, **SHA-256 hashed reset tokens**, and **Role-Based Access Control (RBAC)** middleware.
> - Decoupling the codebase following the **Service Layer Pattern** (`Route -> Middleware -> Controller -> Service -> Model`).
> - Establishing an automated unit and integration test suite using Node's native test runner with continuous integration via GitHub Actions.

---

## System Architecture

```mermaid
flowchart TD
    Client["Client (Web App / API Consumer)"] -->|HTTP / JSON| Router["Express Router (routes/index.js)"]
    
    subgraph Middlewares ["Middleware Layer"]
        Router --> AuthMW["authenticate (Bearer JWT Verification)"]
        AuthMW --> RBAC["authorizeRoles ('admin', 'lecturer', 'student')"]
    end

    subgraph Controllers ["Controller Layer (HTTP & Validation)"]
        RBAC --> AC["assignmentController.js"]
        RBAC --> AuthC["authController.js"]
        RBAC --> EC["examController.js"]
        RBAC --> LC["lecturerController.js"]
    end

    subgraph ServiceLayer ["Service Layer (Core Domain Logic)"]
        AC --> AS["allocationService.js"]
        AS --> HallLogic["findAvailableHalls() (Capacity & Booking Collisions)"]
        AS --> RatioLogic["calculateRequiredStaff() (Supervisor / Invigilator Ratios)"]
        AS --> RankLogic["autoAllocateStaff() (Rank Seniority & Setter Priority)"]
        AS --> OverlapLogic["checkTimeOverlap() (Time Interval Math)"]
    end

    subgraph Security ["Security & Cryptography"]
        AuthC --> PU["passwordUtils.js (bcrypt / scrypt timing-safe comparison)"]
        AuthC --> TokenHash["hashToken() (SHA-256 single-use reset tokens)"]
    end

    subgraph Database ["Persistence Layer (Mongoose ODM)"]
        AC --> DB_AR[("AssignmentRequest")]
        AuthC --> DB_User[("User")]
        EC --> DB_Exam[("Exam")]
        LC --> DB_Lecturer[("Lecturer")]
        AS --> DB_Hall[("Hall")]
    end
```

---

## Core Allocation Rules & Domain Policies

The allocation engine (`services/allocationService.js`) enforces strict university academic regulations:

### 1. Supervision & Invigilation Ratios
- **Supervisors**: $\lceil \text{studentCount} / 180 \rceil$ (1 supervisor per 180 students).
- **Invigilators**: Baseline of 1 invigilator. If $\text{studentCount} > 25$, $+1$ additional invigilator for each 15 students:
  $$\text{Invigilators} = 1 + \left\lceil \frac{\text{studentCount} - 25}{15} \right\rceil$$

| Student Count | Supervisors Required | Invigilators Required |
|---|---|---|
| **1 – 25** | 1 | 1 |
| **26 – 40** | 1 | 2 |
| **41 – 55** | 1 | 3 |
| **180** | 1 | 12 |
| **181** | 2 | 12 |

### 2. Academic Rank Hierarchy
- **Paper Setter Priority**: The course paper setter is prioritized as the primary supervisor if available and not on approved academic leave (`isTL: false`).
- **Supervisor Seniority**: Additional supervisors are chosen from senior academic ranks (`Professor`, `Senior Lecturer Gr I/II`) within the subject's faculty.
- **Rank Inversion Prevention**: Invigilators must possess an academic rank strictly lower (numerically greater in rank index) than the lowest supervisor rank assigned to that hall.

### 3. Collision & Availability Resolution
- **Time Interval Overlap**: Intervals are checked using boundary-safe comparisons ($!(end_1 \le start_2 \lor start_1 \ge end_2)$).
- **Lecturer Schedule**: Automatically checks against prior assignments and self-declared unavailabilities.
- **Hall Capacity & Collisions**: Exam halls are validated for both physical seating capacity ($\text{capacity} \ge \text{requiredCount}$) and time-slot availability across existing hall bookings.

---

## Security & Reliability Hardening

| Component | Security Risk Addressed | Implementation Details |
|---|---|---|
| **Database Credentials** | Hardcoded credentials in source code. | Extracted connection strings to `process.env.MONGO_URI` with safe local fallbacks in `.env.example`. |
| **Password Storage** | Plaintext password storage and comparison. | Implemented `bcrypt` / secure scrypt with cryptographically random salt and timing-safe evaluation (`passwordUtils.js`). |
| **Password Reset Tokens** | Plaintext tokens in DB; internal error leaks. | Stored as single-use SHA-256 hashes with 15-minute expiry; uniform responses prevent user enumeration. |
| **Access Control (RBAC)** | Privilege escalation where students could access admin routes. | Case-insensitive role middleware (`authorizeRoles`) and server-side ownership checks on assignments. |
| **API Error Sanitization** | Database stack traces returned in 500 responses. | Internal errors are logged on the server while returning sanitized, generic JSON messages to clients. |

---

## API Reference

### Authentication & Account
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new user with hashed credentials. |
| `POST` | `/api/auth/login` | Public | Authenticate user credentials and receive JWT. |
| `POST` | `/api/auth/forgot-password` | Public | Request secure password reset link (anti-enumeration). |
| `POST` | `/api/auth/reset-password` | Public | Reset password using hashed reset token. |
| `GET` | `/api/auth/profile` | Authenticated | Retrieve authenticated user & linked lecturer profile. |
| `PUT` | `/api/auth/profile` | Authenticated | Update user & linked lecturer profile fields. |
| `GET` | `/api/auth/student-timetable` | Student / Admin | Retrieve exam timetable filtered by department. |
| `GET` | `/api/auth/lecturer-notifications` | Lecturer / Admin | Retrieve supervision and invigilation notifications. |
| `GET` | `/api/auth/exam-assignment-report` | Admin | Retrieve detailed exam assignment report. |

### Exam Allocation & Scheduling
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/assignments/auto-assign` | Admin | Execute automatic supervisor, invigilator & hall allocation. |
| `POST` | `/api/assignments/override` | Admin | Manually override allocation and record `OverrideLog`. |
| `GET` | `/api/assignments/overrides` | Admin | View manual override audit logs. |
| `GET` | `/api/assignments/conflicts` | Admin / Lecturer | Scan for overlapping staff/hall assignments. |
| `POST` | `/api/assignments/finish` | Admin / Lecturer | Mark exam session finished and verify hall availability. |
| `GET` | `/api/assignments/admin/view` | Admin | View all exam assignment requests. |
| `GET` | `/api/assignments/lecturer/schedule` | Admin / Lecturer | View duties assigned to the logged-in lecturer. |
| `PUT` | `/api/assignments/status/:id` | Admin / Lecturer | Update assignment status (ownership enforced). |

### Exam, Hall, Lecturer, Notification & Duty Pay
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/exams/create` | Admin | Schedule a new exam session with subject parameters. |
| `GET` | `/api/exams/all` | Authenticated | List all exam sessions. |
| `PUT` | `/api/exams/update/:id` | Admin | Update an exam session. |
| `DELETE` | `/api/exams/delete/:id` | Admin | Delete an exam session. |
| `GET` | `/api/exams/available-halls` | Authenticated | Filter halls meeting capacity and availability constraints. |
| `POST` | `/api/halls/create` | Admin | Create an exam hall. |
| `GET` | `/api/halls/all` | Authenticated | List all exam halls. |
| `PUT` | `/api/halls/update/:id` | Admin | Update an exam hall. |
| `DELETE` | `/api/halls/delete/:id` | Admin | Delete an exam hall. |
| `POST` | `/api/lecturers/create` | Admin | Register academic staff with rank and department. |
| `GET` | `/api/lecturers/all` | Authenticated | List all lecturers. |
| `PUT` | `/api/lecturers/update/:id` | Admin | Update a lecturer record. |
| `DELETE` | `/api/lecturers/delete/:id` | Admin | Delete a lecturer record. |
| `GET` | `/api/lecturers/available` | Authenticated | Query academic staff available for a specific time window. |
| `GET` | `/api/lecturers/schedule` | Lecturer / Admin | Retrieve exam duty schedule for logged-in lecturer. |
| `POST` | `/api/notifications/send` | Admin | Send announcement or duty notification. |
| `GET` | `/api/notifications/admin` | Admin | List dispatched notifications. |
| `GET` | `/api/notifications/my` | Authenticated | List user's personal and role notifications. |
| `PATCH` | `/api/notifications/:id/read` | Authenticated | Mark a notification as read. |
| `GET` | `/api/dutypay/rates` | Admin / Lecturer | Get supervisor and invigilator pay rates. |
| `PUT` | `/api/dutypay/rates` | Admin | Update supervisor and invigilator pay rates. |
| `GET` | `/api/dutypay/summary` | Admin | Calculate per-lecturer duty counts and payouts. |

---

## Getting Started

### Prerequisites
- **Node.js**: `^18.0.0`, `^20.0.0`, or `^22.0.0`
- **MongoDB**: `^6.0.0` (local instance or MongoDB Atlas)

### Local Setup
1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd ideaIgniters2
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to configure your local database and JWT secret:
   ```env
   PORT=3000
   MONGO_URI=mongodb://127.0.0.1:27017/exam_allocation
   JWT_SECRET=your_super_secret_jwt_key
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

---

## Automated Testing & CI

The test suite runs using Node.js's native test runner (`node --test`), requiring zero external test dependencies:

```bash
# Run all unit and security test suites
npm test

# Run syntax and linter checks
npm run lint
```

### Test Coverage Highlights
- **`tests/allocationService.test.js`**: Validates staff ratio math (all student boundaries), interval overlaps, lecturer availability checks, hall capacity checks, and rank priority auto-allocation.
- **`tests/auth.test.js`**: Validates password hashing, timing-safe password comparison, SHA-256 token hashing, and RBAC role middleware protection.
- **`tests/timeUtils.test.js`**: Validates time string overlap detection and date formatting.
