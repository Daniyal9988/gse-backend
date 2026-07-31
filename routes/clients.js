const express = require('express');
const router = express.Router();
const db = require('../db');

// Get All Clients
router.get('/', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM clients ORDER BY client_name ASC');
        res.json({ success: true, data: results });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Add a New Client
router.post('/', async (req, res) => {
    try {
        const { client_name, contact_person, phone_number } = req.body;
        if (!client_name) {
            return res.status(400).json({ success: false, error: 'Client name is required' });
        }

        const query = `
            INSERT INTO clients (client_name, contact_person, phone_number) 
            VALUES (?, ?, ?)
        `;
        const [result] = await db.query(query, [
            client_name, 
            contact_person || '', 
            phone_number || ''
        ]);

        res.json({ success: true, message: 'Client added successfully', clientId: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Edit / Update an Existing Client
router.put('/:id', async (req, res) => {
    try {
        const clientId = req.params.id;
        const { client_name, contact_person, phone_number } = req.body;

        if (!client_name) {
            return res.status(400).json({ success: false, error: 'Client name is required' });
        }

        const query = `
            UPDATE clients 
            SET client_name = ?, contact_person = ?, phone_number = ? 
            WHERE id = ?
        `;
        await db.query(query, [
            client_name, 
            contact_person || '', 
            phone_number || '', 
            clientId
        ]);

        res.json({ success: true, message: 'Client updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete a Client
router.delete('/:id', async (req, res) => {
    try {
        const clientId = req.params.id;
        await db.query('DELETE FROM product_client_prices WHERE client_id = ?', [clientId]);
        await db.query('DELETE FROM clients WHERE id = ?', [clientId]);

        res.json({ success: true, message: 'Client deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;