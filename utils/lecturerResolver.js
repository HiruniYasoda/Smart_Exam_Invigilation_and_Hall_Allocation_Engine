const Lecturer = require('../models/Lecturer');
const User = require('../models/User');

/**
 * Resolves the Lecturer profile linked to an authenticated User account
 * by userId first, then by email (linking userId lazily if found).
 * @param {object} user
 * @returns {Promise<object|null>}
 */
async function findLecturerForUser(user) {
  if (!user) return null;
  const userId = user._id || user.id;

  if (userId) {
    const byUserId = await Lecturer.findOne({ userId });
    if (byUserId) return byUserId;
  }

  let email = user.email;
  if (!email && userId) {
    const userDoc = await User.findById(userId).select('email');
    email = userDoc?.email;
  }

  if (email) {
    const byEmail = await Lecturer.findOne({ email: email.trim().toLowerCase() });
    if (byEmail) {
      if (userId && !byEmail.userId) {
        byEmail.userId = userId;
        await byEmail.save();
      }
      return byEmail;
    }
  }

  return null;
}

module.exports = { findLecturerForUser };
