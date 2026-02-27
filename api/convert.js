const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const AdmZip = require('adm-zip');

// We need to polyfill some DOM features for pdfjs in node
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Required for Next.js/Vercel serverless to disable body parsing so formidable can read the multipart stream
export const config = {
    api: {
        bodyParser: false,
    },
};

const MAX_PAGES_FREEMIUM = 5;
const MAX_FILE_SIZE_MB = 10;

export default async function handler(req, res) {
    // Add CORS headers for the Electron App to connect freely
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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

        const fileBuffer = fs.readFileSync(file.filepath);

        // Load PDF
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) });
        const pdfDocument = await loadingTask.promise;
        const totalPages = pdfDocument.numPages;

        if (totalPages > MAX_PAGES_FREEMIUM) {
            return res.status(403).json({
                error: `Freemium limit exceeded. PDF has ${totalPages} pages. Max allowed is ${MAX_PAGES_FREEMIUM}.`
            });
        }

        const zip = new AdmZip();

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdfDocument.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 });

            // Max constraints: width 2000px
            let scale = 1.0;
            if (viewport.width > 2000) {
                scale = 2000 / viewport.width;
            }
            if (viewport.width < 1000) {
                scale = 2.0;
            }

            const scaledViewport = page.getViewport({ scale });

            const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const renderContext = {
                canvasContext: ctx,
                viewport: scaledViewport
            };

            await page.render(renderContext).promise;

            // N-API Canvas export
            const jpgBuffer = canvas.toBuffer('image/jpeg', 0.85);

            zip.addFile(`page_${i}.jpg`, jpgBuffer);
            page.cleanup();
        }

        const zipBuffer = zip.toBuffer();

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="converted.zip"');

        return res.status(200).send(zipBuffer);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
