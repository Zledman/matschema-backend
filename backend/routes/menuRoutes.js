const express = require("express");
const { generateMenu, getMenu } = require("../controllers/menuController");

const router = express.Router();
router.post("/generate", generateMenu);
router.get("/:id", getMenu);

module.exports = router;
