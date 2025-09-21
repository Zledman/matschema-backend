const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  refreshToken,
  logout,
} = require("../controllers/authController");
const { registerSchema, loginSchema } = require("../validation/authValidation");
const validate = require("../middleware/validateRequest");
const authLimiter = require("../middleware/rateLimiter");

router.post("/register", authLimiter, validate(registerSchema), registerUser);
router.post("/login", authLimiter, validate(loginSchema), loginUser);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

module.exports = router;
