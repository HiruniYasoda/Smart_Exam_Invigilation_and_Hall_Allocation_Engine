const { describe, it } = require('node:test');
const assert = require('node:assert');
const { hasTimeOverlap, isTimeOverlap, getTodayDate } = require('../utils/timeUtils');

describe('Time Utilities - Unit Tests', () => {

  describe('hasTimeOverlap()', () => {
    it('detects overlapping time strings', () => {
      assert.strictEqual(hasTimeOverlap('08:00', '10:00', '09:00', '11:00'), true);
    });

    it('returns false for disjoint contiguous periods', () => {
      assert.strictEqual(hasTimeOverlap('08:00', '10:00', '10:00', '12:00'), false);
    });

    it('returns false when inputs are missing', () => {
      assert.strictEqual(hasTimeOverlap(null, '10:00', '10:00', '12:00'), false);
    });
  });

  describe('isTimeOverlap()', () => {
    it('returns false when slot dates differ', () => {
      const slot1 = { date: '2026-12-01', startTime: '09:00', endTime: '11:00' };
      const slot2 = { date: '2026-12-02', startTime: '09:00', endTime: '11:00' };

      assert.strictEqual(isTimeOverlap(slot1, slot2), false);
    });

    it('returns true when dates match and times overlap', () => {
      const slot1 = { date: '2026-12-01', startTime: '09:00', endTime: '11:00' };
      const slot2 = { date: '2026-12-01', startTime: '10:00', endTime: '12:00' };

      assert.strictEqual(isTimeOverlap(slot1, slot2), true);
    });
  });

  describe('getTodayDate()', () => {
    it('returns date string formatted as YYYY-MM-DD', () => {
      const dateStr = getTodayDate();
      assert.match(dateStr, /^\d{4}-\d{2}-\d{2}$/);
    });
  });

});
