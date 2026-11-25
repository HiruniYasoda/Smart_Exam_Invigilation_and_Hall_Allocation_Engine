const crypto = require('crypto');
let jwt = null;
try {
  jwt = require('jsonwebtoken');
} catch (e) {}

function signJwtToken(payload, secret, expiresIn) {
  if (jwt && typeof jwt.sign === 'function') {
    return jwt.sign(payload, secret, { expiresIn });
  }

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7200 })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}
const User = require('../models/User');
const Lecturer = require('../models/Lecturer');
const Exam = require('../models/Exam');
const AssignmentRequest = require('../models/AssignmentRequest');
const { findLecturerForUser } = require('../utils/lecturerResolver');
const { sendPasswordResetEmail, sendNewPasswordEmail } = require('../utils/email');
const { hashPassword, comparePassword, hashToken } = require('../utils/passwordUtils');

/**
 * Register a new user with hashed credentials.
 */
exports.registerUser = async (req, res) => {
  const { username, password, role, email, department } = req.body;

  try {
    if (!username || !password || !email) {
      return res.status(400).json({ success: false, message: 'Username, password, and email are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    // Prevent privilege escalation: public registration cannot create admin accounts
    let normalizedRole = (role || 'student').toLowerCase();
    if (normalizedRole === 'admin') {
      const callerRole = (req.user?.role || '').toLowerCase();
      if (callerRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Administrative accounts cannot be created via public registration'
        });
      }
    } else if (!['student', 'lecturer'].includes(normalizedRole)) {
      normalizedRole = 'student';
    }

    const existingUser = await User.findOne({ 
      $or: [{ username: username.trim() }, { email: email.trim().toLowerCase() }] 
    });

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Username or email is already registered' });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await User.create({
      username: username.trim(),
      password: hashedPassword,
      email: email.trim().toLowerCase(),
      role: normalizedRole,
      department: department ? department.trim() : undefined
    });

    // Link existing Lecturer profile or create one for newly registered lecturers
    if (normalizedRole === 'lecturer') {
      const existingLecturer = await Lecturer.findOne({ email: newUser.email });
      if (existingLecturer) {
        existingLecturer.userId = newUser._id;
        await existingLecturer.save();
      } else {
        await Lecturer.create({
          userId: newUser._id,
          name: newUser.username,
          email: newUser.email,
          department: newUser.department || 'General',
          rank: 'Lecturer'
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department
      }
    });
  } catch (error) {
    console.error('RegisterUser error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during registration' });
  }
};

/**
 * Authenticate user credentials and return JWT.
 */
exports.loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const config = require('../config/env')();
    const token = signJwtToken(
      { 
        id: user._id, 
        role: (user.role || 'lecturer').toLowerCase(), 
        department: user.department 
      },
      config.JWT_SECRET,
      config.JWT_EXPIRES_IN
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: (user.role || '').toLowerCase(),
        department: user.department
      }
    });
  } catch (error) {
    console.error('LoginUser error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during login' });
  }
};

/**
 * Request password reset token.
 * Prevents account enumeration by always returning a generic success message.
 */
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    
    if (user) {
      // Generate unguessable 32-byte token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = hashToken(rawToken);

      // Short 15-minute expiry
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
      await user.save();

      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${rawToken}`;
      try {
        await sendPasswordResetEmail(user.email, user.username, resetLink);
      } catch (mailError) {
        console.error('Failed to send reset email:', mailError.message);
      }
    }

    // Always return uniform response to protect against user enumeration
    res.status(200).json({
      success: true,
      message: 'If an account associated with that email exists, password reset instructions have been dispatched.'
    });
  } catch (error) {
    console.error('ForgotPassword error:', error);
    res.status(500).json({ success: false, message: 'Internal server error processing reset request' });
  }
};

/**
 * Reset password using hashed single-use token.
 */
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired password reset token' });
    }

    user.password = await hashPassword(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    try {
      await sendNewPasswordEmail(user.email, user.username);
    } catch (mailError) {
      console.error('Failed to send password reset confirmation email:', mailError.message);
    }

    res.status(200).json({ success: true, message: 'Password has been reset successfully. You may now log in.' });
  } catch (error) {
    console.error('ResetPassword error:', error);
    res.status(500).json({ success: false, message: 'Internal server error resetting password' });
  }
};

/**
 * Get authenticated user profile.
 */
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -resetPasswordToken -resetPasswordExpires');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('GetUserProfile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error retrieving user profile' });
  }
};

/**
 * Student: View exam schedule for their enrolled department.
 */
exports.getStudentTimetable = async (req, res) => {
  try {
    const department = req.user.department;
    if (!department) {
      return res.status(400).json({ success: false, message: 'No department assigned to this student profile' });
    }

    const exams = await Exam.find({ 'subjects.department': department, status: { $ne: 'Finished' } })
      .select('date startTime endTime subjects');

    const studentView = exams.flatMap(exam =>
      exam.subjects
        .filter(subject => subject.department === department)
        .map(subject => ({
          date: exam.date,
          time: `${exam.startTime} - ${exam.endTime}`,
          subject: subject.name,
          code: subject.code,
          totalStudents: subject.studentCount + (subject.repeaters || 0),
          hall: subject.assignedHall || 'TBD'
        }))
    );

    res.status(200).json({
      success: true,
      data: studentView
    });
  } catch (error) {
    console.error('getStudentTimetable error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student timetable'
    });
  }
};

/**
 * Lecturer: Get assigned supervision notifications.
 */
exports.getLecturerNotifications = async (req, res) => {
  try {
    const lecturerId = req.user.id;

    const requests = await AssignmentRequest.find({
      $or: [
        { requestedLecturer: lecturerId },
        { supervisors: lecturerId },
        { invigilators: lecturerId }
      ],
      status: { $in: ['Assigned', 'pending', 'Accepted'] }
    }).populate('examId');

    const notifications = requests.map(r => ({
      id: r._id,
      subject: r.subjectCode,
      date: r.date || (r.timeSlot && r.timeSlot.date),
      time: r.startTime && r.endTime ? `${r.startTime} - ${r.endTime}` : 'TBD',
      status: r.status,
      message: `You are assigned to supervise/invigilate ${r.subjectCode}`
    }));

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error('GetLecturerNotifications error:', error);
    res.status(500).json({ success: false, message: 'Internal server error retrieving lecturer notifications' });
  }
};

/**
 * Admin: Get detailed exam assignment report.
 */
exports.getExamAssignmentReport = async (req, res) => {
  try {
    const exams = await Exam.find();

    const report = exams.flatMap(exam =>
      exam.subjects.map(subject => ({
        date: exam.date,
        time: `${exam.startTime} - ${exam.endTime}`,
        subject: subject.name,
        degree: subject.department,
        venue: subject.assignedHall || 'TBD',
        supervisor: subject.assignedSupervisor || 'TBD',
        invigilator: subject.assignedInvigilator || 'TBD'
      }))
    );

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('GetExamAssignmentReport error:', error);
    res.status(500).json({ success: false, message: 'Internal server error generating assignment report' });
  }
};
