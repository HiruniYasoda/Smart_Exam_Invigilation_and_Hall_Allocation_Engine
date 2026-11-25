const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  recipientRole: {
    type: String,
    enum: ['all', 'admin', 'lecturer', 'student'],
    default: 'all'
  },
  title: { type: String, trim: true, default: 'Exam Portal Notice' },
  message: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['duty', 'announcement', 'warning'],
    default: 'announcement'
  },
  isRead: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', NotificationSchema);
