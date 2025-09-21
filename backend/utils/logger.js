const pino = require("pino");
const path = require("path");
const fs = require("fs");

const level = process.env.LOG_LEVEL || "info";
const isDev = process.env.NODE_ENV !== "production";

// Optional file logging (rotated previously by custom logic in cleanup script)
const logDir = process.env.APP_LOG_DIR || path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
    /* ignore */
  }
}
const fileStreamPath = path.join(logDir, "app.log");
const fileStream = fs.createWriteStream(fileStreamPath, {
  flags: "a",
  encoding: "utf8",
});

// Pretty transport for dev only
let transport;
if (isDev) {
  try {
    transport = pino.transport({
      targets: [
        {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
          level,
        },
        {
          target: "pino/file",
          options: { destination: fileStreamPath, mkdir: true, append: true },
          level,
        },
      ],
    });
  } catch (e) {
    // fallback simple
  }
}

const logger = transport
  ? pino({ level }, transport)
  : pino({ level }, fileStream);

module.exports = { logger };
