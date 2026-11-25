const mongoose = require('mongoose');

const AssignmentRequestSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  subjectCode: { type: String, required: true },
  subjectName: { type: String },
  department: { type: String },
  studentCount: { type: Number, default: 0 },
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  hallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hall' },
  hall: { type: String },
  supervisors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lecturer' }],
  invigilators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lecturer' }],
  status: {
    type: String,
    enum: ['pending', 'Assigned', 'Accepted', 'Rejected', 'Finished'],
    default: 'Assigned'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AssignmentRequest', AssignmentRequestSchema);
