const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

const invoiceRoutes = require('./routes/invoiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const scoreRoutes = require('./routes/scoreRoutes');
const graphRoutes = require('./routes/graphRoutes');
const explainRoutes = require('./routes/explainRoutes');
const retailRoutes = require('./routes/retailRoutes');
const authRoutes = require('./routes/authRoutes');
const erpRoutes = require('./routes/erpRoutes');
const mlRoutes = require('./routes/mlRoutes');

// Load environment variables
dotenv.config();

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// preflightContinue: false  — cors() will fully handle OPTIONS requests itself
// (no separate app.options route needed, avoids Express path-matching crashes)
const corsOptions = {
    origin: true,                    // reflect request origin (any dev host allowed)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-lender-id',               // required by lenderAuth middleware
    ],
    credentials: true,
    preflightContinue: false,        // respond to OPTIONS immediately, don't pass to next
    optionsSuccessStatus: 204,       // 200 breaks some old browsers; 204 is safe
};
app.use(cors(corsOptions));
app.use(express.json());



// Retail APIs (Unauthenticated for prototype demo)
app.use('/api/retail', retailRoutes);

// Main APIs (Authenticated via x-lender-id)
app.use('/api/auth', authRoutes);
app.use('/api/erp', erpRoutes);
app.use('/api/ml', mlRoutes);

app.use('/api', dashboardRoutes); // /alerts and /lender/:id/portfolio
app.use('/api/invoices', invoiceRoutes);
app.use('/api/score', scoreRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/explain', explainRoutes);
app.use('/api/identity', require('./routes/identityRoutes'));

const websocketService = require('./services/websocketService');

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

websocketService.init(server);
