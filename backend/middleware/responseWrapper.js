// Middleware som standardiserar alla res.json-svar
// Behåller befintligt format om payload redan har 'success'

module.exports = function responseWrapper(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (payload) {
    try {
      if (payload && Object.prototype.hasOwnProperty.call(payload, "success")) {
        return originalJson(payload);
      }
      // Om vi fått ett Error-objekt
      if (payload instanceof Error) {
        return originalJson({
          success: false,
          errors: [{ message: payload.message || "Unknown error" }],
        });
      }

      // Om payload ser ut som ett fel enligt tidigare konvention { message: '...' }
      if (
        payload &&
        typeof payload === "object" &&
        "message" in payload &&
        Object.keys(payload).length === 1
      ) {
        return originalJson({
          success: false,
          errors: [{ message: payload.message }],
        });
      }

      // Om payload innehåller errors-array redan
      if (
        payload &&
        typeof payload === "object" &&
        Array.isArray(payload.errors)
      ) {
        // Normalisera errors
        const errors = payload.errors.map((e) => {
          if (!e) {return { message: "Unknown error" };}
          if (typeof e === "string") {return { message: e };}
          if (e.message)
            {return { message: e.message, ...(e.path ? { path: e.path } : {}) };}
          return { message: JSON.stringify(e) };
        });
        return originalJson({ success: false, errors });
      }

      // Annars behandla som success och lägg under data
      return originalJson({ success: true, data: payload });
    } catch (err) {
      return originalJson({
        success: false,
        errors: [{ message: "Response wrapper failure" }],
      });
    }
  };

  next();
};
