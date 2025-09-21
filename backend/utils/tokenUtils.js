const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const RevokedToken = require("../models/RevokedToken");

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ||
  process.env.JWT_SECRET ||
  "access-dev-secret";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "refresh-dev-secret";

const createAccessToken = (userId, role) => {
  const jti = randomUUID();
  const token = jwt.sign({ id: userId, role, jti }, ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });
  return { token, jti };
};

const createRefreshToken = (userId, role) => {
  const jti = randomUUID();
  const token = jwt.sign({ id: userId, role, jti }, REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
  return { token, jti };
};

async function verifyToken(token, type = "access") {
  try {
    const secret =
      type === "refresh" ? REFRESH_TOKEN_SECRET : ACCESS_TOKEN_SECRET;
    const decoded = jwt.verify(token, secret);
    if (decoded.jti) {
      const revoked = await RevokedToken.findOne({
        tokenId: decoded.jti,
        tokenType: type,
      });
      if (revoked) {
        return { valid: false, reason: "revoked" };
      }
    }
    return { valid: true, payload: decoded };
  } catch (err) {
    if (err.name === "TokenExpiredError")
      {return { valid: false, reason: "expired" };}
    return { valid: false, reason: "invalid" };
  }
}

module.exports = { createAccessToken, createRefreshToken, verifyToken };
