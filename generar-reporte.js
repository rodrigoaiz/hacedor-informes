#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

/**
 * Procesa el contenido markdown para convertir rutas de imágenes relativas
 * a rutas absolutas usando file:// URLs
 */
function procesarImagenes(contenidoMd, carpetaBase) {
    // Regex para encontrar imágenes markdown: ![texto](ruta)
    return contenidoMd.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        // Si es una URL absoluta (http:// o https:// o data:), dejarla como está
        if (/^(https?:|data:)/i.test(src)) {
            return match;
        }
        
        // Si es una ruta relativa, convertirla a absoluta
        const rutaAbsoluta = path.resolve(carpetaBase, src);
        
        // Verificar si el archivo existe
        if (fs.existsSync(rutaAbsoluta)) {
            // Convertir a file:// URL
            const fileUrl = 'file://' + rutaAbsoluta;
            return `![${alt}](${fileUrl})`;
        } else {
            console.warn(`⚠️  Advertencia: No se encontró la imagen: ${src}`);
            return match; // Dejar la imagen como está si no existe
        }
    });
}

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

// Buscar el archivo correspondiente
const reportesDir = path.join(__dirname, 'reportes');
const archivos = fs.readdirSync(reportesDir).filter(f => f.endsWith('.md'));

let archivoSeleccionado = null;

// Búsqueda inteligente
for (const archivo of archivos) {
    const sinExtension = archivo.replace('.md', '');
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
    console.log(`❌ No se encontró ningún reporte que coincida con "${argumento}"`);
    console.log('\nReportes disponibles:');
    archivos.forEach(a => console.log(`  - ${a.replace('.md', '')}`));
    process.exit(1);
}

const inputMarkdown = path.join(reportesDir, archivoSeleccionado);
const nombreBase = archivoSeleccionado.replace('.md', '');
const templateHtmlPath = path.join(__dirname, 'plantillas', 'template.html');
const cssHtmlPath = path.join(__dirname, 'plantillas', 'style.css');

// Crear carpeta salida si no existe
const salidaDir = path.join(__dirname, 'salida');
if (!fs.existsSync(salidaDir)) {
    fs.mkdirSync(salidaDir);
}

const outputHtmlPath = path.join(salidaDir, `${nombreBase}.html`);
const outputPdfPath = path.join(salidaDir, `${nombreBase}.pdf`);

async function generarReporte() {
    try {
        console.log(`\n📄 Generando reporte: ${nombreBase}\n`);
        
        console.log('1️⃣  Leyendo archivo Markdown...');
        const fileContent = fs.readFileSync(inputMarkdown, 'utf8');

        console.log('2️⃣  Procesando contenido...');
        const parsed = matter(fileContent);
        const data = parsed.data;
        
        // Procesar imágenes para convertir rutas relativas a absolutas
        const carpetaBase = path.dirname(inputMarkdown);
        const contenidoConImagenesCorregidas = procesarImagenes(parsed.content, carpetaBase);
        
        const htmlContent = marked.parse(contenidoConImagenesCorregidas);

        console.log('3️⃣  Aplicando plantilla HTML...');
        let template = fs.readFileSync(templateHtmlPath, 'utf8');

        // Configurar rutas de logos
        const logoUnamPath = path.resolve(__dirname, 'assets', 'logos', 'logo-unam.png');
        const logoFacmedPath = path.resolve(__dirname, 'assets', 'logos', 'logo-facmed.png');
        
        const logoUnamUrl = fs.existsSync(logoUnamPath) ? 'file://' + logoUnamPath : '';
        const logoFacmedUrl = fs.existsSync(logoFacmedPath) ? 'file://' + logoFacmedPath : '';
        
        if (!fs.existsSync(logoUnamPath)) {
            console.warn('⚠️  Advertencia: No se encontró logo-unam.png en assets/logos/');
        }
        if (!fs.existsSync(logoFacmedPath)) {
            console.warn('⚠️  Advertencia: No se encontró logo-facmed.png en assets/logos/');
        }

        // Reemplazar variables
        template = template.replace('{{logo_unam}}', logoUnamUrl);
        template = template.replace('{{logo_facmed}}', logoFacmedUrl);
        template = template.replace('{{titulo}}', data.titulo || 'Informe');
        template = template.replace('{{nombre}}', data.nombre || '');
        template = template.replace('{{correo}}', data.correo || '');
        template = template.replace('{{telefono}}', data.telefono || '');
        template = template.replace('{{jefe}}', data.jefe || '');
        template = template.replace('{{fecha}}', data.fecha || '');
        template = template.replace('{{periodo}}', data.periodo || '');
        template = template.replace('{{rfc}}', data.rfc || '');
        
        template = template.replace('{{nombre_firma_1}}', data.nombre_firma_1 || '');
        template = template.replace('{{cargo_firma_1}}', data.cargo_firma_1 || '');
        template = template.replace('{{nombre_firma_2}}', data.nombre_firma_2 || '');
        template = template.replace('{{cargo_firma_2}}', data.cargo_firma_2 || '');
        template = template.replace('{{nombre_firma_3}}', data.nombre_firma_3 || '');
        template = template.replace('{{cargo_firma_3}}', data.cargo_firma_3 || '');

        template = template.replace('{{contenido}}', htmlContent);

        // Inyectar CSS
        const cssContent = fs.readFileSync(cssHtmlPath, 'utf8');
        template = template.replace('<link rel="stylesheet" href="style.css">', `<style>${cssContent}</style>`);

        console.log('4️⃣  Guardando HTML...');
        fs.writeFileSync(outputHtmlPath, template);

        console.log('5️⃣  Generando PDF con Puppeteer...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.goto(`file://${outputHtmlPath}`, { waitUntil: 'networkidle0' });

        await page.pdf({
            path: outputPdfPath,
            format: 'Letter',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });

        await browser.close();

        console.log('\n✅ ¡Reporte generado exitosamente!\n');
        console.log(`   HTML: salida/${nombreBase}.html`);
        console.log(`   PDF:  salida/${nombreBase}.pdf\n`);

    } catch (error) {
        console.error('\n❌ Error generando el reporte:', error.message);
        process.exit(1);
    }
}

generarReporte();
