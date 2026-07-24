const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Database Connection Pool
const db = mysql.createPool({
    host: 'asdsad', // Or your Bluehost server IP if connecting remotely from your local machine
    user: 'asdsadsady', 
    password: 'afasf',       
    database: 'masdsase',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

app.get('/api/test', (req, res) => {
    db.query('SELECT 1', (err, results) => {
        if (err) {
            console.error('Database connection error:', err);
            // This will show the exact reason in your browser
            return res.status(500).json({ success: false, error: err.message, code: err.code, sqlMessage: err.sqlMessage });
        }
        res.json({ success: true, message: 'Database connected successfully!' });
    });
});


// 1. Get All Products (Catalog for Quotations)
app.get('/api/products', (req, res) => {
    const query = 'SELECT * FROM products';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: results });
    });
});

// 2. User Login Endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    
    db.query(query, [username, password], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        if (results.length > 0) {
            res.json({ success: true, user: { username: results[0].username, role: results[0].role } });
        } else {
            res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
    });
});

// 3. Save a New Quotation
app.post('/api/quotations', (req, res) => {
    const {
        QuotationNo,
        ClientName,
        ContactPerson,
        ContactNo,
        Date,
        ValidUntil,
        Subtotal,
        VAT,
        Total,
        ItemsJSON,
        CreatedBy
    } = req.body;

    const query = `
        INSERT INTO quotations 
        (QuotationNo, ClientName, ContactPerson, ContactNo, Date, ValidUntil, Subtotal, VAT, Total, ItemsJSON, CreatedBy) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        QuotationNo,
        ClientName,
        ContactPerson,
        ContactNo,
        Date,
        ValidUntil,
        Subtotal,
        VAT,
        Total,
        JSON.stringify(ItemsJSON),
        CreatedBy
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error saving quotation:', err);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, message: 'Quotation saved successfully!', id: result.insertId });
    });
});

// 4. Get All Saved Quotations
app.get('/api/quotations', (req, res) => {
    const query = 'SELECT * FROM quotations ORDER BY created_at DESC';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, data: results });
    });
});

// Start Server Locally
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Local backend server running on http://localhost:${PORT}`);
});


module.exports = db;