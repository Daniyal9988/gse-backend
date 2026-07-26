const express = require('express');
const router = express.Router();
const db = require('../db');

// User Login Endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
        const [results] = await db.query(query, [username, password]);
        
        if (results.length > 0) {
            res.json({ success: true, user: { username: results[0].username, role: results[0].role } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/verify-user', async (req, res) => {
    try {
        const { username } = req.body;
        const query = 'SELECT username FROM users WHERE username = ?';
        const [results] = await db.query(query, [username]);
        
        if (results.length > 0) {
            res.json({ valid: true });
        } else {
            res.json({ valid: false });
        }
    } catch (err) {
        res.status(500).json({ valid: false, error: err.message });
    }
});

module.exports = router;