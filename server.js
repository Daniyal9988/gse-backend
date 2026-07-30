const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); // Imports the promise-based db pool

// Import Route Modules
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const quotationRoutes = require('./routes/quotations');
const deliveryRoutes = require('./routes/deliveries');
// const serialRoutes = require('./routes/serial'); // Add your serial router here later when ready

const app = express();

// Whitelist allowed frontend origins (Restricts API access to only your frontend)
const allowedOrigins = [
  'https://gse-sa.com',           // Your live production frontend domain
  'https://www.gse-sa.com',       // With www just in case
  'http://localhost:5173',        // Local Vite/React development port (if applicable)
  'http://localhost:3000',         // Local development port
  'https://gse-iqs.vercel.app/'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman testing, or server-to-server)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS: Unauthorized origin.'));
    }
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Serve uploaded files statically so they can be accessed via URL
app.use('/uploads', express.static(path.join(__dirname, 'public_html/uploads')));

// Test DB Connection Endpoint
app.get('/api/test', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ success: true, message: 'Database connected successfully!' });
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).json({ success: false, error: err.message, code: err.code, sqlMessage: err.sqlMessage });
    }
});

// Mount API Routes under /api prefix
app.use('/api', authRoutes);
app.use('/api', productRoutes);
app.use('/api', quotationRoutes);
app.use('/api', deliveryRoutes);
// app.use('/api', serialRoutes); // Mount serial routes when created

// Start Server Locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Local backend server running on http://localhost:${PORT}`);
});