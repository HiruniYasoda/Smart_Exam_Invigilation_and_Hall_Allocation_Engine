/**
 * Time utility functions for exam scheduling and collision detection.
 */

/**
 * Checks if two time intervals on the same day overlap.
 * Format expected: 'HH:MM' (24-hour time strings)
 * @param {string} start1 
 * @param {string} end1 
 * @param {string} start2 
 * @param {string} end2 
 * @returns {boolean}
 */
exports.hasTimeOverlap = (start1, end1, start2, end2) => {
  if (!start1 || !end1 || !start2 || !end2) return false;
  return !(end1 <= start2 || start1 >= end2);
};

/**
 * Legacy slot object comparator.
 * @param {{ date: string, startTime: string, endTime: string }} slot1 
 * @param {{ date: string, startTime: string, endTime: string }} slot2 
 * @returns {boolean}
 */
exports.isTimeOverlap = (slot1, slot2) => {
  if (!slot1 || !slot2) return false;
  if (slot1.date && slot2.date && slot1.date !== slot2.date) return false;

  return exports.hasTimeOverlap(slot1.startTime, slot1.endTime, slot2.startTime, slot2.endTime);
};

/**
 * Formats a Date object to HH:MM string.
 * @param {Date} date 
 * @returns {string}
 */
exports.formatTime = (date) => {
  return date.toISOString().split('T')[1].slice(0, 5);
};

/**
 * Returns today's date formatted as YYYY-MM-DD.
 * @returns {string}
 */
exports.getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};
