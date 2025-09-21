const jwt = require("jsonwebtoken");
const User = require("../models/User");
const RevokedToken = require("../models/RevokedToken");
const { sendMessage } = require("../utils/response");

// Använd samma hemlighet som vid skapande av access token
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  "access-dev-secret";

module.exports = async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return sendMessage(res, 401, "Invalid token");
  }
  const token = auth.substring(7);
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    if (decoded.jti) {
      const revoked = await RevokedToken.findOne({
        tokenId: decoded.jti,
        tokenType: "access",
      });
      if (revoked) {
        return sendMessage(res, 401, "Token revoked");
      }
    }
    req.user = { id: decoded.id, role: decoded.role, jti: decoded.jti };
    // Hämta full user endast om vi behöver den senare i kedjan (exempel: authorizeRole använder req.currentUser.role om finns)
    const user = await User.findById(decoded.id);
    if (!user) {
      return sendMessage(res, 401, "Invalid token");
    }
    req.currentUser = user; // full Mongoose doc för controllers som behöver mer data
    return next();
  } catch (err) {
    if (err && err.name === "TokenExpiredError") {
      return sendMessage(res, 401, "Access token expired");
    }
    return sendMessage(res, 401, "Invalid token");
  }
};
