const jwt = require("jsonwebtoken");
const User = require("../models/User");
const RevokedToken = require("../models/RevokedToken");
const {
  createAccessToken,
  createRefreshToken,
  verifyToken,
} = require("../utils/tokenUtils");
const { sendSuccess, sendMessage } = require("../utils/response");

const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || "refresh-dev-secret";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false, // sätt true bakom HTTPS i produktion
  sameSite: "lax",
  path: "/api/auth",
};

const registerUser = async (req, res) => {
  try {
    const { email, password, name, role } = req.body; // role ignoreras om ej admin
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return sendMessage(res, 409, "Användare finns redan");
    }
    let assignedRole = "user";
    // Om det finns en autentiserad användare och denne är admin får den ange role
    if (
      req.currentUser &&
      req.currentUser.role === "admin" &&
      role &&
      ["user", "admin"].includes(role)
    ) {
      assignedRole = role;
    }
    const user = new User({ email, name, role: assignedRole });
    user.password = password; // triggar virtual + hash i pre-save
    await user.save();
    const { token: accessToken, jti: accessJti } = createAccessToken(
      user._id,
      user.role
    );
    const { token: refreshToken, jti: refreshJti } = createRefreshToken(
      user._id,
      user.role
    );
    user.activeTokenJtis.push(accessJti);
    user.activeRefreshTokenJtis.push(refreshJti);
    await user.save();
    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res
      .status(201)
      .json({ success: true, data: { accessToken, user: user.toSafeJSON() } });
  } catch (err) {
    console.error("Register error:", err);
    return sendMessage(res, 500, "Serverfel vid registrering");
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body; // redan validerat av Zod
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return sendMessage(res, 401, "Ogiltiga inloggningsuppgifter");
    }
    const ok = await user.comparePassword(password);
    if (!ok) {
      return sendMessage(res, 401, "Ogiltiga inloggningsuppgifter");
    }
    const { token: accessToken, jti: accessJti } = createAccessToken(
      user._id,
      user.role
    );
    const { token: refreshToken, jti: refreshJti } = createRefreshToken(
      user._id,
      user.role
    );
    user.activeTokenJtis.push(accessJti);
    user.activeRefreshTokenJtis.push(refreshJti);
    if (user.activeTokenJtis.length > 50)
      {user.activeTokenJtis = user.activeTokenJtis.slice(-50);}
    if (user.activeRefreshTokenJtis.length > 50)
      {user.activeRefreshTokenJtis = user.activeRefreshTokenJtis.slice(-50);}
    await user.save();
    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return sendSuccess(res, { accessToken, user: user.toSafeJSON() });
  } catch (err) {
    console.error("Login error:", err);
    return sendMessage(res, 500, "Serverfel vid inloggning");
  }
};

const refreshToken = async (req, res) => {
  const token = req.cookies && req.cookies.refreshToken;
  if (!token) {return sendMessage(res, 401, "Ingen refresh token");}
  const verification = await verifyToken(token, "refresh");
  if (!verification.valid) {
    const reason =
      verification.reason === "revoked"
        ? "Token revoked"
        : "Refresh token ogiltig eller utgången";
    return sendMessage(res, 401, reason);
  }
  const { payload } = verification;
  const user = await User.findById(payload.id);
  if (!user) {return sendMessage(res, 401, "Ogiltig token");}
  // Kontrollera att refresh-jti fortfarande är aktiv (inte manuellt borttagen)
  if (!user.activeRefreshTokenJtis.includes(payload.jti)) {
    return sendMessage(res, 401, "Token revoked");
  }
  const { token: newAccess, jti: newJti } = createAccessToken(
    user._id,
    user.role
  );
  user.activeTokenJtis.push(newJti);
  if (user.activeTokenJtis.length > 50)
    {user.activeTokenJtis = user.activeTokenJtis.slice(-50);}
  await user.save();
  return sendSuccess(res, { accessToken: newAccess });
};

const logout = async (req, res) => {
  const token = req.cookies && req.cookies.refreshToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        // Ta bort från aktiva listan
        user.activeRefreshTokenJtis = user.activeRefreshTokenJtis.filter(
          (j) => j !== decoded.jti
        );
        await user.save();
        // Lägg till i revoked
        try {
          await RevokedToken.create({
            tokenId: decoded.jti,
            userId: user._id,
            tokenType: "refresh",
          });
        } catch (e) {
          if (e.code !== 11000) {console.warn("Revoked insert fail", e);}
        }
      }
    } catch (_) {
      // Ignorera ogiltig token vid logout
    }
  }
  res.clearCookie("refreshToken", { path: "/api/auth" });
  return sendSuccess(res, { message: "Utloggad" });
};

module.exports = { registerUser, loginUser, refreshToken, logout };
