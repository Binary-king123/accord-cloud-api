// services/converter.js
const fs = require('fs');
const { createCanvas } = require('@napi-rs/canvas');
const AdmZip = require('adm-zip');

// We load pdfjs-dist using dynamic import because v4+ is pure ESM
// and cannot be required directly in CommonJS modules.

const MAX_PAGES_FREEMIUM = parseInt(process.env.MAX_PAGES_FREEMIUM || '5', 10);

async function convertPdfToZip(filepath) {
    const pdfjsLib = await import('pdfjs-dist');
    const fileBuffer = fs.readFileSync(filepath);

    // Load PDF
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) });
    const pdfDocument = await loadingTask.promise;
    const totalPages = pdfDocument.numPages;

    if (totalPages > MAX_PAGES_FREEMIUM) {
        throw new Error(`Freemium limit exceeded. PDF has ${totalPages} pages. Max allowed is ${MAX_PAGES_FREEMIUM}.`);
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

    return zip.toBuffer();
}

module.exports = {
    convertPdfToZip
};
