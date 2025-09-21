const { sendError } = require("../utils/response");

module.exports = function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return sendError(res, 400, errors);
    }
    req.body = result.data;
    return next();
  };
};
