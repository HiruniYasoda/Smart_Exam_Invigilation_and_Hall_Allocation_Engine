const Lecturer = require('../models/Lecturer');
const User = require('../models/User');
const AssignmentRequest = require('../models/AssignmentRequest');
const { checkTimeOverlap } = require('../services/allocationService');
const { findLecturerForUser } = require('../utils/lecturerResolver');

// Create Lecturer
exports.createLecturer = async (req, res) => {
  try {
    const { name, email, department, rank, contact } = req.body;
    if (!name || !email || !department) {
      return res.status(400).json({ error: 'Name, email, and department are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await Lecturer.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'A lecturer with this email already exists' });
    }

    const linkedUser = await User.findOne({ email: normalizedEmail }).select('_id');
    const lecturer = await Lecturer.create({
      userId: linkedUser?._id,
      name: name.trim(),
      email: normalizedEmail,
      department: department.trim(),
      rank: rank || '-',
      contact: contact ? contact.trim() : ''
    });

    res.status(201).json(lecturer);
  } catch (err) {
    console.error('createLecturer error:', err);
    res.status(500).json({ error: 'Failed to create lecturer' });
  }
};

// Update Lecturer
exports.updateLecturer = async (req, res) => {
  try {
    const lecturer = await Lecturer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!lecturer) {
      return res.status(404).json({ error: 'Lecturer not found' });
    }
    res.json(lecturer);
  } catch (err) {
    console.error('updateLecturer error:', err);
    res.status(500).json({ error: 'Failed to update lecturer' });
  }
};

// Delete Lecturer
exports.deleteLecturer = async (req, res) => {
  try {
    const lecturer = await Lecturer.findByIdAndDelete(req.params.id);
    if (!lecturer) {
      return res.status(404).json({ success: false, message: 'Lecturer not found' });
    }
    res.status(200).json({ success: true, message: 'Lecturer deleted successfully' });
  } catch (err) {
    console.error('deleteLecturer error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete lecturer' });
  }
};

// Get All Lecturers
exports.getAllLecturers = async (req, res) => {
  try {
    const lecturers = await Lecturer.find().sort({ name: 1 });
    res.json(lecturers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lecturers' });
  }
};

// Get Available Lecturers for a Time Slot
exports.getAvailableLecturers = async (req, res) => {
  const { date, startTime, endTime } = req.query;

  try {
    const allLecturers = await Lecturer.find().lean();

    if (!date || !startTime || !endTime) {
      return res.json(allLecturers);
    }

    const activeAssignments = await AssignmentRequest.find({
      date,
      status: { $ne: 'Finished' }
    }).lean();

    const busyLecturerIds = new Set();
    for (const assignment of activeAssignments) {
      if (checkTimeOverlap(startTime, endTime, assignment.startTime, assignment.endTime)) {
        (assignment.supervisors || []).forEach(id => busyLecturerIds.add(id.toString()));
        (assignment.invigilators || []).forEach(id => busyLecturerIds.add(id.toString()));
      }
    }

    const availableLecturers = allLecturers.filter(lecturer => {
      if (busyLecturerIds.has(lecturer._id.toString())) return false;
      const markedUnavailable = (lecturer.unavailable || []).some(
        u => u.date === date && checkTimeOverlap(startTime, endTime, u.startTime, u.endTime)
      );
      return !markedUnavailable;
    });

    res.json(availableLecturers);
  } catch (err) {
    console.error('getAvailableLecturers error:', err);
    res.status(500).json({ error: 'Failed to fetch available lecturers' });
  }
};

// Assign a Lecturer to an Exam
exports.assignLecturer = async (req, res) => {
  const { lecturerId, examId, subjectCode, role = 'invigilator', date, startTime, endTime } = req.body;

  try {
    if (!lecturerId || !examId || !subjectCode || !date || !startTime || !endTime) {
      return res.status(400).json({
        error: 'lecturerId, examId, subjectCode, date, startTime, and endTime are required'
      });
    }

    const sameDayAssignments = await AssignmentRequest.find({
      date,
      status: { $ne: 'Finished' },
      $or: [{ supervisors: lecturerId }, { invigilators: lecturerId }]
    });

    const hasConflict = sameDayAssignments.some(a =>
      !(a.examId.toString() === examId.toString() && a.subjectCode === subjectCode) &&
      checkTimeOverlap(startTime, endTime, a.startTime, a.endTime)
    );

    if (hasConflict) {
      return res.status(400).json({ error: 'Lecturer already assigned to another exam at this time' });
    }

    const field = role === 'supervisor' ? 'supervisors' : 'invigilators';
    const updated = await AssignmentRequest.findOneAndUpdate(
      { examId, subjectCode },
      {
        $setOnInsert: { examId, subjectCode, date, startTime, endTime, status: 'Assigned' },
        $addToSet: { [field]: lecturerId }
      },
      { upsert: true, new: true }
    );

    res.status(201).json(updated);
  } catch (err) {
    console.error('assignLecturer error:', err);
    res.status(500).json({ error: 'Failed to assign lecturer' });
  }
};

// Unassign Lecturer from Exam
exports.unassignLecturer = async (req, res) => {
  const { lecturerId, examId, subjectCode } = req.body;

  try {
    const query = subjectCode ? { examId, subjectCode } : { examId };
    const updated = await AssignmentRequest.findOneAndUpdate(
      query,
      { $pull: { supervisors: lecturerId, invigilators: lecturerId } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'No such assignment found' });
    }

    res.json({ message: 'Lecturer unassigned successfully', assignment: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unassign lecturer' });
  }
};

// Get Exam Schedule for Logged-in Lecturer
exports.getLecturerExamSchedule = async (req, res) => {
  try {
    const lecturer = await findLecturerForUser(req.user);
    if (!lecturer) {
      return res.status(200).json([]);
    }

    const assignments = await AssignmentRequest.find({
      $or: [{ supervisors: lecturer._id }, { invigilators: lecturer._id }]
    }).populate('examId');

    const schedule = assignments.map(r => {
      const isSupervisor = (r.supervisors || []).some(
        id => id.toString() === lecturer._id.toString()
      );
      const subjectInfo = r.examId?.subjects?.find(s => s.code === r.subjectCode);
      return {
        _id: r._id,
        examId: r.examId?._id || r.examId,
        date: r.date,
        startTime: r.startTime,
        endTime: r.endTime,
        hallNumber: r.hall || subjectInfo?.assignedHall || 'TBD',
        subject: r.subjectName || subjectInfo?.name || r.subjectCode,
        subjectCode: r.subjectCode,
        department: r.department || subjectInfo?.department || '',
        studentCount: r.studentCount || ((subjectInfo?.studentCount || 0) + (subjectInfo?.repeaters || 0)),
        role: isSupervisor ? 'Supervisor' : 'Invigilator',
        status: r.status
      };
    });

    res.json(schedule);
  } catch (err) {
    console.error('Failed to fetch lecturer exam schedule:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
