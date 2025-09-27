const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getRecentLogins } = require('../controllers/securityController');

router.get('/logins', auth, getRecentLogins);

module.exports = router;
