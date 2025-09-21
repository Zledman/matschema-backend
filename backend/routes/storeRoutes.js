const express = require("express");
const { getStores, sendToStore } = require("../controllers/storeController");

const router = express.Router();
router.get("/", getStores);
router.post("/send", sendToStore);

module.exports = router;
