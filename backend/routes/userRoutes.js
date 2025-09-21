const express = require("express");
const {
  getMe,
  updatePreferences,
  changeUserRole,
} = require("../controllers/userController");
const auth = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/authorizeRole");

const router = express.Router();
router.get("/me", auth, getMe);
router.put("/preferences", auth, updatePreferences);
router.get("/admin/dashboard", auth, authorizeRole("admin"), (req, res) => {
  res.json({
    message: "Admin dashboard",
    user: { id: req.currentUser.id, role: req.currentUser.role },
  });
});
router.patch("/:id/role", auth, authorizeRole("admin"), changeUserRole);

module.exports = router;
