const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// Get Paginated Quotations (with optional search filter)
router.get('/quotations', verifyToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20;
        const page = parseInt(req.query.page, 10) || 1;
        const offset = (page - 1) * limit;
        const search = req.query.search ? `%${req.query.search.trim()}%` : '%';
        
        // Check if the request explicitly wants all records (e.g., for Delivery Notes)
        const fetchAll = req.query.all === 'true';

        const currentUser = req.user.username || req.user.name || '';
        const currentRole = (req.user.role || 'staff').trim().toLowerCase();
        const isAdmin = currentRole === 'admin' || fetchAll; // If fetchAll is true, treat like admin view

        let baseWhere = `WHERE (QuotationNo LIKE ? OR ClientName LIKE ?)`;
        let countParams = [search, search];
        let dataParams = [search, search];

        // Restrict non-admin users only if fetchAll is not requested
        if (!isAdmin) {
            baseWhere += ` AND (LOWER(CreatedBy) = LOWER(?) OR LOWER(CreatedBy) = LOWER(?))`;
            countParams.push(currentUser, currentRole);
            dataParams.push(currentUser, currentRole);
        }

        const countQuery = `SELECT COUNT(*) as total FROM quotations ${baseWhere}`;
        const [countResult] = await db.query(countQuery, countParams);
        const totalRecords = countResult[0].total;

        const query = `
            SELECT * FROM quotations 
            ${baseWhere}
            ORDER BY id DESC LIMIT ? OFFSET ?
        `;
        dataParams.push(limit, offset);
        const [results] = await db.query(query, dataParams);

        res.json({
            success: true,
            data: results,
            total: totalRecords,
            currentPage: page,
            totalPages: Math.ceil(totalRecords / limit) || 1
        });
    } catch (err) {
        console.error('Error fetching paginated quotations:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get Next Sequential Quotation Number
router.get('/quotations/next-number', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT QuotationNo FROM quotations ORDER BY id DESC LIMIT 1');
        let nextNum = "QT-001";
       
        if (rows.length > 0 && rows[0].QuotationNo) {
            const lastNumStr = rows[0].QuotationNo;
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
            ContactPerson || '',
            ContactNo || '',
            Date,
            ValidUntil,
            Subtotal,
            VAT,
            Total,
            JSON.stringify(ItemsJSON),
            CreatedBy || 'staff'
        ];

        const [result] = await db.query(query, values);

        res.status(201).json({ 
            success: true, 
            message: 'Quotation saved successfully!',
            id: result.insertId 
        });
    } catch (err) {
        console.error('Error saving quotation:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update an Existing Quotation
router.put('/quotations/:id', async (req, res) => {
    try {
        const { id } = req.params;
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
            UPDATE quotations
            SET QuotationNo = ?, ClientName = ?, ContactPerson = ?, ContactNo = ?,
                Date = ?, ValidUntil = ?, Subtotal = ?, VAT = ?, Total = ?, ItemsJSON = ?, CreatedBy = ?
            WHERE id = ?
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
            CreatedBy,
            id
        ];

        const [result] = await db.query(query, values);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Quotation not found' });
        }

        res.json({ success: true, message: 'Quotation updated successfully!' });
    } catch (err) {
        console.error('Error updating quotation:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;