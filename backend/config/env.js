require("dotenv").config();

const required = ["MONGO_URI"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn("Missing env vars:", missing.join(", "));
}

const config = {
  PORT: process.env.PORT || 4000,
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/matschema",
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret",
};

module.exports = config;
