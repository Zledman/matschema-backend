const mongoose = require("mongoose");

const revokedTokenSchema = new mongoose.Schema(
  {
    tokenId: { type: String, required: true, unique: true }, // jti
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenType: { type: String, enum: ["access", "refresh"], required: true },
    revokedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// TTL-index: 8 dagar (7 dagar refresh livslängd + 1 dag buffert) => 8 * 24 * 60 * 60 = 691200 sekunder
revokedTokenSchema.index({ revokedAt: 1 }, { expireAfterSeconds: 691200 });

module.exports = mongoose.model("RevokedToken", revokedTokenSchema);
