const express = require('express');

const { upload } = require('../middleware/upload');
const { generateReportPdf } = require('../services/report-service');

const router = express.Router();

const GENERATION_TIMEOUT_MS = 90_000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`La generación tardó más de ${ms / 1000}s. Intenta con menos probatorios o imágenes más pequeñas.`)), ms)
    ),
  ]);
}

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'hace-reportes-api' });
});

router.post('/reportes/generar', upload.array('probatorios'), async (req, res) => {
  const start = Date.now();
  try {
    const rawReportData = req.body.reportData;

    if (!rawReportData) {
      return res.status(400).json({ error: 'Falta reportData en la solicitud.' });
    }

    if (rawReportData.length > 512_000) {
      return res.status(413).json({ error: 'Los datos del reporte son demasiado grandes.' });
    }

    let reportData;
    try {
      reportData = JSON.parse(rawReportData);
    } catch {
      return res.status(400).json({ error: 'El campo reportData no es JSON válido.' });
    }

    const { pdfBuffer, filename } = await withTimeout(
      generateReportPdf({ reportData, files: req.files || [] }),
      GENERATION_TIMEOUT_MS
    );

    console.log(`[${new Date().toISOString()}] PDF generado: ${filename} (${pdfBuffer.length} bytes, ${Date.now() - start}ms)`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (error) {
    const message = error?.issues?.[0]?.message || error.message || 'Error al generar el reporte.';
    console.error(`[${new Date().toISOString()}] Error al generar PDF (${Date.now() - start}ms):`, message);
    const status = error.message?.includes('tardó más') ? 504 : 400;
    return res.status(status).json({ error: message });
  }
});

module.exports = {
  reportsRouter: router,
};
