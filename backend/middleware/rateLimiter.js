const rateLimit = require("express-rate-limit");

let exportedLimiter;

if (process.env.NODE_ENV === "test") {
  // No-op middleware in tests
  exportedLimiter = (req, res, next) => next();
} else {
  exportedLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuter
    max: 10, // max 10 requests per IP
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

module.exports = exportedLimiter;
