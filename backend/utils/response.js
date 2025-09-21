// Standardiserade svarshjälpare
// sendSuccess(res, data) => { success: true, data }
// sendError(res, statusCode, errorsArray) => { success: false, errors: [...] }
// sendMessage(res, statusCode, messageString) => { success: false, errors: [ { message } ] }

function sendSuccess(res, data) {
  return res.status(200).json({ success: true, data });
}

function sendError(res, statusCode, errors) {
  // errors förväntas vara en array av objekt { message, ... } eller strängar
  let normalized = [];
  if (Array.isArray(errors)) {
    normalized = errors.map((e) => {
      if (!e) {return { message: "Unknown error" };}
      if (typeof e === "string") {return { message: e };}
      if (e.message)
        {return { message: e.message, ...("path" in e ? { path: e.path } : {}) };}
      return { message: JSON.stringify(e) };
    });
  } else if (typeof errors === "string") {
    normalized = [{ message: errors }];
  } else if (errors && errors.message) {
    normalized = [{ message: errors.message }];
  } else {
    normalized = [{ message: "Unknown error" }];
  }
  return res.status(statusCode).json({ success: false, errors: normalized });
}

function sendMessage(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, errors: [{ message }] });
}

module.exports = { sendSuccess, sendError, sendMessage };
