const express = require('express');
const router = express.Router();

// Controllers
const assignmentController = require('../controllers/assignmentController');
const authController = require('../controllers/authController');
const examController = require('../controllers/examController');
const lecturerController = require('../controllers/lecturerController');

// Middlewares
const { authenticate, authorizeRoles } = require('../middlewares/auth');

// Assignment routes
router.post('/assignments/request', authenticate, assignmentController.createRequest);
router.get('/assignments/lecturer/schedule', authenticate, assignmentController.getLecturerSchedule);
router.get('/assignments/admin/view', authenticate, authorizeRoles('admin'), assignmentController.viewAllRequests);
router.put('/assignments/status/:id', authenticate, authorizeRoles('admin'), assignmentController.updateRequestStatus);
router.post('/assignments/finish', authenticate, assignmentController.markSessionAsFinished);
router.get('/assignments/conflicts', authenticate, assignmentController.checkConflicts);
router.post('/assignments/auto-assign', authenticate, authorizeRoles('admin'), assignmentController.autoAssignInvigilators);

// Authentication routes
router.post('/auth/login', authController.loginUser);
router.post('/auth/register', authController.registerUser);
router.get('/auth/profile', authenticate, authController.getUserProfile);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

// Student route
router.get('/auth/student-timetable', authenticate, authorizeRoles('student'), authController.getStudentTimetable);

// Lecturer route
router.get('/auth/lecturer-notifications', authenticate, authorizeRoles('lecturer'), authController.getLecturerNotifications);

// Admin route
router.get('/auth/exam-assignment-report', authenticate, authorizeRoles('admin'), authController.getExamAssignmentReport);

// Exam routes
router.post('/exams/create', authenticate, examController.createExamSession);
router.get('/exams/all', authenticate, examController.getAllExamSessions);
router.get('/exams/department', authenticate, examController.getExamsByDepartment);
router.get('/exams/available-halls', authenticate, examController.getAvailableHallsAsButtons);
router.put('/exams/update/:id', authenticate, authorizeRoles('admin'), examController.updateExamSession);
router.delete('/exams/delete/:id', authenticate, authorizeRoles('admin'), examController.deleteExamSession);

// Lecturer routes
router.post('/lecturers/create', authenticate, authorizeRoles('admin'), lecturerController.createLecturer);
router.put('/lecturers/update/:id', authenticate, authorizeRoles('admin'), lecturerController.updateLecturer);
router.get('/lecturers/all', authenticate, lecturerController.getAllLecturers);
router.get('/lecturers/available', authenticate, lecturerController.getAvailableLecturers);
router.post('/lecturers/assign', authenticate, authorizeRoles('admin'), lecturerController.assignLecturer);
router.post('/lecturers/unassign', authenticate, authorizeRoles('admin'), lecturerController.unassignLecturer);
router.get('/lecturers/schedule', authenticate, authorizeRoles('lecturer'), lecturerController.getLecturerExamSchedule);

module.exports = router;
