const RevokedToken = require("../models/RevokedToken");

/**
 * Rensar (eller simulerar rensning av) RevokedToken-poster äldre än cutoff.
 * @param {Object} opts
 * @param {number} opts.daysOlder Gräns i dagar (default 8)
 * @param {boolean} opts.dryRun Om true: returnerar matchande poster utan att ta bort dem
 * @returns {Promise<{ removedCount:number, removedTokens?:Array }>} Resultat
 */
async function cleanupRevokedTokens({ daysOlder = 8, dryRun = false } = {}) {
  // Test hook: allow mocking return via environment variable without DB access
  if (process.env.MOCK_CLEANUP_RET) {
    try {
      const mock = JSON.parse(process.env.MOCK_CLEANUP_RET);
      // Ensure shape
      if (typeof mock.removedCount === "number") {
        return mock;
      }
    } catch (e) {
      // fallthrough to normal logic if parse fails
    }
  }
  const cutoff = new Date(Date.now() - daysOlder * 24 * 60 * 60 * 1000);
  if (dryRun) {
    const tokens = await RevokedToken.find({ revokedAt: { $lt: cutoff } })
      .select("tokenId tokenType revokedAt userId")
      .lean();
    return { removedCount: tokens.length, removedTokens: tokens };
  }
  const result = await RevokedToken.deleteMany({ revokedAt: { $lt: cutoff } });
  return { removedCount: result.deletedCount || 0 };
}

module.exports = { cleanupRevokedTokens };
