const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const routes = require('./routes/index');
const { errorHandler } = require('./middlewares/errorHandler');

dotenv.config();

const validateEnv = require('./config/env');
const config = validateEnv();

const app = express();

// CORS configuration for Vite frontend and configured client origins
const allowedOrigins = new Set(
  [config.FRONTEND_URL, ...(config.CORS_ORIGINS ? config.CORS_ORIGINS.split(',') : [])]
    .map(origin => origin.trim())
    .filter(Boolean)
);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Body parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection lifecycle
if (config.NODE_ENV !== 'test') {
  mongoose.connect(config.MONGO_URI)
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
