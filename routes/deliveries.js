const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

// Configure storage to use public_html/uploads/deliveries/ directory with auto-creation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public_html/uploads/deliveries/');
    
    // Automatically create the folder if it does not exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// POST: Add new delivery record with file uploads
router.post('/deliveries', upload.fields([
  { name: 'deliveryPhoto', maxCount: 1 },
  { name: 'deliveryNote', maxCount: 1 }
]), async (req, res) => {
  try {
    const { deliveryDate, quotationNumber, companyName } = req.body;
    
    // Extract file paths relative to public_html or server storage
    const deliveryPhotoPath = req.files && req.files['deliveryPhoto'] ? req.files['deliveryPhoto'][0].path : null;
    const deliveryNotePath = req.files && req.files['deliveryNote'] ? req.files['deliveryNote'][0].path : null;

    const query = `
      INSERT INTO deliveries (delivery_date, quotation_number, company_name, delivery_photo_path, delivery_note_path) 
      VALUES (?, ?, ?, ?, ?)
    `;

    await db.query(query, [deliveryDate, quotationNumber, companyName, deliveryPhotoPath, deliveryNotePath]);

    res.status(201).json({
      success: true,
      message: 'Delivery recorded successfully!',
      data: { deliveryDate, quotationNumber, companyName }
    });
  } catch (error) {
    console.error('Error saving delivery:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Retrieve all delivery records
router.get('/deliveries', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM deliveries ORDER BY delivery_date DESC');
    res.json({ success: true, data: results });
  } catch (err) {
    console.error('Error fetching deliveries:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;