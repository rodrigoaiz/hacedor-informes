const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { generateReportFromStructuredInput } = require('../../lib/report-engine');

function slugifyBaseName(value) {
  const normalized = String(value || 'reporte')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return normalized || 'reporte';
}

async function saveUploadedFiles(tempDir, files) {
  const uploadsDir = path.join(tempDir, 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });

  const filesByField = new Map();
  for (const file of files) {
    const [fileField, originalName = 'evidencia'] = String(file.originalname || '').split('__');
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '-');
    const targetPath = path.join(uploadsDir, `${Date.now()}-${safeName}`);
    await fs.writeFile(targetPath, file.buffer);
    filesByField.set(fileField, {
      path: targetPath,
      mimetype: file.mimetype,
    });
  }

  return filesByField;
}

async function generateReportPdf({ reportData, files }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hace-reportes-'));
  const outputDir = path.join(tempDir, 'output');

  try {
    const filesByField = await saveUploadedFiles(tempDir, files);
    const baseName = slugifyBaseName(reportData.periodo || reportData.titulo);
    const result = await generateReportFromStructuredInput({
      input: reportData,
      filesByField,
      workspaceDir: tempDir,
      outputDir,
      baseName,
    });

    const pdfBuffer = await fs.readFile(result.pdfPath);
    return {
      pdfBuffer,
      filename: `${baseName}.pdf`,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  generateReportPdf,
};
