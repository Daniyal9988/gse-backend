const express = require('express');
const router = express.Router();
const db = require('../db'); // Adjust path to point to your main promise-based db pool connection file
const { verifyAdmin } = require('../middleware/verifyAdmin');

// 1. GET Unsold Inventory (Filtered by Item Code & Last 4 Digits Lookup)
router.get('/inventory/unsold', async (req, res) => {
  try {
    const { itemCode, lastFour } = req.query;
    
    let query = "SELECT id, item_code, serial_number FROM inventory_stock WHERE status = 'Unsold'";
    let params = [];

    if (itemCode) {
      query += " AND item_code = ?";
      params.push(itemCode);
    }

    if (lastFour) {
      query += " AND RIGHT(serial_number, 4) LIKE ?";
      params.push(`%${lastFour}%`);
    }

    query += " ORDER BY id ASC LIMIT 50";

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching unsold inventory:', err);
    res.status(500).json({ error: "Failed to fetch unsold inventory stock." });
  }
});

// 2. GET All Sold Records (For History Table)
router.get('/sales', async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, serial_number, item_code, company_name, sale_date, sold_by FROM sales_records ORDER BY id DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error('Error retrieving sales records:', err);
    res.status(500).json({ error: "Failed to retrieve sales records." });
  }
});

// 3. POST Register Sale & Update Serial Status (Transaction-safe)
// Batch Register Sales
router.post('/sales/batch', async (req, res) => {
    const { inventoryIds, companyName, saleDate, soldBy } = req.body;

    if (!inventoryIds || !Array.isArray(inventoryIds) || inventoryIds.length === 0) {
        return res.status(400).json({ error: "No inventory IDs provided for batch sale." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        for (const inventoryId of inventoryIds) {
            // 1. Verify item is still unsold
            const [stock] = await connection.query(
                'SELECT * FROM inventory_stock WHERE id = ? AND status = "Unsold"', 
                [inventoryId]
            );

            if (stock.length === 0) {
                throw new Error(`Inventory item ID ${inventoryId} is already sold or doesn't exist.`);
            }

            const item = stock[0];

            // 2. Mark stock as Sold
            await connection.query(
                'UPDATE inventory_stock SET status = "Sold" WHERE id = ?', 
                [inventoryId]
            );

            // 3. Insert into sales record ledger
            await connection.query(
                `INSERT INTO sales_records (inventory_id, item_code, serial_number, company_name, sale_date, sold_by) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [item.id, item.item_code, item.serial_number, companyName, saleDate, soldBy]
            );
        }

        await connection.commit();
        connection.release();

        res.json({ success: true, count: inventoryIds.length });
    } catch (err) {
        await connection.rollback();
        connection.release();
        console.error("Batch sale transaction failed:", err);
        res.status(500).json({ error: err.message });
    }
});

// 4. PUT Update Sold Record (Admin Only)
router.put('/sales/:id', verifyAdmin, async (req, res) => {
    const saleId = req.params.id;
    const { companyName, saleDate } = req.body;

    try {
        const [result] = await db.execute(
            'UPDATE sales_records SET company_name = ?, sale_date = ? WHERE id = ?',
            [companyName, saleDate, saleId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Sold record not found." });
        }

        res.json({ success: true, message: "Sold record updated successfully." });
    } catch (err) {
        console.error("Error updating sold record:", err);
        res.status(500).json({ error: "Failed to update sold record." });
    }
});
module.exports = router;