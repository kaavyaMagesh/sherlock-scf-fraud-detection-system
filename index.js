const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const fraudRoutes = require('./routes/fraudRoutes');
const ingestionRoutes = require('./routes/ingestionRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const scoreRoutes = require('./routes/scoreRoutes');
const graphRoutes = require('./routes/graphRoutes');
const explainRoutes = require('./routes/explainRoutes');
const retailRoutes = require('./routes/retailRoutes');

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Retail APIs (Unauthenticated for prototype demo)
app.use('/api/retail', retailRoutes);

// Main APIs (Authenticated via x-lender-id)
app.use('/api', ingestionRoutes);
app.use('/api', dashboardRoutes); // /alerts and /lender/:id/portfolio
app.use('/api/invoices', invoiceRoutes);
app.use('/api/score', scoreRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/fraud', fraudRoutes); // Keep legacy until fully phased out
app.use('/api/explain', explainRoutes);
app.use('/api/identity', require('./routes/identityRoutes'));

const websocketService = require('./services/websocketService');

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

websocketService.init(server);
