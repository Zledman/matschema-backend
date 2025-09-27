const jwt = require("jsonwebtoken");
const User = require("../models/User");
const RevokedToken = require("../models/RevokedToken");
const {
  createAccessToken,
  createRefreshToken,
  verifyToken,
} = require("../utils/tokenUtils");
const { sendSuccess, sendMessage } = require("../utils/response");
const crypto = require("crypto");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const Session = require("../models/Session");
const { sendPasswordChangedEmail, sendNewLoginEmail } = require("../utils/mailer");

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
    let assignedRole = "user"; // default alltid 'user' vid egen registrering
    // Om en autentiserad admin skapar användaren kan den sätta roll (inkl. premium)
    if (
      req.currentUser &&
      req.currentUser.role === "admin" &&
      role &&
      ["user", "premium", "admin"].includes(role)
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
    // Om 2FA är aktiverat -> returnera marker om att andra steget krävs.
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      // Skapa en temporär kortlivad token (JWT) endast för 2FA-verifiering (5 min)
      const tempPayload = {
        id: user._id,
        stage: "2fa",
      };
      const tempToken = jwt.sign(
        tempPayload,
        process.env.ACCESS_TOKEN_SECRET ||
          process.env.JWT_SECRET ||
          "access-dev-secret",
        {
          expiresIn: "5m",
        }
      );
      return res.status(200).json({
        success: true,
        data: {
          status: "2FA_REQUIRED",
          twoFactorToken: tempToken,
          user: {
            _id: user._id,
            email: user.email,
            role: user.role,
            name: user.name,
          },
        },
      });
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
    if (user.activeTokenJtis.length > 50) {
      user.activeTokenJtis = user.activeTokenJtis.slice(-50);
    }
    if (user.activeRefreshTokenJtis.length > 50) {
      user.activeRefreshTokenJtis = user.activeRefreshTokenJtis.slice(-50);
    }
    await user.save();
    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // Skapa session post-login & ev. skicka e-post om ny enhet/IP
  const ua = req.headers["user-agent"] || "unknown";
  // Prefer X-Forwarded-For (first entry) if present (common behind proxy) else fall back to req.ip
  const fwd = req.headers["x-forwarded-for"]; // could be comma-separated list
  const ip = (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.ip || req.connection?.remoteAddress || "unknown";
    let isNewDevice = false;
    try {
      const existingSimilar = await Session.findOne({ userId: user._id, ip, userAgent: ua });
      if (!existingSimilar) {
        isNewDevice = true;
      }
      await Session.create({
        userId: user._id,
        refreshTokenHash: Session.hashToken(refreshToken),
        userAgent: ua,
        ip,
        lastUsedAt: new Date(),
      });
    } catch (e) {
      console.warn("Failed creating session entry", e.message);
    }
    // Persist login security log (non-blocking)
    try {
      const LoginLog = require('../models/LoginLog');
      LoginLog.create({ userId: user._id, ip, userAgent: ua }).catch(()=>{});
    } catch (e) {
      // ignore logging failure
    }
    if (isNewDevice) {
      // Skicka notifiering asynkront (ej vänta på svar)
      sendNewLoginEmail(user, { ip, userAgent: ua, time: new Date() }).catch((e) => {
        console.warn("Misslyckades skicka ny-inloggningsmail", e.message);
      });
    }
    return sendSuccess(res, { accessToken, user: user.toSafeJSON() });
  } catch (err) {
    console.error("Login error:", err);
    return sendMessage(res, 500, "Serverfel vid inloggning");
  }
};

const refreshToken = async (req, res) => {
  const token = req.cookies && req.cookies.refreshToken;
  if (!token) {
    return sendMessage(res, 401, "Ingen refresh token");
  }
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
  if (!user) {
    return sendMessage(res, 401, "Ogiltig token");
  }
  // Kontrollera att refresh-jti fortfarande är aktiv (inte manuellt borttagen)
  if (!user.activeRefreshTokenJtis.includes(payload.jti)) {
    return sendMessage(res, 401, "Token revoked");
  }
  const { token: newAccess, jti: newJti } = createAccessToken(
    user._id,
    user.role
  );
  user.activeTokenJtis.push(newJti);
  if (user.activeTokenJtis.length > 50) {
    user.activeTokenJtis = user.activeTokenJtis.slice(-50);
  }
  await user.save();
  // Returnera även user (inklusive role) för att klienten ska kunna återställa session (Context) efter sidomladdning
  return sendSuccess(res, { accessToken: newAccess, user: user.toSafeJSON() });
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
          if (e.code !== 11000) {
            console.warn("Revoked insert fail", e);
          }
        }
        // Ta bort associerad session post logout
        try {
          await Session.deleteOne({
            userId: user._id,
            refreshTokenHash: Session.hashToken(token),
          });
        } catch (e) {
          console.warn("Session cleanup fail", e.message);
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
// POST /api/auth/forgot-password { email }
async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) {return sendMessage(res, 400, "Email krävs");}
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.resetToken = token;
      user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h
      await user.save();
      // Mock e-post – logga i dev
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "Password reset link:",
          `${
            process.env.FRONTEND_BASE_URL || "http://localhost:5173"
          }/reset-password/${token}`
        );
      }
    }
    // Oavsett om user finns returneras success (för att inte avslöja konton)
    return res.status(200).json({
      success: true,
      message:
        "Om e-postadressen finns registrerad har vi skickat en återställningslänk",
    });
  } catch (err) {
    console.error("forgotPassword error", err);
    return sendMessage(res, 500, "Serverfel vid begäran om återställning");
  }
}

// POST /api/auth/reset-password/:token { password }
async function resetPassword(req, res) {
  try {
    const { token } = req.params;
    const { password } = req.body || {};
    if (!token) {return sendMessage(res, 400, "Token krävs");}
    if (!password || password.length < 6)
      {return sendMessage(res, 400, "Lösenord måste ha minst 6 tecken");}
    const user = await User.findOne({ resetToken: token });
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return sendMessage(res, 400, "Token ogiltig eller utgången");
    }
    user.password = password; // trigger hash
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    // Invalidera tidigare tokens (säkerhet)
    user.activeTokenJtis = [];
    user.activeRefreshTokenJtis = [];
    await user.save();
    // Ta bort ALLA sparade sessioner (global logout på alla enheter)
    try {
      await Session.deleteMany({ userId: user._id });
    } catch (e) {
      console.warn("Kunde inte radera sessioner vid resetPassword", e.message);
    }
    // Skicka e-postbekräftelse (ej blockerande för svaret om det faller)
    sendPasswordChangedEmail(user).catch((e) => {
      console.warn("Misslyckades skicka password-changed email", e.message);
    });
    return res.status(200).json({
      success: true,
      message:
        "Lösenordet har uppdaterats, alla enheter har loggats ut och ett bekräftelsemail har skickats",
    });
  } catch (err) {
    console.error("resetPassword error", err);
    return sendMessage(res, 500, "Serverfel vid återställning av lösenord");
  }
}

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  setup2FA,
  verify2FASetup,
  login2FA,
  disable2FA,
};

// === 2FA (TOTP) Funktioner ===
// POST /api/auth/2fa/setup (auth behövs) -> genererar temporär secret + QR
async function setup2FA(req, res) {
  try {
    const user = req.currentUser;
    if (!user) {return sendMessage(res, 401, "Unauthorized");}
    if (user.twoFactorEnabled) {
      return sendMessage(res, 400, "2FA redan aktiverad");
    }
    // Generera secret
    const secret = speakeasy.generateSecret({
      name: `Matschema (${user.email})`,
      length: 20,
    });
    user.twoFactorTempSecret = secret.base32;
    await user.save();
    // Skapa QR code data URL
    const otpauth = secret.otpauth_url;
    const qrDataUrl = await qrcode.toDataURL(otpauth);
    return sendSuccess(res, {
      otpauthUrl: otpauth,
      qr: qrDataUrl,
      secret: process.env.NODE_ENV === "production" ? undefined : secret.base32, // visa secret bara i dev för enkel testning
    });
  } catch (err) {
    console.error("setup2FA error", err);
    return sendMessage(res, 500, "Serverfel vid 2FA-setup");
  }
}

// POST /api/auth/2fa/verify { token } -> verifierar kod mot tempSecret och aktiverar 2FA
async function verify2FASetup(req, res) {
  try {
    const user = req.currentUser;
    if (!user) {return sendMessage(res, 401, "Unauthorized");}
    if (!user.twoFactorTempSecret) {
      return sendMessage(res, 400, "Ingen 2FA-setup pågår");
    }
    const { token } = req.body || {};
    if (!token) {return sendMessage(res, 400, "Kod krävs");}
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorTempSecret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (!verified) {
      return sendMessage(res, 400, "Ogiltig kod");
    }
    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorTempSecret = undefined;
    user.twoFactorEnabled = true;
    await user.save();
    return sendSuccess(res, { message: "2FA aktiverad" });
  } catch (err) {
    console.error("verify2FASetup error", err);
    return sendMessage(res, 500, "Serverfel vid 2FA-verifiering");
  }
}

// POST /api/auth/2fa/login { twoFactorToken, code }
// Används efter password-login returnerat status 2FA_REQUIRED
async function login2FA(req, res) {
  try {
    const { twoFactorToken, code } = req.body || {};
    if (!twoFactorToken || !code)
      {return sendMessage(res, 400, "Token och kod krävs");}
    let decoded;
    try {
      decoded = jwt.verify(
        twoFactorToken,
        process.env.ACCESS_TOKEN_SECRET ||
          process.env.JWT_SECRET ||
          "access-dev-secret"
      );
    } catch (e) {
      return sendMessage(res, 400, "Ogiltig eller utgången 2FA-token");
    }
    if (decoded.stage !== "2fa" || !decoded.id) {
      return sendMessage(res, 400, "Ogiltig 2FA-token");
    }
    const user = await User.findById(decoded.id);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return sendMessage(res, 400, "2FA ej aktiverad");
    }
    const ok = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 1,
    });
    if (!ok) {return sendMessage(res, 401, "Felaktig kod");}
    // Full login nu
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
    if (user.activeTokenJtis.length > 50) {
      user.activeTokenJtis = user.activeTokenJtis.slice(-50);
    }
    if (user.activeRefreshTokenJtis.length > 50) {
      user.activeRefreshTokenJtis = user.activeRefreshTokenJtis.slice(-50);
    }
    await user.save();
    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return sendSuccess(res, { accessToken, user: user.toSafeJSON() });
  } catch (err) {
    console.error("login2FA error", err);
    return sendMessage(res, 500, "Serverfel vid 2FA-inloggning");
  }
}

// POST /api/auth/2fa/disable { password?, code? }
async function disable2FA(req, res) {
  try {
    const user = req.currentUser;
    if (!user) {return sendMessage(res, 401, "Unauthorized");}
    if (!user.twoFactorEnabled) {
      return sendMessage(res, 400, "2FA ej aktiverad");
    }
    const { code } = req.body || {};
    if (code) {
      const ok = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: code,
        window: 1,
      });
      if (!ok) {return sendMessage(res, 401, "Felaktig kod");}
    }
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorTempSecret = undefined;
    await user.save();
    return sendSuccess(res, { message: "2FA inaktiverad" });
  } catch (err) {
    console.error("disable2FA error", err);
    return sendMessage(res, 500, "Serverfel vid inaktivering av 2FA");
  }
}
