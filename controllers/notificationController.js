const Notification = require('../models/Notification');

/**
 * Send a new notification to a specific user or broadcast to a role.
 */
exports.sendNotification = async (req, res) => {
  try {
    const { title, message, recipientUserId, recipientRole = 'lecturer', type = 'announcement' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Notification message is required' });
    }

    const notification = await Notification.create({
      title: title ? title.trim() : 'Exam Portal Notice',
      message: message.trim(),
      recipientUserId: recipientUserId || null,
      recipientRole: recipientUserId ? 'all' : recipientRole,
      type,
      createdBy: req.user._id || req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      notification
    });
  } catch (error) {
    console.error('sendNotification error:', error);
    res.status(500).json({ success: false, message: 'Failed to send notification' });
  }
};

/**
 * Admin: Retrieve all sent notifications.
 */
exports.getAllNotificationsAdmin = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .populate('recipientUserId', 'username email role')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error('getAllNotificationsAdmin error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve notifications' });
  }
};

/**
 * Authenticated user: Retrieve personal and role-broadcast notifications.
 */
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const role = (req.user.role || 'lecturer').toLowerCase();

    const notifications = await Notification.find({
      $or: [
        { recipientUserId: userId },
        { recipientUserId: null, recipientRole: { $in: ['all', role] } }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error('getMyNotifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve notifications' });
  }
};

/**
 * Authenticated user: Mark a notification as read.
 */
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error('markAsRead error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
};
