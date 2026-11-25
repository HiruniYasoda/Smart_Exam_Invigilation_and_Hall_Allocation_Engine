const mongoose = require('mongoose');
const Notification = require('../models/Notification');

exports.createExamAssignmentMessage = (lecturerName, subjectCode, date, startTime) => {
  return `Dear ${lecturerName}, you have been assigned to invigilate the exam for ${subjectCode} on ${date} at ${startTime}. Please check your schedule for full details.`;
};

exports.overrideNotification = (adminName, target, details) => {
  return `${adminName} performed an override on ${target}. Details: ${details}`;
};

exports.createNotification = async (userId, message, type = 'warning', title = 'System Notification') => {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }
  return Notification.create({
    recipientUserId: userId || null,
    recipientRole: userId ? 'all' : 'admin',
    title,
    message,
    type
  });
};
