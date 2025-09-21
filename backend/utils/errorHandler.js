const { logger } = require("./logger");

const errorHandler = (err, req, res, _next) => {
  const status = err.status || 500;
  logger.error(
    {
      message: err.message,
      stack: err.stack,
      status,
      path: req.originalUrl,
      method: req.method,
    },
    "Unhandled error"
  );
  res.status(status).json({
    status,
    message: err.message || "Server Error",
  });
};

module.exports = { errorHandler };
