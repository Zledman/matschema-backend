const User = require("../models/User");
const { sendSuccess, sendMessage } = require("../utils/response");
const RevokedToken = require("../models/RevokedToken");

// GET /api/users/me
const getMe = async (req, res) => {
  const user = req.currentUser;
  return sendSuccess(res, { user: user.toSafeJSON() });
};

// PUT /api/users/preferences
const updatePreferences = async (req, res) => {
  try {
    const user = req.currentUser;
    user.preferences = req.body || {};
    await user.save();
    return sendSuccess(res, { user: user.toSafeJSON() });
  } catch (err) {
    console.error("Update preferences error:", err);
    return sendMessage(res, 500, "Serverfel vid uppdatering av preferenser");
  }
};

// PATCH /api/users/:id/role (admin only)
const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body || {};
    if (!role || !["user", "admin"].includes(role)) {
      return sendMessage(res, 400, "Ogiltig role");
    }
    if (req.currentUser && req.currentUser.id === id) {
      return sendMessage(
        res,
        400,
        "Kan inte ändra egen roll via detta endpoint"
      );
    }
    const user = await User.findById(id);
    if (!user) {
      return sendMessage(res, 404, "Användare hittades inte");
    }
    const previousRole = user.role;
    user.role = role;
    await user.save();

    // If downgrading from admin -> user, revoke all active access & refresh token JTIs
    if (previousRole === "admin" && role === "user") {
      const docs = [];
      if (user.activeTokenJtis?.length) {
        docs.push(
          ...user.activeTokenJtis.map((jti) => ({
            tokenId: jti,
            userId: user._id,
            tokenType: "access",
          }))
        );
      }
      if (user.activeRefreshTokenJtis?.length) {
        docs.push(
          ...user.activeRefreshTokenJtis.map((jti) => ({
            tokenId: jti,
            userId: user._id,
            tokenType: "refresh",
          }))
        );
      }
      if (docs.length) {
        try {
          await RevokedToken.insertMany(
            docs.map((d) => ({ ...d, revokedAt: new Date() })),
            { ordered: false }
          );
        } catch (e) {
          if (e.code !== 11000) {console.warn("Revocation insert issue", e);}
        }
        // Fallback: ensure each doc exists (in case of race conditions / duplicate key skips)
        for (const d of docs) {
          try {
            await RevokedToken.updateOne(
              { tokenId: d.tokenId },
              { $setOnInsert: { ...d, revokedAt: new Date() } },
              { upsert: true }
            );
          } catch (e) {
            if (e.code !== 11000) {console.warn("Revocation upsert issue", e);}
          }
        }
        user.activeTokenJtis = [];
        user.activeRefreshTokenJtis = [];
        await user.save();
      }
    }

    return sendSuccess(res, {
      user: { id: user._id, role: user.role },
      previousRole,
    });
  } catch (err) {
    console.error("Change user role error:", err);
    return sendMessage(res, 500, "Serverfel vid rolländring");
  }
};

module.exports = { getMe, updatePreferences, changeUserRole };
