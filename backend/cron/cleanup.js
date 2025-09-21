const { cleanupRevokedTokens } = require("../utils/cleanupRevokedTokens");
const { logger } = require("../utils/logger");

// Kör en gång per dygn
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function startRevokedTokenCleanupScheduler() {
  // Initial fördröjning 5 min för att låta applikationen stabiliseras
  setTimeout(() => {
    runCleanup();
    setInterval(runCleanup, ONE_DAY_MS);
  }, 5 * 60 * 1000);
}

async function runCleanup() {
  try {
    const result = await cleanupRevokedTokens({ daysOlder: 8 });
    if (result.removedCount > 0) {
      logger.info(
        { removedCount: result.removedCount },
        "Revoked token scheduled cleanup removed tokens"
      );
    } else {
      logger.debug("Revoked token scheduled cleanup: nothing to remove");
    }
  } catch (err) {
    logger.error({ err }, "Revoked token scheduled cleanup error");
  }
}

module.exports = { startRevokedTokenCleanupScheduler, runCleanup };
