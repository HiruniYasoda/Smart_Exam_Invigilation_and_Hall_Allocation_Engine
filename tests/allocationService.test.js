const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  calculateRequiredStaff,
  checkTimeOverlap,
  isLecturerAvailable,
  isHallAvailable,
  findAvailableHalls,
  autoAllocateStaff
} = require('../services/allocationService');

describe('Allocation Service - Unit Tests', () => {

  describe('calculateRequiredStaff()', () => {
    it('returns 0 staff when student count is 0', () => {
      const result = calculateRequiredStaff(0);
      assert.strictEqual(result.supervisors, 0);
      assert.strictEqual(result.invigilators, 0);
    });

    it('allocates 1 supervisor and 1 invigilator for up to 25 students', () => {
      const result25 = calculateRequiredStaff(25);
      assert.strictEqual(result25.supervisors, 1);
      assert.strictEqual(result25.invigilators, 1);

      const result10 = calculateRequiredStaff(10);
      assert.strictEqual(result10.supervisors, 1);
      assert.strictEqual(result10.invigilators, 1);
    });

    it('allocates additional invigilator for every 15 students over 25', () => {
      // 26 students -> 1 + ceil(1/15) = 2 invigilators
      const result26 = calculateRequiredStaff(26);
      assert.strictEqual(result26.supervisors, 1);
      assert.strictEqual(result26.invigilators, 2);

      // 40 students -> 1 + ceil(15/15) = 2 invigilators
      const result40 = calculateRequiredStaff(40);
      assert.strictEqual(result40.supervisors, 1);
      assert.strictEqual(result40.invigilators, 2);

      // 41 students -> 1 + ceil(16/15) = 3 invigilators
      const result41 = calculateRequiredStaff(41);
      assert.strictEqual(result41.supervisors, 1);
      assert.strictEqual(result41.invigilators, 3);
    });

    it('calculates supervisor count based on 180-student threshold', () => {
      // 180 students -> 1 supervisor
      const result180 = calculateRequiredStaff(180);
      assert.strictEqual(result180.supervisors, 1);
      assert.strictEqual(result180.invigilators, 12); // 1 + ceil(155/15) = 12

      // 181 students -> 2 supervisors
      const result181 = calculateRequiredStaff(181);
      assert.strictEqual(result181.supervisors, 2);

      // 360 students -> 2 supervisors
      const result360 = calculateRequiredStaff(360);
      assert.strictEqual(result360.supervisors, 2);
    });
  });

  describe('checkTimeOverlap()', () => {
    it('detects partial overlapping time intervals', () => {
      assert.strictEqual(checkTimeOverlap('09:00', '11:00', '10:00', '12:00'), true);
      assert.strictEqual(checkTimeOverlap('10:00', '12:00', '09:00', '11:00'), true);
    });

    it('detects completely nested time intervals', () => {
      assert.strictEqual(checkTimeOverlap('09:00', '13:00', '10:00', '11:00'), true);
      assert.strictEqual(checkTimeOverlap('10:00', '11:00', '09:00', '13:00'), true);
    });

    it('recognizes non-overlapping boundary times as disjoint', () => {
      assert.strictEqual(checkTimeOverlap('09:00', '11:00', '11:00', '13:00'), false);
      assert.strictEqual(checkTimeOverlap('13:00', '15:00', '09:00', '11:00'), false);
    });
  });

  describe('isLecturerAvailable()', () => {
    const mockLecturer = {
      _id: 'lecturer_1',
      name: 'Dr. Perera',
      assignments: [
        { date: '2026-12-01', startTime: '09:00', endTime: '11:00' }
      ],
      unavailable: [
        { date: '2026-12-02', startTime: '13:00', endTime: '15:00' }
      ]
    };

    it('returns true when lecturer has no conflicting duties on that date', () => {
      const available = isLecturerAvailable(mockLecturer, '2026-12-03', '09:00', '11:00');
      assert.strictEqual(available, true);
    });

    it('returns true when time does not overlap on the same date', () => {
      const available = isLecturerAvailable(mockLecturer, '2026-12-01', '12:00', '14:00');
      assert.strictEqual(available, true);
    });

    it('returns false when an assignment overlaps', () => {
      const available = isLecturerAvailable(mockLecturer, '2026-12-01', '10:00', '12:00');
      assert.strictEqual(available, false);
    });

    it('returns false when lecturer marked themselves unavailable', () => {
      const available = isLecturerAvailable(mockLecturer, '2026-12-02', '13:30', '14:30');
      assert.strictEqual(available, false);
    });
  });

  describe('isHallAvailable() & findAvailableHalls()', () => {
    const mockHalls = [
      {
        _id: 'hall_A',
        name: 'Auditorium 1',
        capacity: 100,
        bookings: [
          { date: '2026-12-01', startTime: '09:00', endTime: '11:00' }
        ]
      },
      {
        _id: 'hall_B',
        name: 'Lecture Hall 2',
        capacity: 50,
        bookings: []
      },
      {
        _id: 'hall_C',
        name: 'Main Exam Hall',
        capacity: 200,
        bookings: []
      }
    ];

    it('rejects halls with insufficient capacity', () => {
      const available = isHallAvailable(mockHalls[1], '2026-12-01', '09:00', '11:00', 80);
      assert.strictEqual(available, false);
    });

    it('rejects halls with time booking conflicts', () => {
      const available = isHallAvailable(mockHalls[0], '2026-12-01', '10:00', '12:00', 50);
      assert.strictEqual(available, false);
    });

    it('finds halls meeting both capacity and scheduling criteria', () => {
      const suitable = findAvailableHalls(mockHalls, '2026-12-01', '09:00', '11:00', 60);
      assert.strictEqual(suitable.length, 1);
      assert.strictEqual(suitable[0].name, 'Main Exam Hall');
    });
  });

  describe('autoAllocateStaff()', () => {
    const mockStaff = [
      { _id: 'p1', name: 'Prof. Silva', rank: 'Professor', isTL: false, faculty: 'Computing', assignments: [] },
      { _id: 's1', name: 'Dr. Fernando', rank: 'Senior Lecturer Gr (I)', isTL: false, faculty: 'Computing', assignments: [] },
      { _id: 'l1', name: 'Mr. Kumara', rank: 'Lecturer (Probationary)', isTL: false, faculty: 'Computing', assignments: [] },
      { _id: 'l2', name: 'Ms. Jayasinghe', rank: 'Lecturer (Probationary)', isTL: false, faculty: 'Computing', assignments: [] }
    ];

    const mockExams = [
      {
        _id: 'exam_1',
        date: '2026-12-05',
        startTime: '09:00',
        endTime: '11:00',
        subjects: [
          {
            code: 'CS101',
            name: 'Data Structures',
            faculty: 'Computing',
            studentCount: 30,
            setterId: 'p1'
          }
        ]
      }
    ];

    it('prioritizes paper setter as supervisor and selects lower rank as invigilator', () => {
      const { assignments, warnings } = autoAllocateStaff(mockExams, mockStaff);

      assert.strictEqual(assignments.length, 1);
      const alloc = assignments[0];

      // Paper setter Prof. Silva allocated as supervisor
      assert.strictEqual(alloc.supervisorIds.includes('p1'), true);

      // Invigilators must be assigned
      assert.strictEqual(alloc.invigilatorIds.length, 2); // 30 students -> 2 invigilators
      assert.strictEqual(alloc.invigilatorIds.includes('l1') || alloc.invigilatorIds.includes('l2'), true);

      assert.strictEqual(warnings.length, 0);
    });

    it('issues warning when staff count is insufficient', () => {
      const limitedStaff = [
        { _id: 'l1', name: 'Mr. Kumara', rank: 'Lecturer', isTL: false, assignments: [] }
      ];

      const bigExam = [
        {
          _id: 'exam_2',
          date: '2026-12-06',
          startTime: '09:00',
          endTime: '11:00',
          subjects: [
            { code: 'CS500', name: 'Advanced AI', studentCount: 150 }
          ]
        }
      ];

      const { warnings } = autoAllocateStaff(bigExam, limitedStaff);
      assert.strictEqual(warnings.length > 0, true);
    });
  });

});
