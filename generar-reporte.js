#!/usr/bin/env node

const path = require('path');
const {
    findMatchingReportFile,
    generateReportFromMarkdownFile,
} = require('./lib/report-engine');

// Obtener el argumento desde la línea de comandos
const argumento = process.argv[2];

if (!argumento) {
    console.log('❌ Debes indicar el archivo o periodo a generar');
    console.log('\nEjemplos de uso:');
    console.log('  npm run generar 2026-02');
    console.log('  npm run generar febrero');
    console.log('  npm run generar 2026-03');
    process.exit(1);
}

const { reportesDir, archivos, archivoSeleccionado } = findMatchingReportFile({
    argument: argumento,
    rootDir: __dirname,
});

if (!archivoSeleccionado) {
    console.log(`❌ No se encontró ningún reporte que coincida con "${argumento}"`);
    console.log('\nReportes disponibles:');
    archivos.forEach(a => console.log(`  - ${a.replace('.md', '')}`));
    process.exit(1);
}

const inputMarkdown = path.join(reportesDir, archivoSeleccionado);
const nombreBase = archivoSeleccionado.replace('.md', '');
const salidaDir = path.join(__dirname, 'salida');

async function generarReporte() {
    try {
        console.log(`\n📄 Generando reporte: ${nombreBase}\n`);
        const result = await generateReportFromMarkdownFile({
            inputMarkdownPath: inputMarkdown,
            outputDir: salidaDir,
            baseName: nombreBase,
            rootDir: __dirname,
            generateDocx: true,
        });

        console.log('\n✅ ¡Reporte generado exitosamente!\n');
        console.log(`   HTML: ${path.relative(__dirname, result.htmlPath)}`);
        console.log(`   PDF:  ${path.relative(__dirname, result.pdfPath)}`);
        if (result.docxPath) {
            console.log(`   DOCX: ${path.relative(__dirname, result.docxPath)}\n`);
        } else {
            console.log('   DOCX: no disponible (Pandoc no encontrado o fallo la conversion)\n');
        }

    } catch (error) {
        console.error('\n❌ Error generando el reporte:', error.message);
        process.exit(1);
    }
}

generarReporte();
