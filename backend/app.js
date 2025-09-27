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
const mealRoutes = require("./routes/mealRoutes");
const shoppingListRoutes = require("./routes/shoppingListRoutes");
const storeRoutes = require("./routes/storeRoutes");
const premiumRoutes = require("./routes/premiumRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const exportRoutes = require("./routes/exportRoutes");
const statsRoutes = require("./routes/statsRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const changelogRoutes = require("./routes/changelogRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const securityRoutes = require("./routes/securityRoutes");

const app = express();

app.use(cors({ origin: true, credentials: true }));
// För webhook måste /api/payment/webhook använda raw body; placera standard JSON-parser efter montering av paymentRoutes
app.use("/api/payment/webhook", (req, res, next) => next());
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
app.use("/api/meals", mealRoutes);
app.use("/api/shopping-list", shoppingListRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/premium", premiumRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/changelog", changelogRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/security", securityRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});
app.use(errorHandler);

module.exports = app;
