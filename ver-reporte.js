#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const argumento = process.argv[2];

if (!argumento) {
    console.log('❌ Debes indicar qué reporte quieres ver');
    console.log('\nEjemplo:');
    console.log('  npm run ver 2026-02');
    process.exit(1);
}

// Buscar el archivo HTML correspondiente
const salidaDir = path.join(__dirname, 'salida');
const archivos = fs.readdirSync(salidaDir).filter(f => f.endsWith('.html'));

let archivoSeleccionado = null;

for (const archivo of archivos) {
    const sinExtension = archivo.replace('.html', '');
    if (
        archivo.includes(argumento) ||
        sinExtension === argumento ||
        sinExtension.toLowerCase().includes(argumento.toLowerCase())
    ) {
        archivoSeleccionado = archivo;
        break;
    }
}

if (!archivoSeleccionado) {
    console.log(`❌ No se encontró ningún reporte HTML que coincida con "${argumento}"`);
    console.log('\nReportes HTML disponibles:');
    archivos.forEach(a => console.log(`  - ${a.replace('.html', '')}`));
    process.exit(1);
}

const htmlPath = path.join(salidaDir, archivoSeleccionado);
const pdfPath = htmlPath.replace('.html', '.pdf');

console.log(`\n📄 Abriendo reporte: ${archivoSeleccionado.replace('.html', '')}`);

// Intentar abrir el PDF primero, si no el HTML
try {
    if (fs.existsSync(pdfPath)) {
        console.log('📑 Abriendo PDF...');
        execSync(`xdg-open "${pdfPath}"`, { stdio: 'ignore' });
    } else {
        console.log('🌐 Abriendo HTML en el navegador...');
        execSync(`xdg-open "${htmlPath}"`, { stdio: 'ignore' });
    }
    console.log('✅ Abierto!\n');
} catch (error) {
    console.log(`\n📂 Ubicación del archivo:`);
    console.log(`   ${htmlPath}`);
    console.log(`\nAbre el archivo manualmente en tu navegador o visor de PDF.\n`);
}
