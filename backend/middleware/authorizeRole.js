const { sendMessage } = require("../utils/response");

function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.currentUser || req.user; // req.currentUser innehåller full Mongoose-doc
    if (!user || !user.role || !allowedRoles.includes(user.role)) {
      return sendMessage(res, 403, "Forbidden: insufficient role");
    }
    next();
  };
}

module.exports = authorizeRole;
