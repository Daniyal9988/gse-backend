const express = require('express');
const cors = require('cors');
const db = require('./db'); // Imports the promise-based db pool

// Import Route Modules
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const quotationRoutes = require('./routes/quotations');
// const serialRoutes = require('./routes/serial'); // Add your serial router here later when ready

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
// app.use('/api', serialRoutes); // Mount serial routes when created

// Start Server Locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Local backend server running on http://localhost:${PORT}`);
});