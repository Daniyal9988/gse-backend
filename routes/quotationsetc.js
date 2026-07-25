const express = require('express');
const router = express.Router();
const db = require('../db'); // Imports the promise-based db pool

// Test DB Connection
router.get('/test', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ success: true, message: 'Database connected successfully!' });
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).json({ success: false, error: err.message, code: err.code, sqlMessage: err.sqlMessage });
    }
});

// 1. Get All Products (Catalog for Quotations)
router.get('/products', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM products');
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. User Login Endpoint
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

// 3. Save a New Quotation
router.post('/quotations', async (req, res) => {
    try {
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

        const [result] = await db.query(query, values);
        res.json({ success: true, message: 'Quotation saved successfully!', id: result.insertId });
    } catch (err) {
        console.error('Error saving quotation:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Get All Saved Quotations
router.get('/quotations', async (req, res) => {
    try {
        const query = 'SELECT * FROM quotations ORDER BY created_at DESC';
        const [results] = await db.query(query);
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});



// Get All Clients for Quotation Dropdown
router.get('/clients', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM clients');
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// Get Products with Client-Specific Pricing
router.get('/client-products/:clientId', async (req, res) => {
    try {
        const clientId = req.params.clientId;
        const query = `
            SELECT p.id, p.item_code, p.description, 
                   COALESCE(cp.price, p.standard_price) AS price
            FROM products p
            LEFT JOIN product_client_prices cp ON p.id = cp.product_id AND cp.client_id = ?
        `;
        const [results] = await db.query(query, [clientId]);
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


// 5. Get Stock/Products Catalog (Matches frontend /api/stock call)
router.get('/stock', async (req, res) => {
    try {
        const clientName = req.query.client;

        const query = `
            SELECT 
                p.id, 
                p.item_code AS Code, 
                p.description AS Description, 
                COALESCE(NULLIF(cp.price, 0), p.standard_price) AS Standard 
            FROM products p
            LEFT JOIN clients c ON c.client_name = ?
            LEFT JOIN product_client_prices cp ON cp.product_id = p.id AND cp.client_id = c.id
        `;

        const [results] = await db.query(query, [clientName || '']);
        res.json(results);
    } catch (err) {
        console.error('Database Error in /stock:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. Get Next Sequential Quotation Number (Matches frontend /api/quotations/next-number call)
router.get('/quotations/next-number', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT QuotationNo FROM quotations ORDER BY id DESC LIMIT 1');
        let nextNum = "QT-001"; // Fallback default
        
        if (rows.length > 0 && rows[0].QuotationNo) {
            const lastNumStr = rows[0].QuotationNo;
            // Assumes format like GSE-Q-105 or similar numeric suffix
            const numericPart = parseInt(lastNumStr.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(numericPart)) {
                const nextNumericPart = numericPart + 1;
                nextNum = `QT-${String(nextNumericPart).padStart(3, '0')}`;
            }
        }
        res.json({ nextQuotationNo: nextNum });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;