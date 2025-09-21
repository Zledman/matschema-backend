const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/matschema";
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    // Use structured logger instead of console
    try {
      const { logger } = require("../utils/logger");
      logger.info("[DB] Connected");
    } catch (_) {
      // Fallback if logger not available yet
      // (Kept silent to satisfy no-console rule; connection success is implicit.)
    }
  } catch (err) {
    console.warn(
      "[DB] Connection failed. Continuing without database. Message:",
      err.message
    );
    // Ingen process.exit – vi låter API fortsätta för utveckling.
  }
};

module.exports = { connectDB };
