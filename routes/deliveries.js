const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const db = require('../db');

// Use memory storage so files are stored temporarily in RAM buffer
const upload = multer({ storage: multer.memoryStorage() });

// CPANEL CONFIG
const CPANEL_UPLOAD_URL = 'https://mxk.dpn.mybluehost.me/api/upload_receiver.php';
const CPANEL_SECRET_TOKEN = 'GSE-DATABASE-2021';

router.post('/deliveries', upload.fields([
  { name: 'deliveryPhoto', maxCount: 1 },
  { name: 'deliveryNote', maxCount: 1 }
]), async (req, res) => {
  try {
    const { deliveryDate, quotationNumber, companyName } = req.body;
    
    let deliveryPhotoPath = null;
    let deliveryNotePath = null;

    // If files were uploaded, forward them to cPanel via HTTP FormData
    if (req.files && Object.keys(req.files).length > 0) {
      const cPanelForm = new FormData();

      if (req.files['deliveryPhoto']) {
        const file = req.files['deliveryPhoto'][0];
        cPanelForm.append('deliveryPhoto', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype
        });
      }

      if (req.files['deliveryNote']) {
        const file = req.files['deliveryNote'][0];
        cPanelForm.append('deliveryNote', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype
        });
      }

      // Send files to cPanel PHP script
      const cPanelResponse = await axios.post(CPANEL_UPLOAD_URL, cPanelForm, {
        headers: {
          ...cPanelForm.getHeaders(),
          'Authorization': `Bearer ${CPANEL_SECRET_TOKEN}`
        }
      });

      if (cPanelResponse.data && cPanelResponse.data.success) {
        deliveryPhotoPath = cPanelResponse.data.files.deliveryPhoto || null;
        deliveryNotePath = cPanelResponse.data.files.deliveryNote || null;
      }
    }

    // Save public cPanel URLs into your MySQL database
    const query = `
      INSERT INTO deliveries (delivery_date, quotation_number, company_name, delivery_photo_path, delivery_note_path) 
      VALUES (?, ?, ?, ?, ?)
    `;

    await db.query(query, [deliveryDate, quotationNumber, companyName, deliveryPhotoPath, deliveryNotePath]);

    res.status(201).json({
      success: true,
      message: 'Delivery recorded and files stored on cPanel successfully!',
      data: { deliveryDate, quotationNumber, companyName, deliveryPhotoPath, deliveryNotePath }
    });

  } catch (error) {
    console.error('Error saving delivery to cPanel:', error.response?.data || error.message);
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