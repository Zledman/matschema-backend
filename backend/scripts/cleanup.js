#!/usr/bin/env node
// Load dotenv without emitting banner (manual implementation) before other logic.
(() => {
  try {
    const fs = require("fs");
    const path = require("path");
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      content.split(/\r?\n/).forEach((line) => {
        if (!line || line.trim().startsWith("#")) {
          return;
        }
        const idx = line.indexOf("=");
        if (idx === -1) {
          return;
        }
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      });
    }
  } catch (e) {
    // ignore dotenv load errors
  }
})();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { cleanupRevokedTokens } = require("../utils/cleanupRevokedTokens");
const { logger } = require("../utils/logger");
const pino = require("pino");

async function runCleanupScript() {
  // Argument parsing för --days, --dry-run och --json
  let daysOlder = 8;
  let dryRun = false;
  let jsonMode = false;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--json") {
      jsonMode = true;
    } else if (arg.startsWith("--days=")) {
      const v = parseInt(arg.split("=")[1], 10);
      if (!isNaN(v) && v > 0) {
        daysOlder = v;
      }
    } else if (arg === "--days") {
      const next = argv[i + 1];
      const v = parseInt(next, 10);
      if (!isNaN(v) && v > 0) {
        daysOlder = v;
      }
      i++;
    }
  }
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/matschema";
  try {
    const skipDb = process.env.CLEANUP_SKIP_DB === "1";
    if (!skipDb) {
      await mongoose.connect(uri);
    }
    const result = await cleanupRevokedTokens({ daysOlder, dryRun });
    const timestamp = new Date().toISOString();
    const payload = {
      ts: timestamp,
      mode: dryRun ? "dry-run" : "live",
      daysOlder,
      removedCount: result.removedCount,
      tokens:
        dryRun && result.removedTokens
          ? result.removedTokens.map((t) => ({
              id: t.tokenId,
              type: t.tokenType,
              revokedAt:
                t.revokedAt instanceof Date
                  ? t.revokedAt.toISOString()
                  : t.revokedAt,
            }))
          : undefined,
    };

    // Prepare dedicated pino file logger for cleanup.log (with rotation beforehand)
    const logsDir = process.env.CLEANUP_LOG_DIR
      ? path.resolve(process.env.CLEANUP_LOG_DIR)
      : path.join(__dirname, "..", "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFile = path.join(logsDir, "cleanup.log");
    const maxBytes = 5 * 1024 * 1024; // 5MB
    try {
      const stats = fs.statSync(logFile);
      if (stats.size > maxBytes) {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const rotatedName = path.join(logsDir, `cleanup-${ts}.log`);
        try {
          fs.renameSync(logFile, rotatedName);
        } catch (e) {
          logger.warn({ err: e.message }, "Cleanup log rotation rename failed");
        }
      }
    } catch (_) {
      // ignore missing file or stat issues
    }
    const cleanupFileLogger = pino(
      {
        level: process.env.CLEANUP_LOG_LEVEL || process.env.LOG_LEVEL || "info",
      },
      pino.destination({ dest: logFile, append: true, mkdir: true })
    );

    if (jsonMode) {
      process.stdout.write(JSON.stringify(payload) + "\n");
      // Still write structured line to cleanup.log via its logger
      cleanupFileLogger.info(payload);
    } else {
      logger.info(
        { daysOlder, mode: payload.mode },
        "Cleanup start (connected)"
      );
      if (dryRun) {
        logger.info(
          { removedCount: result.removedCount, daysOlder },
          "Dry-run result"
        );
        if (result.removedTokens && result.removedTokens.length) {
          result.removedTokens.forEach((t) => {
            logger.debug(
              {
                tokenId: t.tokenId,
                tokenType: t.tokenType,
                revokedAt: t.revokedAt,
              },
              "Dry-run token"
            );
          });
        }
      } else {
        logger.info(
          { removedCount: result.removedCount, daysOlder },
          "Cleanup removed tokens"
        );
      }
      // Mirror summary to file logger as single structured entry
      cleanupFileLogger.info(payload);
    }
  } catch (err) {
    logger.error({ err }, "Cleanup execution error");
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    if (process.exitCode === null || process.exitCode === undefined) {
      process.exitCode = 0; // explicit success
    }
  }
}

if (process.env.CLEANUP_EMBED !== "1") {
  // Självstående CLI-körning
  runCleanupScript().catch(() => {
    if (process.exitCode === null || process.exitCode === undefined) {
      process.exitCode = 1;
    }
  });
} else {
  // Export för test / embedded användning
  module.exports = { runCleanupScript };
}
