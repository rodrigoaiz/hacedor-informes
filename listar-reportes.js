#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const reportesDir = path.join(__dirname, 'reportes');
const archivos = fs.readdirSync(reportesDir)
    .filter(f => f.endsWith('.md'))
    .sort();

console.log('\n📋 Reportes disponibles:\n');

if (archivos.length === 0) {
    console.log('   No hay reportes en la carpeta reportes/\n');
    process.exit(0);
}

archivos.forEach((archivo, i) => {
    const nombreBase = archivo.replace('.md', '');
    console.log(`   ${i + 1}. ${nombreBase}`);
});

console.log('\n💡 Para generar un reporte usa:');
console.log(`   npm run generar ${archivos[0].replace('.md', '')}\n`);
