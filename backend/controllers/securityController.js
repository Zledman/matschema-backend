const LoginLog = require('../models/LoginLog');
const { sendSuccess } = require('../utils/response');

// GET /api/security/logins - return latest 20 login entries for current user
async function getRecentLogins(req, res) {
  try {
    const userId = req.currentUser?._id || req.user?.id;
    if (!userId) {return res.status(401).json({ success:false, message:'Unauthorized' });}
    const items = await LoginLog.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
    return sendSuccess(res, items.map(l => ({
      id: l._id,
      ip: l.ip,
      userAgent: l.userAgent,
      createdAt: l.createdAt
    })));
  } catch (e) {
    return res.status(500).json({ success:false, message:'Kunde inte hämta säkerhetslogg' });
  }
}

module.exports = { getRecentLogins };
