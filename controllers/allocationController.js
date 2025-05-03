// allocationController.js

const Exam = require('../models/Exam');
const Lecturer = require('../models/Lecturer');
const Hall = require('../models/Hall');
const OverrideLog = require('../models/OverrideLog');
const fs = require('fs');
const path = require('path');

/**
 * @desc Log override actions like manual changes to halls, lecturers, etc.
 * @route POST /overrides/log
 * @access Protected
 */
exports.logOverrides = async (req, res) => {
  try {
    const { action, target, targetId, details } = req.body;

    // Basic validation
    if (!action || !target || !targetId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create override log entry
    const log = await OverrideLog.create({
      user: req.user.id,     // from authenticated request
      action,
      target,
      targetId,
      details
    });

    return res.status(201).json({ message: 'Override logged', log });

  } catch (error) {
    console.error('Error logging override:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @desc Future function placeholder for allocating invigilators or halls
 * Example: auto-assign based on availability
 */
exports.autoAllocateResources = async (req, res) => {
  try {
    // Logic to scan available halls/lecturers and assign to exams
    // This is a stub — implement your allocation algorithm here

    res.status(200).json({ message: 'Auto allocation not implemented yet.' });
  } catch (error) {
    console.error('Error in auto allocation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
