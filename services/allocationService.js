const { hasTimeOverlap } = require('../utils/timeUtils');

/**
 * Service Layer: Exam Invigilation, Supervision & Hall Allocation Policies
 */

/**
 * Calculates the required count of supervisors and invigilators for a given student count.
 * Rules:
 * - 1 supervisor per 180 students (ceil(studentCount / 180))
 * - Base of 1 invigilator; if studentCount > 25, +1 additional invigilator per each 15 students
 * 
 * @param {number} studentCount 
 * @returns {{ supervisors: number, invigilators: number }}
 */
function calculateRequiredStaff(studentCount) {
  const count = Math.max(0, parseInt(studentCount, 10) || 0);
  const supervisors = count === 0 ? 0 : Math.ceil(count / 180);

  let invigilators = count === 0 ? 0 : 1;
  if (count > 25) {
    invigilators += Math.ceil((count - 25) / 15);
  }

  return { supervisors, invigilators };
}

/**
 * Evaluates whether two time intervals on the same date overlap.
 * @param {string} start1 
 * @param {string} end1 
 * @param {string} start2 
 * @param {string} end2 
 * @returns {boolean}
 */
function checkTimeOverlap(start1, end1, start2, end2) {
  if (typeof hasTimeOverlap === 'function') {
    return hasTimeOverlap(start1, end1, start2, end2);
  }
  return !(end1 <= start2 || start1 >= end2);
}

/**
 * Checks whether a lecturer is free from scheduled duties and declared unavailabilities.
 * 
 * @param {object} lecturer 
 * @param {string} date 
 * @param {string} startTime 
 * @param {string} endTime 
 * @returns {boolean}
 */
function isLecturerAvailable(lecturer, date, startTime, endTime) {
  if (!lecturer) return false;

  const hasAssignmentConflict = (lecturer.assignments || []).some(a =>
    a.date === date && checkTimeOverlap(startTime, endTime, a.startTime, a.endTime)
  );

  const hasUnavailabilityConflict = (lecturer.unavailable || []).some(u =>
    u.date === date && checkTimeOverlap(startTime, endTime, u.startTime, u.endTime)
  );

  return !hasAssignmentConflict && !hasUnavailabilityConflict;
}

/**
 * Evaluates whether a hall is free from overlapping bookings and meets capacity.
 * 
 * @param {object} hall 
 * @param {string} date 
 * @param {string} startTime 
 * @param {string} endTime 
 * @param {number} requiredCapacity 
 * @returns {boolean}
 */
function isHallAvailable(hall, date, startTime, endTime, requiredCapacity) {
  if (!hall) return false;
  if ((hall.capacity || 0) < requiredCapacity) return false;

  const hasBookingConflict = (hall.bookings || []).some(booking =>
    booking.date === date && checkTimeOverlap(startTime, endTime, booking.startTime, booking.endTime)
  );

  return !hasBookingConflict;
}

/**
 * Filters a collection of halls returning only those that satisfy capacity and time availability.
 * 
 * @param {Array} halls 
 * @param {string} date 
 * @param {string} startTime 
 * @param {string} endTime 
 * @param {number} requiredCapacity 
 * @returns {Array}
 */
function findAvailableHalls(halls, date, startTime, endTime, requiredCapacity) {
  if (!Array.isArray(halls)) return [];
  return halls.filter(h => isHallAvailable(h, date, startTime, endTime, requiredCapacity));
}

/**
 * Rank mapping dictionary to translate string ranks into numerical hierarchy.
 * Lower number = higher seniority / qualification rank.
 */
const RANK_HIERARCHY = {
  'Professor': 1,
  'Senior Lecturer Gr (I)': 2,
  'Senior Lecturer Gr (II)': 3,
  'Lecturer': 4,
  'Lecturer (Unconfirmed)': 5,
  'Lecturer (Probationary)': 6,
  'Lab Attendant (Grade III)': 7,
  '-': 99
};

function getNumericalRank(lecturer) {
  if (typeof lecturer.rank === 'number') return lecturer.rank;
  return RANK_HIERARCHY[lecturer.rank] || 50;
}

/**
 * Auto-allocates supervisors and invigilators for exams across available academic staff.
 * 
 * Rules:
 * 1. Paper Setter given supervisor priority if available and not on leave (TL).
 * 2. Supervisors selected from senior ranks within same faculty/department.
 * 3. Invigilators must possess rank strictly lower than the lowest supervisor rank.
 * 
 * @param {Array} exams 
 * @param {Array} staffList 
 * @returns {{ assignments: Array, warnings: Array }}
 */
function autoAllocateStaff(exams, staffList) {
  const lecturers = (staffList || []).map(l => ({
    ...l,
    numericRank: getNumericalRank(l),
    assignments: [...(l.assignments || [])]
  }));

  // Sort by seniority (highest qualified first)
  lecturers.sort((a, b) => a.numericRank - b.numericRank);

  const assignments = [];
  const warnings = [];

  for (const exam of exams || []) {
    const { date, startTime, endTime } = exam;

    for (const subject of (exam.subjects || [])) {
      const totalStudents = (subject.studentCount || 0) + (subject.repeaters || 0);
      const { supervisors: supCount, invigilators: invCount } = calculateRequiredStaff(totalStudents);

      const allocation = {
        examId: exam._id,
        subjectCode: subject.code,
        subject: subject.name,
        date,
        startTime,
        endTime,
        supervisors: [],
        invigilators: []
      };

      // 1. Paper Setter Priority
      const setterIdStr = subject.setterId ? subject.setterId.toString() : null;
      const setter = setterIdStr ? lecturers.find(l => (l._id || '').toString() === setterIdStr) : null;

      if (setter && !setter.isTL && isLecturerAvailable(setter, date, startTime, endTime)) {
        allocation.supervisors.push(setter);
        setter.assignments.push({ date, startTime, endTime });
      }

      // 2. Additional Supervisors from same faculty / senior ranks
      const eligibleSupervisors = lecturers.filter(l =>
        !l.isTL &&
        isLecturerAvailable(l, date, startTime, endTime) &&
        (!subject.faculty || l.faculty === subject.faculty) &&
        !allocation.supervisors.some(s => s._id.toString() === l._id.toString())
      );

      for (const candidate of eligibleSupervisors) {
        if (allocation.supervisors.length >= supCount) break;
        allocation.supervisors.push(candidate);
        candidate.assignments.push({ date, startTime, endTime });
      }

      if (allocation.supervisors.length < supCount) {
        warnings.push(`Insufficient supervisors for ${subject.name} (${subject.code}) on ${date}`);
      }

      // 3. Invigilator Allocation: Rank must be strictly lower than lowest supervisor rank
      const supervisorRanks = allocation.supervisors.map(s => s.numericRank);
      const lowestSupervisorRank = supervisorRanks.length > 0 ? Math.max(...supervisorRanks) : 0;

      const eligibleInvigilators = lecturers.filter(l =>
        isLecturerAvailable(l, date, startTime, endTime) &&
        l.numericRank > lowestSupervisorRank &&
        !allocation.supervisors.some(s => s._id.toString() === l._id.toString())
      );

      for (const candidate of eligibleInvigilators) {
        if (allocation.invigilators.length >= invCount) break;
        allocation.invigilators.push(candidate);
        candidate.assignments.push({ date, startTime, endTime });
      }

      if (allocation.invigilators.length < invCount) {
        warnings.push(`Insufficient invigilators for ${subject.name} (${subject.code}) on ${date}`);
      }

      assignments.push({
        examId: allocation.examId,
        subjectCode: allocation.subjectCode,
        subjectName: allocation.subject,
        date,
        startTime,
        endTime,
        supervisorIds: allocation.supervisors.map(s => s._id),
        invigilatorIds: allocation.invigilators.map(i => i._id),
        supervisorsCount: allocation.supervisors.length,
        invigilatorsCount: allocation.invigilators.length,
        requiredSupervisors: supCount,
        requiredInvigilators: invCount
      });
    }
  }

  return { assignments, warnings };
}

module.exports = {
  calculateRequiredStaff,
  checkTimeOverlap,
  isLecturerAvailable,
  isHallAvailable,
  findAvailableHalls,
  autoAllocateStaff
};
