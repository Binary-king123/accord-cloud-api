// routes/convert.js
const express = require('express');
const formidable = require('formidable');
const converterService = require('../services/converter');

const router = express.Router();

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);

router.post('/', async (req, res) => {
    try {
        const form = formidable({
            maxFileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
        });

        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                else resolve([fields, files]);
            });
        });

        const file = files.file?.[0];
        if (!file) {
            return res.status(400).json({ error: 'No PDF file uploaded.' });
        }

        const zipBuffer = await converterService.convertPdfToZip(file.filepath);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="converted.zip"');

        return res.status(200).send(zipBuffer);

    } catch (err) {
        if (err.message && err.message.includes('Freemium limit exceeded')) {
            return res.status(403).json({ error: err.message });
        }
        console.error('Error during conversion route processing:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
});

module.exports = router;
