const express = require('express');
const dotenv = require('dotenv');
const fraudRoutes = require('./routes/fraudRoutes');
const ingestionRoutes = require('./routes/ingestionRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const scoreRoutes = require('./routes/scoreRoutes');
const graphRoutes = require('./routes/graphRoutes');

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Main APIs
app.use('/api', ingestionRoutes);
app.use('/api', dashboardRoutes); // /alerts and /lender/:id/portfolio
app.use('/api/invoices', invoiceRoutes);
app.use('/api/score', scoreRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/fraud', fraudRoutes); // Keep legacy until fully phased out

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
