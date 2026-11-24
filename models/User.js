const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: [true, 'Username is required'], 
    unique: true,
    trim: true,
    minlength: 3
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'] 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  role: {
    type: String,
    enum: ['admin', 'lecturer', 'student', 'Admin', 'Lecturer', 'Student'],
    default: 'lecturer',
    required: true
  },
  department: { 
    type: String,
    trim: true
  },
  resetPasswordToken: { 
    type: String 
  },
  resetPasswordExpires: { 
    type: Date 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
