const express = require('express');
const cors = require('cors');
const quotationRoutes = require('./routes/quotations');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mount API Routes under /api prefix
app.use('/api', quotationRoutes);

// Start Server Locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Local backend server running on http://localhost:${PORT}`);
});