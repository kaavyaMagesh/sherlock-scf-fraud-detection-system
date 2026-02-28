const express = require('express');
const dotenv = require('dotenv');
const fraudRoutes = require('./routes/fraudRoutes');

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Main fraud API routes
app.use('/api', fraudRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
