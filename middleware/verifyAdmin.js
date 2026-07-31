// middleware/authMiddleware.js
const db = require('../db'); // Adjust path to your database connection file

const verifyAdmin = async (req, res, next) => {
  try {
    const username = req.headers['x-username'];
    if (!username) {
      return res.status(401).json({ success: false, message: 'Unauthorized. No user session provided.' });
    }

    // Check database for the real role
    const [users] = await db.query('SELECT role FROM users WHERE username = ?', [username]);
    
    if (users.length === 0) {
      return res.status(403).json({ success: false, message: 'User not found.' });
    }

    const userRole = (users[0].role || '').toLowerCase();
    if (userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
    }

    req.user = { username, role: userRole };
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(500).json({ success: false, message: 'Server error during authorization check.' });
  }
};

module.exports = { verifyAdmin };