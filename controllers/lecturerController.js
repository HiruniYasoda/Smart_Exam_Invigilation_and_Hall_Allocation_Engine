const Lecturer = require('../models/Lecturer');
const AssignmentRequest = require('../models/AssignmentRequest');
const Exam = require('../models/Exam');

// Create Lecturer
exports.createLecturer = async (req, res) => {
  try {
    const lecturer = await Lecturer.create(req.body);
    res.status(201).json(lecturer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create lecturer' });
  }
};

// Update Lecturer
exports.updateLecturer = async (req, res) => {
  try {
    const lecturer = await Lecturer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(lecturer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update lecturer' });
  }
};

// Get All Lecturers
exports.getAllLecturers = async (req, res) => {
  try {
    const lecturers = await Lecturer.find();
    res.json(lecturers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lecturers' });
  }
};

// Get Available Lecturers for a Time Slot
exports.getAvailableLecturers = async (req, res) => {
  const { date, startTime, endTime } = req.query;

  try {
    const allLecturers = await Lecturer.find();

    const assignedRequests = await AssignmentRequest.find({
      'timeSlot.date': new Date(date),
      $or: [
        {
          'timeSlot.startTime': { $lt: endTime },
          'timeSlot.endTime': { $gt: startTime }
        }
      ],
      status: 'Accepted'
    });

    const assignedLecturerIds = assignedRequests.map(req => req.requestedLecturer.toString());

    const availableLecturers = allLecturers.filter(
      l => !assignedLecturerIds.includes(l._id.toString())
    );

    res.json(availableLecturers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch available lecturers' });
  }
};

// Assign a Lecturer to an Exam
exports.assignLecturer = async (req, res) => {
  const { lecturerId, examId, date, startTime, endTime } = req.body;

  try {
    const conflictingAssignment = await AssignmentRequest.findOne({
      requestedLecturer: lecturerId,
      'timeSlot.date': new Date(date),
      $or: [
        {
          'timeSlot.startTime': { $lt: endTime },
          'timeSlot.endTime': { $gt: startTime }
        }
      ],
      status: 'Accepted'
    });

    if (conflictingAssignment) {
      return res.status(400).json({ error: 'Lecturer already assigned to another exam at this time' });
    }

    const newRequest = await AssignmentRequest.create({
      examId,
      requestedLecturer: lecturerId,
      timeSlot: {
        date: new Date(date),
        startTime,
        endTime
      },
      status: 'Accepted'
    });

    res.status(201).json(newRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign lecturer' });
  }
};

// Unassign Lecturer from Exam
exports.unassignLecturer = async (req, res) => {
  const { lecturerId, examId } = req.body;

  try {
    const deleted = await AssignmentRequest.findOneAndDelete({
      requestedLecturer: lecturerId,
      examId,
      status: 'Accepted'
    });

    if (!deleted) {
      return res.status(404).json({ error: 'No such assignment found' });
    }

    res.json({ message: 'Lecturer unassigned successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unassign lecturer' });
  }
};

// Get Exam Schedule for Logged-in Lecturer
exports.getLecturerExamSchedule = async (req, res) => {
  try {
    const lecturer = await Lecturer.findById(req.user.id);
    if (!lecturer) {
      return res.status(404).json({ error: 'Lecturer not found' });
    }

    const assignments = await AssignmentRequest.find({
      requestedLecturer: lecturer._id,
      status: 'Accepted'
    }).populate('examId');

    const schedule = assignments.map(r => ({
      date: r.timeSlot.date,
      startTime: r.timeSlot.startTime,
      endTime: r.timeSlot.endTime,
      hallNumber: r.examId?.hallNumber || 'Not Assigned',
      subject: r.examId?.subjectCode || 'N/A',
      capacity: r.examId?.capacity || 0
    }));

    res.json(schedule);
  } catch (err) {
    console.error('Failed to fetch lecturer exam schedule:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
