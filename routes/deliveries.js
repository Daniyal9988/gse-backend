const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// Use memory storage so files are temporarily held in RAM
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});

// Configure multer to accept 'deliveryNote' and individual picture fields 1 through 5
const uploadFields = upload.fields([
  { name: 'deliveryNote', maxCount: 1 },
  { name: 'deliveryPicture1', maxCount: 1 },
  { name: 'deliveryPicture2', maxCount: 1 },
  { name: 'deliveryPicture3', maxCount: 1 },
  { name: 'deliveryPicture4', maxCount: 1 },
  { name: 'deliveryPicture5', maxCount: 1 }
]);

const db = require('../db'); 

// Helper function to push files to your cPanel PHP receiver
async function sendFilesToCPandel(files) {
  const formData = new FormData();

  // 1. Append deliveryNote if it exists
  if (files['deliveryNote'] && files['deliveryNote'][0]) {
    const note = files['deliveryNote'][0];
    formData.append('deliveryNote', note.buffer, {
      filename: note.originalname,
      contentType: note.mimetype,
    });
  }

  // 2. Map deliveryPicture1-5 into deliveryPhotos[] for your cPanel PHP script
  const pictureFields = ['deliveryPicture1', 'deliveryPicture2', 'deliveryPicture3', 'deliveryPicture4', 'deliveryPicture5'];
  
  pictureFields.forEach((fieldKey) => {
    if (files[fieldKey] && files[fieldKey][0]) {
      const pic = files[fieldKey][0];
      formData.append('deliveryPhotos[]', pic.buffer, {
        filename: pic.originalname,
        contentType: pic.mimetype,
      });
    }
  });

  const response = await axios.post('https://mxk.dpn.mybluehost.me/api/upload_receiver.php', formData, {
    headers: {
      ...formData.getHeaders(),
      'Authorization': 'Bearer GSE-DATABASE-2021'
    }
  });

  console.log('cPanel Upload Response:', response.data);

  if (response.data && response.data.success) {
    return response.data.files; // Expected: { deliveryNote: '...', deliveryPhotos: [...] }
  }
  throw new Error('Failed to upload files to cPanel receiver');
}

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
    
    if (deliveryDate) {
      deliveryDate = deliveryDate.split('T')[0];
    }
    
    let deliveryNoteUrl = null;
    let pic1Url = null;
    let pic2Url = null;
    let pic3Url = null;
    let pic4Url = null;
    let pic5Url = null;

    // If files were uploaded, stream them to cPanel first
    if (req.files && Object.keys(req.files).length > 0) {
      const cPanelFiles = await sendFilesToCPandel(req.files);
      
      deliveryNoteUrl = cPanelFiles.deliveryNote || null;
      
      const photos = cPanelFiles.deliveryPhotos || [];
      pic1Url = photos[0] || null;
      pic2Url = photos[1] || null;
      pic3Url = photos[2] || null;
      pic4Url = photos[3] || null;
      pic5Url = photos[4] || null;
    }

    const query = `
      INSERT INTO deliveries 
      (delivery_date, quotation_number, company_name, status, delivery_note, delivery_picture_1, delivery_picture_2, delivery_picture_3, delivery_picture_4, delivery_picture_5)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      deliveryDate, 
      quotationNumber, 
      companyName, 
      status || 'Pending', 
      deliveryNoteUrl, 
      pic1Url, 
      pic2Url, 
      pic3Url, 
      pic4Url, 
      pic5Url
    ]);

    res.status(201).json({ 
      success: true, 
      message: 'Delivery created and files uploaded to cPanel successfully', 
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

    if (deliveryDate) {
      deliveryDate = deliveryDate.split('T')[0];
    }

    const [existing] = await db.query('SELECT * FROM deliveries WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Delivery record not found' });
    }

    let deliveryNoteUrl = existing[0].delivery_note;
    let pic1Url = existing[0].delivery_picture_1;
    let pic2Url = existing[0].delivery_picture_2;
    let pic3Url = existing[0].delivery_picture_3;
    let pic4Url = existing[0].delivery_picture_4;
    let pic5Url = existing[0].delivery_picture_5;

    // If new files are uploaded, send them to cPanel
    if (req.files && Object.keys(req.files).length > 0) {
      const cPanelFiles = await sendFilesToCPandel(req.files);
      
      if (cPanelFiles.deliveryNote) {
        deliveryNoteUrl = cPanelFiles.deliveryNote;
      }
      
      const photos = cPanelFiles.deliveryPhotos || [];
      if (photos.length > 0) {
        if (photos[0]) pic1Url = photos[0];
        if (photos[1]) pic2Url = photos[1];
        if (photos[2]) pic3Url = photos[2];
        if (photos[3]) pic4Url = photos[3];
        if (photos[4]) pic5Url = photos[4];
      }
    }

    const query = `
      UPDATE deliveries 
      SET delivery_date = ?, quotation_number = ?, company_name = ?, status = ?, delivery_note = ?, delivery_picture_1 = ?, delivery_picture_2 = ?, delivery_picture_3 = ?, delivery_picture_4 = ?, delivery_picture_5 = ?
      WHERE id = ?
    `;

    await db.query(query, [
      deliveryDate, 
      quotationNumber, 
      companyName, 
      status, 
      deliveryNoteUrl, 
      pic1Url, 
      pic2Url, 
      pic3Url, 
      pic4Url, 
      pic5Url, 
      id
    ]);

    res.json({ success: true, message: 'Delivery updated successfully' });
  } catch (error) {
    console.error('Error updating delivery:', error);
    res.status(500).json({ success: false, message: 'Server error updating delivery' });
  }
});

// 4. DELETE DELIVERY
router.delete('/deliveries/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM deliveries WHERE id = ?', [id]);
    res.json({ success: true, message: 'Delivery deleted successfully' });
  } catch (error) {
    console.error('Error deleting delivery:', error);
    res.status(500).json({ success: false, message: 'Server error deleting delivery' });
  }
});

module.exports = router;