const mongoose = require('mongoose');

const LecturerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  department: { type: String, required: true, trim: true },
  contact: { type: String, trim: true, default: '' },
  isTL: { type: Boolean, default: false },
  rank: {
    type: String,
    enum: [
      'Professor',
      'Senior Lecturer Gr (I)',
      'Senior Lecturer Gr (II)',
      'Lecturer',
      'Lecturer (Unconfirmed)',
      'Lecturer (Probationary)',
      'Lab Attendant (Grade III)',
      '-'
    ],
    default: '-',
    required: true
  },
  availability: [
    {
      date: String,
      startTime: String,
      endTime: String
    }
  ],
  unavailable: [
    {
      date: String,
      startTime: String,
      endTime: String
    }
  ],
  dutyCount: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('Lecturer', LecturerSchema);
