// controllers/assignmentController.js

const AssignmentRequest = require('../models/AssignmentRequest');
const Exam = require('../models/Exam');
const Hall = require('../models/Hall');
const HallBooking = require('../models/HallBooking');
const Lecturer = require('../models/Lecturer');
const { hasTimeOverlap } = require('../utils/timeUtils');
const { createNotification } = require('../utils/notificationMessage');

// Helper Functions
function getRequiredCounts(studentCount) {
  const supervisors = Math.ceil(studentCount / 180);
  let invigilators = 1;
  if (studentCount > 25) {
    invigilators += Math.ceil((studentCount - 25) / 15);
  }
  return { supervisors, invigilators };
}

function isLecturerAvailable(lecturer, date, startTime, endTime) {
  const hasConflict = lecturer.assignments?.some(a =>
    a.date === date && hasTimeOverlap(startTime, endTime, a.startTime, a.endTime)
  );
  const isUnavailable = lecturer.unavailable?.some(a =>
    a.date === date && hasTimeOverlap(startTime, endTime, a.startTime, a.endTime)
  );
  return !hasConflict && !isUnavailable;
}

// Controller Functions

// POST /assignments/request
const createRequest = async (req, res) => {
  try {
    const { assignmentDetails, dueDate, lecturerId, courseId } = req.body;

    if (!assignmentDetails || !dueDate || !lecturerId || !courseId) {
      return res.status(400).json({ message: 'Please provide all required fields: assignmentDetails, dueDate, lecturerId, and courseId' });
    }

    const newRequest = new AssignmentRequest({
      assignmentDetails,
      dueDate,
      lecturerId,
      courseId,
      status: 'pending',
      createdBy: req.user._id,
    });

    const savedRequest = await newRequest.save();

    return res.status(201).json({
      message: 'Assignment request created successfully',
      request: savedRequest,
    });
  } catch (error) {
    console.error('Error creating assignment request:', error);
    return res.status(500).json({ message: 'Server error, please try again later' });
  }
};

// GET /assignments/lecturer/schedule
const getLecturerSchedule = async (req, res) => {
  try {
    const schedule = await AssignmentRequest.find({ lecturerId: req.user.id });
    res.status(200).json({ success: true, schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /assignments/admin/view
const viewAllRequests = async (req, res) => {
  try {
    const requests = await AssignmentRequest.find();
    res.status(200).json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /assignments/status/:id
const updateRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await AssignmentRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    res.status(200).json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /assignments/finish
const markSessionAsFinished = async (req, res) => {
  try {
    const { examId, subjectCode } = req.body;

    // Mark session finished
    await AssignmentRequest.updateMany(
      { examId, subjectCode },
      { $set: { status: 'Finished' } }
    );

    // Fetch exam and hall details
    const exam = await Exam.findById(examId);
    const halls = await Hall.find();
    const subject = exam.subjects.find(sub => sub.code === subjectCode);
    const requiredCount = subject.studentCount + subject.repeaters;

    const { date, startTime, endTime } = exam;

    // Check if there's ANY hall available for that time period and capacity
    const hallsAvailable = halls.filter(hall => {
      const overlappingBooking = hall.bookings?.some(booking =>
        booking.date === date &&
        !(endTime <= booking.startTime || startTime >= booking.endTime)
      );
      return !overlappingBooking && hall.capacity >= requiredCount;
    });

    if (hallsAvailable.length === 0) {
      const message = `🚨 No suitable hall found for "${subject.name}" (${subjectCode}) on ${date} between ${startTime}-${endTime}. Either halls are fully booked or too small for ${requiredCount} students. Consider splitting or changing time.`;

      // Notify the admin
      await createNotification(req.user.id, message);

      return res.send(`
        <h3 style="color:orange">Session marked as finished, but:</h3>
        <p style="color:red">${message}</p>
      `);
    }

    res.send('<h3 style="color:green">Session marked as finished successfully. Suitable halls available.</h3>');
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to mark session as finished.', error: error.message });
  }
};

// GET /assignments/conflicts
const checkConflicts = async (req, res) => {
  res.status(200).json({ message: 'No conflicts found (placeholder)' });
};

// POST /assignments/auto-assign
const autoAssignInvigilators = async (req, res) => {
  try {
    const exams = await Exam.find();
    let lecturers = await Lecturer.find().lean();
    const assignments = [];

    // Sort lecturers by rank (lowest first = highest qualified)
    lecturers.sort((a, b) => a.rank - b.rank);

    for (const exam of exams) {
      const { date, startTime, endTime } = exam;

      for (const subject of exam.subjects) {
        const totalStudents = subject.studentCount;
        const { supervisors: supCount, invigilators: invCount } = getRequiredCounts(totalStudents);
        const assignment = {
          examId: exam._id,
          subjectCode: subject.code,
          subject: subject.name,
          date,
          startTime,
          endTime,
          supervisorIds: [],
          invigilatorIds: []
        };

        // Supervisor allocation
        let supervisors = [];
        const setter = lecturers.find(l => l._id.toString() === subject.setterId?.toString());

        if (
          setter &&
          !setter.isTL &&
          isLecturerAvailable(setter, date, startTime, endTime)
        ) {
          supervisors.push(setter);
          setter.assignments.push({ date, startTime, endTime });
        }

        // Allocate other supervisors if needed
        let eligibleSupervisors = lecturers.filter(l =>
          !l.isTL &&
          isLecturerAvailable(l, date, startTime, endTime) &&
          l.faculty === subject.faculty &&
          !supervisors.includes(l)
        );

        for (const sup of eligibleSupervisors) {
          if (supervisors.length >= supCount) break;
          supervisors.push(sup);
          sup.assignments.push({ date, startTime, endTime });
        }

        if (supervisors.length < supCount) {
          await createNotification(req.user.id, `❗ Not enough supervisors for ${subject.name} (${subject.code}) on ${date}`);
        }

        assignment.supervisorIds = supervisors.map(s => s._id);

        // Invigilator allocation
        let invigilators = [];
        const lowestSupervisorRank = Math.max(...supervisors.map(s => s.rank));

        const eligibleInvigilators = lecturers.filter(l =>
          isLecturerAvailable(l, date, startTime, endTime) &&
          l.rank > lowestSupervisorRank && // must be lower rank
          !supervisors.includes(l)
        );

        for (const inv of eligibleInvigilators) {
          if (invigilators.length >= invCount) break;
          invigilators.push(inv);
          inv.assignments.push({ date, startTime, endTime });
        }

        if (invigilators.length < invCount) {
          await createNotification(req.user.id, `❗ Not enough invigilators for ${subject.name} (${subject.code}) on ${date}`);
        }

        assignment.invigilatorIds = invigilators.map(i => i._id);

        // Save to DB
        await AssignmentRequest.create({
          examId: exam._id,
          subjectCode: subject.code,
          date,
          startTime,
          endTime,
          supervisors: assignment.supervisorIds,
          invigilators: assignment.invigilatorIds,
          status: 'Assigned'
        });

        assignments.push(assignment);
      }
    }

    res.status(200).json({ message: 'Auto allocation completed.', data: assignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Auto allocation failed.', error: error.message });
  }
};

module.exports = {
  createRequest,
  getLecturerSchedule,
  viewAllRequests,
  updateRequestStatus,
  markSessionAsFinished,
  checkConflicts,
  autoAssignInvigilators
};
