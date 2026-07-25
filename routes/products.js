const express = require('express');
const router = express.Router();
const db = require('../db');

// Get All Products (Catalog for Quotations)
router.get('/products', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM products');
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

// Get Stock/Products Catalog (Matches frontend /api/stock call)
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

module.exports = router;