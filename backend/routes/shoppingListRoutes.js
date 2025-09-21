const express = require("express");
const {
  getShoppingList,
  sendShoppingList,
} = require("../controllers/shoppingListController");

const router = express.Router();
router.get("/", getShoppingList);
router.post("/send", sendShoppingList);

module.exports = router;
