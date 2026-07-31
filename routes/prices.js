const express = require('express');
const router = express.Router();
const db = require('../db');

// Get All Products & Stock (with optional client price lookup)
router.get('/stock', async (req, res) => {
    try {
        const clientName = req.query.client;
        const query = `
            SELECT 
                p.id, 
                p.item_code AS Code, 
                p.description AS Description, 
                COALESCE(NULLIF(cp.price, 0), p.standard_price) AS Standard,
                p.standard_price AS base_standard_price
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

// Upsert (Add or Update) Client-Specific Price
router.post('/client-prices', async (req, res) => {
    try {
        const { client_id, product_id, price } = req.body;
        if (!client_id || !product_id || price === undefined) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Check if a pricing record already exists
        const [existing] = await db.query(
            'SELECT id FROM product_client_prices WHERE client_id = ? AND product_id = ?',
            [client_id, product_id]
        );

        if (existing.length > 0) {
            // Update existing price override
            await db.query(
                'UPDATE product_client_prices SET price = ? WHERE client_id = ? AND product_id = ?',
                [price, client_id, product_id]
            );
        } else {
            // Insert new price override
            await db.query(
                'INSERT INTO product_client_prices (client_id, product_id, price) VALUES (?, ?, ?)',
                [client_id, product_id, price]
            );
        }

        res.json({ success: true, message: 'Price updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete Client-Specific Price Override (Revert to Standard)
router.delete('/client-prices', async (req, res) => {
    try {
        const { client_id, product_id } = req.body;
        await db.query(
            'DELETE FROM product_client_prices WHERE client_id = ? AND product_id = ?',
            [client_id, product_id]
        );
        res.json({ success: true, message: 'Reverted to standard price' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;