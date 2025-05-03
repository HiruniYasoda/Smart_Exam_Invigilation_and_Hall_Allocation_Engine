const requestLogger = (req, res, next) => {
    console.log(`${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
  };
  
  module.exports = { requestLogger };
  