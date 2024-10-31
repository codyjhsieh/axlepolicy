// middleware/errorHandler.js

const errorHandler = (err, req, res, next) => {
    console.error("Error:", err.message); // Log the error message for debugging
  
    // If the error has a specific status code, use it; otherwise, default to 500
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: {
        message: err.message || "An unexpected error occurred.",
        statusCode: statusCode,
      },
    });
  };
  
  module.exports = errorHandler;
  