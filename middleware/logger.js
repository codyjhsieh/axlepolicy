// middleware/logger.js

const logger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next(); // Move to the next middleware or route handler
  };
  
  module.exports = logger;
  