const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { errorHandler } = require("./utils/errorHandler");
const responseWrapper = require("./middleware/responseWrapper");

// Routers
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const menuRoutes = require("./routes/menuRoutes");
const recipeRoutes = require("./routes/recipeRoutes");
const shoppingListRoutes = require("./routes/shoppingListRoutes");
const storeRoutes = require("./routes/storeRoutes");

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(responseWrapper);

app.get("/", (req, res) => {
  res.json({ message: "API root" });
});
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/shopping-list", shoppingListRoutes);
app.use("/api/stores", storeRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});
app.use(errorHandler);

module.exports = app;
