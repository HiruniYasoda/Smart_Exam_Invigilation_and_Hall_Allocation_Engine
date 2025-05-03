// Replacing ES module imports with require statements
const fs = require('fs');
const path = require('path');

// Resolve __dirname equivalent in CommonJS
const __filename = __filename; // This is available by default in CommonJS
const __dirname = path.dirname(__filename);

// Define the log file path
const logPath = path.join(__dirname, '..', 'logs', 'system.log');

console.log(logPath); // You can print the logPath to confirm



exports.logAction = (message) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;

  fs.appendFile(logPath, logEntry, (err) => {
    if (err) {
      console.error('Failed to write log:', err);
    }
  });
};
