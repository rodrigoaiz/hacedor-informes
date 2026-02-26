const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

// Configuración de rutas
const inputMarkdown = path.join(__dirname, 'reportes', '2026-02.md');
const templateHtmlPath = path.join(__dirname, 'plantillas', 'template.html');
const cssHtmlPath = path.join(__dirname, 'plantillas', 'style.css');
const outputPdfPath = path.join(__dirname, 'reporte_2026-02.pdf');
const outputHtmlPath = path.join(__dirname, 'reporte_temp.html'); // Para debugging

async function generarReporte() {
    try {
        console.log('1. Leyendo archivo Markdown...');
        const fileContent = fs.readFileSync(inputMarkdown, 'utf8');

        console.log('2. Extrayendo variables (Frontmatter) y contenido...');
        const parsed = matter(fileContent);
        const data = parsed.data; // Variables YAML
        const markdownContent = parsed.content; // Resto del texto

        console.log('3. Convirtiendo Markdown a HTML...');
        const htmlContent = marked.parse(markdownContent);

        console.log('4. Leyendo plantilla HTML base...');
        let template = fs.readFileSync(templateHtmlPath, 'utf8');

        // Reemplazar las variables en el HTML
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

        // Reemplazar contenido parseado de markdown
        template = template.replace('{{contenido}}', htmlContent);

        // Opcional: inyectar el CSS directamente para asegurar que puppeteer lo lea bien sin montar un servidor
        const cssContent = fs.readFileSync(cssHtmlPath, 'utf8');
        template = template.replace('<link rel="stylesheet" href="style.css">', `<style>${cssContent}</style>`);


        console.log('5. Guardando HTML temporal...');
        fs.writeFileSync(outputHtmlPath, template);

        console.log('6. Inicializando Puppeteer para impresión PDF...');
        const browser = await puppeteer.launch({
            headless: 'new' // O usa true dependiendo de tu versión
        });
        const page = await browser.newPage();
        
        // Cargar el HTML local
        await page.goto(`file://${outputHtmlPath}`, { waitUntil: 'networkidle0' });

        console.log('7. Generando PDF...');
        await page.pdf({
            path: outputPdfPath,
            format: 'Letter', // Tamaño carta
            printBackground: true, // Imprimir colores de fondo (si los hubiera)
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });

        await browser.close();
        
        // Limpiar archivo temporal (opcional, lo dejamos si quieres ver el HTML generado)
        // fs.unlinkSync(outputHtmlPath);

        console.log(`✅ ¡Reporte generado con éxito en: ${outputPdfPath}!`);

    } catch (error) {
        console.error('❌ Error generando el reporte:', error);
    }
}

generarReporte();
