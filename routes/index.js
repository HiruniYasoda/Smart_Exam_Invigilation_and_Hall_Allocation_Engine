const express = require('express');
const router = express.Router();

// Controllers
const assignmentController = require('../controllers/assignmentController');
const authController = require('../controllers/authController');
const examController = require('../controllers/examController');
const lecturerController = require('../controllers/lecturerController');
const hallController = require('../controllers/hallController');
const allocationController = require('../controllers/allocationController');
const notificationController = require('../controllers/notificationController');

// Middlewares
const { authenticate, authorizeRoles } = require('../middlewares/auth');

// ==========================================
// Assignment & Scheduling Routes
// ==========================================
router.post(
  '/assignments/request', 
  authenticate, 
  authorizeRoles('admin', 'lecturer'), 
  assignmentController.createRequest
);

router.get(
  '/assignments/lecturer/schedule', 
  authenticate, 
  authorizeRoles('admin', 'lecturer'), 
  assignmentController.getLecturerSchedule
);

router.get(
  '/assignments/admin/view', 
  authenticate, 
  authorizeRoles('admin'), 
  assignmentController.viewAllRequests
);

router.put(
  '/assignments/status/:id', 
  authenticate, 
  authorizeRoles('admin', 'lecturer'), 
  assignmentController.updateRequestStatus
);

router.post(
  '/assignments/finish', 
  authenticate, 
  authorizeRoles('admin', 'lecturer'), 
  assignmentController.markSessionAsFinished
);

router.get(
  '/assignments/conflicts', 
  authenticate, 
  authorizeRoles('admin', 'lecturer'), 
  assignmentController.checkConflicts
);

router.post(
  '/assignments/auto-assign', 
  authenticate, 
  authorizeRoles('admin'), 
  assignmentController.autoAssignInvigilators
);

router.post(
  '/assignments/override',
  authenticate,
  authorizeRoles('admin'),
  allocationController.overrideAllocation
);

router.get(
  '/assignments/overrides',
  authenticate,
  authorizeRoles('admin'),
  allocationController.getOverrideLogs
);

router.post(
  '/assignments/override-log',
  authenticate,
  authorizeRoles('admin'),
  allocationController.logOverrides
);

// ==========================================
// Authentication & Account Routes
// ==========================================
router.post('/auth/register', authController.registerUser);
router.post('/auth/login', authController.loginUser);
router.get('/auth/profile', authenticate, authController.getUserProfile);
router.put('/auth/profile', authenticate, authController.updateUserProfile);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

// Role-specific reporting routes
router.get(
  '/auth/student-timetable', 
  authenticate, 
  authorizeRoles('student', 'admin'), 
  authController.getStudentTimetable
);

router.get(
  '/auth/lecturer-notifications', 
  authenticate, 
  authorizeRoles('lecturer', 'admin'), 
  authController.getLecturerNotifications
);

router.get(
  '/auth/exam-assignment-report', 
  authenticate, 
  authorizeRoles('admin'), 
  authController.getExamAssignmentReport
);

// ==========================================
// Exam Session Management Routes
// ==========================================
router.post('/exams/create', authenticate, authorizeRoles('admin'), examController.createExamSession);
router.get('/exams/all', authenticate, examController.getAllExamSessions);
router.get('/exams/department', authenticate, examController.getExamsByDepartment);
router.get('/exams/available-halls', authenticate, examController.getAvailableHallsAsButtons);
router.put('/exams/update/:id', authenticate, authorizeRoles('admin'), examController.updateExamSession);
router.delete('/exams/delete/:id', authenticate, authorizeRoles('admin'), examController.deleteExamSession);

// ==========================================
// Hall Management Routes
// ==========================================
router.post('/halls/create', authenticate, authorizeRoles('admin'), hallController.createHall);
router.get('/halls/all', authenticate, hallController.getAllHalls);
router.put('/halls/update/:id', authenticate, authorizeRoles('admin'), hallController.updateHall);
router.delete('/halls/delete/:id', authenticate, authorizeRoles('admin'), hallController.deleteHall);

// ==========================================
// Lecturer Directory & Assignment Routes
// ==========================================
router.post('/lecturers/create', authenticate, authorizeRoles('admin'), lecturerController.createLecturer);
router.put('/lecturers/update/:id', authenticate, authorizeRoles('admin'), lecturerController.updateLecturer);
router.delete('/lecturers/delete/:id', authenticate, authorizeRoles('admin'), lecturerController.deleteLecturer);
router.get('/lecturers/all', authenticate, lecturerController.getAllLecturers);
router.get('/lecturers/available', authenticate, lecturerController.getAvailableLecturers);
router.post('/lecturers/assign', authenticate, authorizeRoles('admin'), lecturerController.assignLecturer);
router.post('/lecturers/unassign', authenticate, authorizeRoles('admin'), lecturerController.unassignLecturer);
router.get('/lecturers/schedule', authenticate, authorizeRoles('lecturer', 'admin'), lecturerController.getLecturerExamSchedule);

// ==========================================
// Notification Routes
// ==========================================
router.post('/notifications/send', authenticate, authorizeRoles('admin'), notificationController.sendNotification);
router.get('/notifications/admin', authenticate, authorizeRoles('admin'), notificationController.getAllNotificationsAdmin);
router.get('/notifications/my', authenticate, notificationController.getMyNotifications);
router.patch('/notifications/:id/read', authenticate, notificationController.markAsRead);

module.exports = router;
