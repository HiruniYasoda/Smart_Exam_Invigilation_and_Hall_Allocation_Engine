const AssignmentRequest = require('../models/AssignmentRequest');
const Exam = require('../models/Exam');
const Hall = require('../models/Hall');
const Lecturer = require('../models/Lecturer');
const { createNotification } = require('../utils/notificationMessage');
const allocationService = require('../services/allocationService');

/**
 * Controller: Assignment, Invigilation, and Session Lifecycle Management
 */

// POST /assignments/request
const createRequest = async (req, res) => {
  try {
    const { assignmentDetails, dueDate, lecturerId, courseId } = req.body;

    if (!assignmentDetails || !dueDate || !lecturerId || !courseId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Required fields missing: assignmentDetails, dueDate, lecturerId, and courseId are mandatory.' 
      });
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
      success: true,
      message: 'Assignment request created successfully',
      request: savedRequest,
    });
  } catch (error) {
    console.error('Error creating assignment request:', error);
    return res.status(500).json({ success: false, message: 'Server error processing assignment request' });
  }
};

// GET /assignments/lecturer/schedule
const getLecturerSchedule = async (req, res) => {
  try {
    const schedule = await AssignmentRequest.find({
      $or: [
        { lecturerId: req.user.id },
        { requestedLecturer: req.user.id },
        { supervisors: req.user.id },
        { invigilators: req.user.id }
      ]
    }).populate('examId');

    res.status(200).json({ success: true, schedule });
  } catch (err) {
    console.error('getLecturerSchedule error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve lecturer schedule' });
  }
};

// GET /assignments/admin/view
const viewAllRequests = async (req, res) => {
  try {
    const requests = await AssignmentRequest.find()
      .populate('examId')
      .populate('supervisors', 'name email rank')
      .populate('invigilators', 'name email rank');

    res.status(200).json({ success: true, requests });
  } catch (err) {
    console.error('viewAllRequests error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve assignment requests' });
  }
};

// PUT /assignments/status/:id
const updateRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['pending', 'Accepted', 'Assigned', 'Rejected', 'Finished'];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` 
      });
    }

    const request = await AssignmentRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Assignment request not found' });
    }

    // Server-side ownership / role authorization check
    const userRole = (req.user.role || '').toLowerCase();
    const isOwner = request.lecturerId?.toString() === req.user._id.toString() ||
                    request.requestedLecturer?.toString() === req.user._id.toString();

    if (userRole !== 'admin' && !isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot modify this assignment' });
    }

    request.status = status;
    const updated = await request.save();

    res.status(200).json({ success: true, message: 'Status updated successfully', updated });
  } catch (err) {
    console.error('updateRequestStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update request status' });
  }
};

// POST /assignments/finish
const markSessionAsFinished = async (req, res) => {
  try {
    const { examId, subjectCode } = req.body;

    if (!examId || !subjectCode) {
      return res.status(400).json({ success: false, message: 'examId and subjectCode are required' });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }

    const subject = exam.subjects.find(sub => sub.code === subjectCode);
    if (!subject) {
      return res.status(404).json({ success: false, message: `Subject code ${subjectCode} not found in this exam` });
    }

    // Role and ownership verification: only admin or assigned supervisor can mark as finished
    const userRole = (req.user.role || '').toLowerCase();
    if (userRole !== 'admin' && userRole !== 'lecturer') {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges' });
    }

    // Update session status in DB
    await AssignmentRequest.updateMany(
      { examId, subjectCode },
      { $set: { status: 'Finished' } }
    );

    const requiredCount = (subject.studentCount || 0) + (subject.repeaters || 0);
    const halls = await Hall.find();
    const availableHalls = allocationService.findAvailableHalls(
      halls,
      exam.date,
      exam.startTime,
      exam.endTime,
      requiredCount
    );

    const result = {
      success: true,
      message: 'Exam session marked as finished successfully.',
      examId,
      subjectCode,
      availableHallsCount: availableHalls.length,
      suitableHallsAvailable: availableHalls.length > 0
    };

    if (availableHalls.length === 0) {
      const warning = `No suitable hall meeting capacity (${requiredCount}) found for ${subject.name} (${subjectCode}) on ${exam.date}`;
      try {
        await createNotification(req.user.id, warning);
      } catch (e) {
        console.error('Notification dispatch error:', e.message);
      }
      result.warning = warning;
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('markSessionAsFinished error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark session as finished' });
  }
};

// GET /assignments/conflicts
const checkConflicts = async (req, res) => {
  try {
    const { date } = req.query;
    const filter = date ? { date } : {};

    const assignments = await AssignmentRequest.find(filter);
    const conflicts = [];

    // Detect overlapping supervisor/invigilator allocations on the same date
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const a1 = assignments[i];
        const a2 = assignments[j];

        if (a1.date === a2.date && allocationService.checkTimeOverlap(a1.startTime, a1.endTime, a2.startTime, a2.endTime)) {
          // Check shared supervisors
          const commonSupervisors = (a1.supervisors || []).filter(s =>
            (a2.supervisors || []).some(s2 => s2.toString() === s.toString())
          );

          if (commonSupervisors.length > 0) {
            conflicts.push({
              type: 'SUPERVISOR_COLLISION',
              date: a1.date,
              subjects: [a1.subjectCode, a2.subjectCode],
              conflictingStaffIds: commonSupervisors
            });
          }
        }
      }
    }

    res.status(200).json({ success: true, count: conflicts.length, conflicts });
  } catch (err) {
    console.error('checkConflicts error:', err);
    res.status(500).json({ success: false, message: 'Failed to calculate scheduling conflicts' });
  }
};

// POST /assignments/auto-assign
const autoAssignInvigilators = async (req, res) => {
  try {
    const exams = await Exam.find({ status: { $ne: 'Finished' } });
    const lecturers = await Lecturer.find().lean();
    const halls = await Hall.find().lean();

    if (exams.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No open exam sessions found for allocation.', 
        data: [] 
      });
    }

    const { assignments, warnings } = allocationService.autoAllocateStaff(exams, lecturers, halls);

    // Persist allocations, exam metadata, and hall bookings
    for (const alloc of assignments) {
      await AssignmentRequest.findOneAndUpdate(
        { examId: alloc.examId, subjectCode: alloc.subjectCode },
        {
          examId: alloc.examId,
          subjectCode: alloc.subjectCode,
          subjectName: alloc.subjectName,
          department: alloc.department,
          studentCount: alloc.studentCount,
          date: alloc.date,
          startTime: alloc.startTime,
          endTime: alloc.endTime,
          hallId: alloc.hallId || undefined,
          hall: alloc.hall || undefined,
          supervisors: alloc.supervisorIds,
          invigilators: alloc.invigilatorIds,
          status: 'Assigned'
        },
        { upsert: true, new: true }
      );

      // Sync summary fields onto the Exam subject subdocument
      const examDoc = exams.find(e => e._id.toString() === alloc.examId.toString());
      if (examDoc) {
        const subjectDoc = examDoc.subjects.find(s => s.code === alloc.subjectCode);
        if (subjectDoc) {
          if (alloc.hall) subjectDoc.assignedHall = alloc.hall;
          if (alloc.supervisorNames.length > 0) {
            subjectDoc.assignedSupervisor = alloc.supervisorNames.join(', ');
          }
          if (alloc.invigilatorNames.length > 0) {
            subjectDoc.assignedInvigilator = alloc.invigilatorNames.join(', ');
          }
        }
      }

      // Persist hall booking if not already recorded
      if (alloc.hallId) {
        await Hall.updateOne(
          {
            _id: alloc.hallId,
            bookings: {
              $not: {
                $elemMatch: {
                  examId: alloc.examId,
                  subject: alloc.subjectCode
                }
              }
            }
          },
          {
            $push: {
              bookings: {
                date: alloc.date,
                startTime: alloc.startTime,
                endTime: alloc.endTime,
                subject: alloc.subjectCode,
                examId: alloc.examId
              }
            }
          }
        );
      }
    }

    await Promise.all(exams.map(e => e.save()));

    // Notify administrator of any staffing shortages
    if (warnings.length > 0) {
      for (const warning of warnings) {
        try {
          await createNotification(req.user.id, warning);
        } catch (e) {
          console.error('Notification dispatch error:', e.message);
        }
      }
    }

    res.status(200).json({ 
      success: true, 
      message: 'Automatic allocation completed successfully.', 
      data: assignments,
      warnings 
    });
  } catch (error) {
    console.error('autoAssignInvigilators error:', error);
    res.status(500).json({ success: false, message: 'Auto allocation process failed' });
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
