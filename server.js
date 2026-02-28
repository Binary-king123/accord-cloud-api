// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const convertRoute = require('./routes/convert');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for the Electron App to connect freely
app.use(cors({
    origin: '*',
    methods: ['POST', 'OPTIONS'],
}));

// Basic health check route
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Accord Conversion API is running' });
});

// Mount conversion route
app.use('/convert', convertRoute);

app.listen(PORT, () => {
    console.log(`🚀 Accord Conversion API is running on port ${PORT}`);
    console.log(`- Max pages freemium: ${process.env.MAX_PAGES_FREEMIUM || 5}`);
    console.log(`- Max file size (MB): ${process.env.MAX_FILE_SIZE_MB || 10}`);
});
