const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const routes = require('./routes/index');
const { errorHandler } = require('./middlewares/errorHandler');

dotenv.config();

const app = express();

// Body parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection lifecycle
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/exam_allocation';

if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(mongoUri)
    .then(() => {
      console.log('MongoDB connected successfully');
    })
    .catch(err => {
      console.error('MongoDB connection error:', err.message);
    });
}

// API Routes
app.use('/api', routes);

// 404 handler for undefined API routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Resource not found' });
});

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
