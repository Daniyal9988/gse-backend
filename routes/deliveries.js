const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyAdmin } = require('../middleware/verifyAdmin');

// Ensure uploads folder exists on cPanel server storage path
const uploadDir = path.join(__dirname, '../uploads/deliveries');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

// Configure upload fields for exactly 1 note and 1 picture
const uploadFields = upload.fields([
  { name: 'deliveryNote', maxCount: 1 },
  { name: 'deliveryPicture', maxCount: 1 }
]);

// Database connection import
const db = require('../db'); 

// 1. GET ALL DELIVERIES
router.get('/deliveries', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM deliveries ORDER BY delivery_date DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    res.status(500).json({ success: false, message: 'Server error fetching deliveries' });
  }
});

// 2. CREATE DELIVERY
router.post('/deliveries', uploadFields, async (req, res) => {
  try {
    let { deliveryDate, quotationNumber, companyName, status } = req.body;
    
    // Clean ISO date string to YYYY-MM-DD
    if (deliveryDate) {
      deliveryDate = deliveryDate.split('T')[0];
    }
    
    const deliveryNote = req.files && req.files['deliveryNote'] 
      ? `/uploads/deliveries/${req.files['deliveryNote'][0].filename}` 
      : null;

    const deliveryPicture = req.files && req.files['deliveryPicture'] 
      ? `/uploads/deliveries/${req.files['deliveryPicture'][0].filename}` 
      : null;

    const query = `
      INSERT INTO deliveries (delivery_date, quotation_number, company_name, status, delivery_note, delivery_picture)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      deliveryDate, 
      quotationNumber, 
      companyName, 
      status || 'Pending', 
      deliveryNote, 
      deliveryPicture
    ]);

    res.status(201).json({ 
      success: true, 
      message: 'Delivery created successfully', 
      deliveryId: result.insertId 
    });
  } catch (error) {
    console.error('Error creating delivery:', error);
    res.status(500).json({ success: false, message: 'Server error creating delivery' });
  }
});

// 3. UPDATE DELIVERY
router.put('/deliveries/:id', uploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    let { deliveryDate, quotationNumber, companyName, status } = req.body;

    // Clean ISO date string to YYYY-MM-DD
    if (deliveryDate) {
      deliveryDate = deliveryDate.split('T')[0];
    }

    const [existing] = await db.query('SELECT * FROM deliveries WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Delivery record not found' });
    }

    let deliveryNote = existing[0].delivery_note;
    if (req.files && req.files['deliveryNote']) {
      if (deliveryNote) {
        const oldPath = path.join(__dirname, '..', deliveryNote);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      deliveryNote = `/uploads/deliveries/${req.files['deliveryNote'][0].filename}`;
    }

    let deliveryPicture = existing[0].delivery_picture;
    if (req.files && req.files['deliveryPicture']) {
      if (deliveryPicture) {
        const oldPath = path.join(__dirname, '..', deliveryPicture);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      deliveryPicture = `/uploads/deliveries/${req.files['deliveryPicture'][0].filename}`;
    }

    const query = `
      UPDATE deliveries 
      SET delivery_date = ?, quotation_number = ?, company_name = ?, status = ?, delivery_note = ?, delivery_picture = ?
      WHERE id = ?
    `;

    await db.query(query, [
      deliveryDate, 
      quotationNumber, 
      companyName, 
      status, 
      deliveryNote, 
      deliveryPicture, 
      id
    ]);

    res.json({ success: true, message: 'Delivery updated successfully' });
  } catch (error) {
    console.error('Error updating delivery:', error);
    res.status(500).json({ success: false, message: 'Server error updating delivery' });
  }
});

// 4. DELETE DELIVERY
router.delete('/deliveries/:id', verifyAdmin,async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.query('SELECT * FROM deliveries WHERE id = ?', [id]);
    
    if (existing.length > 0) {
      const record = existing[0];
      if (record.delivery_note) {
        const notePath = path.join(__dirname, '..', record.delivery_note);
        if (fs.existsSync(notePath)) fs.unlinkSync(notePath);
      }
      if (record.delivery_picture) {
        const picPath = path.join(__dirname, '..', record.delivery_picture);
        if (fs.existsSync(picPath)) fs.unlinkSync(picPath);
      }
    }

    await db.query('DELETE FROM deliveries WHERE id = ?', [id]);
    res.json({ success: true, message: 'Delivery deleted successfully' });
  } catch (error) {
    console.error('Error deleting delivery:', error);
    res.status(500).json({ success: false, message: 'Server error deleting delivery' });
  }
});

module.exports = router;