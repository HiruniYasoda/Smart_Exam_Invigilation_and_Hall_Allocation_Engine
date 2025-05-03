// models/AssignmentRequest.js

// import mongoose from 'mongoose';
const mongoose = require('mongoose');

const AssignmentRequestSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  subjectCode: { type: String, required: true },
  date: { type: Date, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  supervisors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lecturer' }],
  invigilators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lecturer' }],
  status: { type: String, enum: ['Assigned', 'Finished'], default: 'Assigned' }
});

module.exports = mongoose.model('AssignmentRequest', AssignmentRequestSchema);
