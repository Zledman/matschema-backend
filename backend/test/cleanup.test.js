const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const RevokedToken = require("../models/RevokedToken");
const { cleanupRevokedTokens } = require("../utils/cleanupRevokedTokens");

let mongo;

describe("cleanupRevokedTokens", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: "testdb" });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  afterEach(async () => {
    await RevokedToken.deleteMany({});
  });

  test("removes only tokens older than cutoff", async () => {
    const now = Date.now();
    const oldDate = new Date(now - 9 * 24 * 60 * 60 * 1000); // 9 dagar
    const recentDate = new Date(now - 2 * 24 * 60 * 60 * 1000); // 2 dagar

    await RevokedToken.create({
      tokenId: "old",
      userId: new mongoose.Types.ObjectId(),
      tokenType: "access",
      revokedAt: oldDate,
    });
    await RevokedToken.create({
      tokenId: "new",
      userId: new mongoose.Types.ObjectId(),
      tokenType: "refresh",
      revokedAt: recentDate,
    });

    const result = await cleanupRevokedTokens({ daysOlder: 8 });
    expect(result.removedCount).toBe(1);

    const remaining = await RevokedToken.find().lean();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].tokenId).toBe("new");
  });

  test("dry-run returns tokens without deleting", async () => {
    const now = Date.now();
    const oldDate = new Date(now - 10 * 24 * 60 * 60 * 1000);
    const midDate = new Date(now - 9 * 24 * 60 * 60 * 1000);
    await RevokedToken.create({
      tokenId: "oldA",
      userId: new mongoose.Types.ObjectId(),
      tokenType: "access",
      revokedAt: oldDate,
    });
    await RevokedToken.create({
      tokenId: "oldB",
      userId: new mongoose.Types.ObjectId(),
      tokenType: "refresh",
      revokedAt: midDate,
    });
    const result = await cleanupRevokedTokens({ daysOlder: 8, dryRun: true });
    expect(result.removedCount).toBe(2);
    expect(result.removedTokens.map((t) => t.tokenId).sort()).toEqual([
      "oldA",
      "oldB",
    ]);
    // Verify still in DB
    const all = await RevokedToken.find().lean();
    expect(all).toHaveLength(2);
  });
});
