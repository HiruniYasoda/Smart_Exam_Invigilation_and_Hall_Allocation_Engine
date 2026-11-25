const AssignmentRequest = require('../models/AssignmentRequest');
const Exam = require('../models/Exam');
const Lecturer = require('../models/Lecturer');
const Hall = require('../models/Hall');
const OverrideLog = require('../models/OverrideLog');

/**
 * @desc Log override actions like manual changes to halls, lecturers, etc.
 * @route POST /api/assignments/override-log
 * @access Admin
 */
exports.logOverrides = async (req, res) => {
  try {
    const { action, target, targetId, details } = req.body;

    if (!action || !target || !targetId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const log = await OverrideLog.create({
      user: req.user._id || req.user.id,
      action,
      target,
      targetId,
      details
    });

    return res.status(201).json({ success: true, message: 'Override logged', log });
  } catch (error) {
    console.error('Error logging override:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * @desc Manually override an exam allocation (supervisors, invigilators, hall) and record OverrideLog
 * @route POST /api/assignments/override
 * @access Admin
 */
exports.overrideAllocation = async (req, res) => {
  try {
    const { assignmentId, supervisorIds, invigilatorIds, hall, reason } = req.body;

    if (!assignmentId) {
      return res.status(400).json({ success: false, message: 'assignmentId is required' });
    }

    const assignment = await AssignmentRequest.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const nextSupervisors = Array.isArray(supervisorIds) ? supervisorIds : assignment.supervisors;
    const nextInvigilators = Array.isArray(invigilatorIds) ? invigilatorIds : assignment.invigilators;
    const nextHallName = hall !== undefined ? hall : assignment.hall;

    let resolvedHallId = assignment.hallId;
    if (hall !== undefined) {
      const hallDoc = await Hall.findOne({ name: hall });
      resolvedHallId = hallDoc?._id || null;
    }

    assignment.supervisors = nextSupervisors;
    assignment.invigilators = nextInvigilators;
    assignment.hall = nextHallName;
    assignment.hallId = resolvedHallId;
    await assignment.save();

    const [supDocs, invDocs] = await Promise.all([
      Lecturer.find({ _id: { $in: nextSupervisors } }).select('name'),
      Lecturer.find({ _id: { $in: nextInvigilators } }).select('name')
    ]);

    const supervisorNames = supDocs.map(s => s.name);
    const invigilatorNames = invDocs.map(i => i.name);

    // Sync Exam subject display fields
    const exam = await Exam.findById(assignment.examId);
    if (exam) {
      const subject = exam.subjects.find(s => s.code === assignment.subjectCode);
      if (subject) {
        if (nextHallName) subject.assignedHall = nextHallName;
        subject.assignedSupervisor = supervisorNames.join(', ');
        subject.assignedInvigilator = invigilatorNames.join(', ');
        await exam.save();
      }
    }

    // Update hall bookings: remove old booking for this exam+subject, add new one
    await Hall.updateMany(
      { 'bookings.examId': assignment.examId, 'bookings.subject': assignment.subjectCode },
      { $pull: { bookings: { examId: assignment.examId, subject: assignment.subjectCode } } }
    );

    if (resolvedHallId) {
      await Hall.findByIdAndUpdate(resolvedHallId, {
        $push: {
          bookings: {
            date: assignment.date,
            startTime: assignment.startTime,
            endTime: assignment.endTime,
            subject: assignment.subjectCode,
            examId: assignment.examId
          }
        }
      });
    }

    const log = await OverrideLog.create({
      user: req.user._id || req.user.id,
      action: 'MANUAL_OVERRIDE',
      target: 'AssignmentRequest',
      targetId: assignment._id.toString(),
      details: {
        subjectCode: assignment.subjectCode,
        subjectName: assignment.subjectName,
        date: assignment.date,
        hall: nextHallName || 'TBD',
        supervisors: supervisorNames,
        invigilators: invigilatorNames,
        reason: reason || ''
      }
    });

    const populated = await AssignmentRequest.findById(assignment._id)
      .populate('examId')
      .populate('supervisors', 'name email rank')
      .populate('invigilators', 'name email rank');

    res.status(200).json({
      success: true,
      message: 'Allocation overridden successfully',
      assignment: populated,
      log
    });
  } catch (error) {
    console.error('overrideAllocation error:', error);
    res.status(500).json({ success: false, message: 'Failed to override allocation' });
  }
};

/**
 * @desc List recent manual override audit logs
 * @route GET /api/assignments/overrides
 * @access Admin
 */
exports.getOverrideLogs = async (req, res) => {
  try {
    const logs = await OverrideLog.find()
      .populate('user', 'username email role')
      .sort({ timestamp: -1 })
      .limit(100);

    res.status(200).json({ success: true, logs });
  } catch (error) {
    console.error('getOverrideLogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve override logs' });
  }
};
