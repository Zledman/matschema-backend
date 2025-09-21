const { connectDB } = require("./config/db");
const config = require("./config/env");
const app = require("./app");

const { cleanupRevokedTokens } = require("./utils/cleanupRevokedTokens");
const { startRevokedTokenCleanupScheduler } = require("./cron/cleanup");
const { logger } = require("./utils/logger");

const start = async () => {
  await connectDB();
  // Kör engångs-cleanup vid start (icke-blockerande)
  cleanupRevokedTokens()
    .then((result) => {
      if (result.removedCount > 0) {
        logger.info(
          { removedCount: result.removedCount },
          "Startup revoked token cleanup removed tokens"
        );
      } else {
        logger.debug("Startup revoked token cleanup found nothing to remove");
      }
    })
    .catch((err) =>
      logger.warn({ err }, "Startup revoked token cleanup error")
    );

  // Starta schemalagd städning
  startRevokedTokenCleanupScheduler();

  const port = config.PORT || 4000;
  app.listen(port, () => logger.info({ port }, "Server listening"));
};

start();

module.exports = app;
