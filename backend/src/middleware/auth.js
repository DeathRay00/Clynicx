const jwt = require('jsonwebtoken');
const pool = require('../db');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    } catch (jwtErr) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    // Fetch user from DB to ensure they still exist
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server error during auth' });
  }
};

module.exports = { requireAuth };
