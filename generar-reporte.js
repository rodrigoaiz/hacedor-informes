#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

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

/**
 * Procesa el HTML de la sección PROBATORIOS para organizar las imágenes en un grid 2x2
 */
function procesarProbatorios(htmlContent) {
    // Buscar la sección PROBATORIOS y sus subsecciones hasta el final
    const probatoriosRegex = /(<h2[^>]*>PROBATORIOS<\/h2>)([\s\S]*?)(<div class="salto-pagina">|$)/i;
    
    if (!probatoriosRegex.test(htmlContent)) {
        return htmlContent; // No hay sección PROBATORIOS
    }
    
    return htmlContent.replace(probatoriosRegex, (match, h2Tag, contenido, finale) => {
        // Procesar cada subsección (h3) que contiene imágenes
        const subseccionesConGrid = contenido.replace(
            /(<h3[^>]*>.*?<\/h3>)\s*<p>((?:<img[^>]+>\s*)+)<\/p>/gi,
            (subMatch, h3Tag, imagenesHtml) => {
                // Extraer el título completo de la subsección
                const tituloMatch = h3Tag.match(/<h3[^>]*>(.*?)<\/h3>/i);
                const tituloCompleto = tituloMatch ? tituloMatch[1].replace(/<[^>]+>/g, '') : '';
                
                // Extraer solo la parte antes del primer guion para el h3
                const tituloCorto = tituloCompleto.split(' - ')[0].trim();
                
                // Actualizar el h3 con el título corto
                const h3TagCorto = h3Tag.replace(/>.*?<\/h3>/, `>${tituloCorto}</h3>`);
                
                // Extraer todas las imágenes
                const imagenesArray = [];
                const imgRegex = /<img\s+src="([^"]+)"\s+alt="([^"]*)"/gi;
                let imgMatch;
                
                while ((imgMatch = imgRegex.exec(imagenesHtml)) !== null) {
                    imagenesArray.push({
                        src: imgMatch[1],
                        alt: imgMatch[2]
                    });
                }
                
                // Crear el grid con UN SOLO caption para todo el bloque (con título completo)
                let gridHtml = '<div class="probatorios-section">\n';
                gridHtml += '<div class="probatorios-grid">\n';
                
                imagenesArray.forEach((img) => {
                    gridHtml += `  <img src="${img.src}" alt="${img.alt}">\n`;
                });
                
                gridHtml += '</div>\n';
                
                // Caption único para todo el bloque con el título COMPLETO
                gridHtml += `<p class="probatorios-caption">${tituloCompleto}</p>\n`;
                gridHtml += '</div>';
                
                return h3TagCorto + '\n' + gridHtml;
            }
        );
        
        return h2Tag + subseccionesConGrid + (finale || '');
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
        
        let htmlContent = marked.parse(contenidoConImagenesCorregidas);
        
        // Procesar la sección PROBATORIOS para crear grid 2x2
        htmlContent = procesarProbatorios(htmlContent);

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
        
        // Convertir logos a base64 para usar en headerTemplate
        const logoUnamBase64 = fs.existsSync(logoUnamPath) 
            ? `data:image/png;base64,${fs.readFileSync(logoUnamPath).toString('base64')}`
            : '';
        const logoFacmedBase64 = fs.existsSync(logoFacmedPath)
            ? `data:image/png;base64,${fs.readFileSync(logoFacmedPath).toString('base64')}`
            : '';
        
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
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="width: 100%; margin: 0; padding: 5px 30px 10px 30px; border-bottom: 2px solid #1f3864; background: white; font-family: Arial, sans-serif;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px;">
                        <img src="${logoUnamBase64}" style="width: 60px; height: auto; flex-shrink: 0;">
                        <div style="flex: 1; text-align: center;">
                            <p style="font-size: 7pt; font-weight: bold; text-transform: uppercase; margin: 1px 0; color: #1f3864;">UNIVERSIDAD NACIONAL AUTÓNOMA DE MÉXICO</p>
                            <p style="font-size: 6.5pt; font-weight: bold; text-transform: uppercase; margin: 1px 0; color: #1f3864;">FACULTAD DE MEDICINA</p>
                            <p style="font-size: 6.5pt; font-weight: bold; text-transform: uppercase; margin: 1px 0; color: #1f3864;">SECRETARÍA DE UNIVERSIDAD ABIERTA Y EDUCACIÓN A DISTANCIA</p>
                            <h1 style="font-size: 10pt; text-transform: uppercase; font-weight: bold; margin: 5px 0 0 0; padding-top: 5px; border-top: 1px solid #ccc;">INFORME DE ACTIVIDADES</h1>
                        </div>
                        <img src="${logoFacmedBase64}" style="width: 60px; height: auto; flex-shrink: 0;">
                    </div>
                </div>
            `,
            footerTemplate: `
                <div style="font-size: 9pt; color: #666; text-align: right; width: 100%; padding-right: 20px;">
                    <span class="pageNumber"></span> / <span class="totalPages"></span>
                </div>
            `,
            margin: {
                top: '115px',     // Espacio para el header con logos
                right: '15mm',
                bottom: '20mm',   // Espacio para el footer con número de página
                left: '15mm'
            }
        });

        await browser.close();

        console.log('6️⃣  Generando DOCX con Pandoc...');
        
        // Generar DOCX usando Pandoc
        const outputDocxPath = path.join(salidaDir, `${nombreBase}.docx`);
        
        try {
            // Crear un markdown temporal con metadatos y contenido completo para Pandoc
            // Incluimos las firmas al final del contenido
            const seccionFirmas = `

---

## FIRMAS

**${data.nombre_firma_1 || ''}**  
_${data.cargo_firma_1 || ''}_

**${data.nombre_firma_2 || ''}**  
_${data.cargo_firma_2 || ''}_

**${data.nombre_firma_3 || ''}**  
_${data.cargo_firma_3 || ''}_
`;

            const markdownParaPandoc = `---
title: "${data.titulo || 'Informe'}"
author: "${data.nombre || ''}"
date: "${data.fecha || ''}"
---

# INFORME DE ACTIVIDADES

**Nombre:** ${data.nombre || ''}  
**Correo:** ${data.correo || ''}  
**Teléfono de contacto:** ${data.telefono || ''}  
**Nombre del jefe inmediato:** ${data.jefe || ''}  
**Fecha:** ${data.fecha || ''}  
**Periodo a reportar:** ${data.periodo || ''}  
**RFC:** ${data.rfc || ''}

---

${parsed.content}${seccionFirmas}
`;
            
            const tempMdPath = path.join(salidaDir, `${nombreBase}_temp.md`);
            fs.writeFileSync(tempMdPath, markdownParaPandoc);
            
            // Ejecutar Pandoc con la carpeta de trabajo configurada para resolver imágenes
            const pandocCmd = `cd "${path.dirname(inputMarkdown)}" && pandoc "${tempMdPath}" -o "${outputDocxPath}" --resource-path="${path.dirname(inputMarkdown)}" 2>/dev/null || pandoc "${tempMdPath}" -o "${outputDocxPath}"`;
            
            execSync(pandocCmd, {
                stdio: 'pipe',
                shell: '/bin/bash'
            });
            
            // Eliminar archivo temporal
            fs.unlinkSync(tempMdPath);
            
            console.log('\n✅ ¡Reporte generado exitosamente!\n');
            console.log(`   HTML: salida/${nombreBase}.html`);
            console.log(`   PDF:  salida/${nombreBase}.pdf`);
            console.log(`   DOCX: salida/${nombreBase}.docx\n`);
        } catch (docxError) {
            console.warn(`⚠️  No se pudo generar DOCX: ${docxError.message}`);
            console.log('\n✅ ¡Reporte generado exitosamente!\n');
            console.log(`   HTML: salida/${nombreBase}.html`);
            console.log(`   PDF:  salida/${nombreBase}.pdf\n`);
        }

    } catch (error) {
        console.error('\n❌ Error generando el reporte:', error.message);
        process.exit(1);
    }
}

generarReporte();
