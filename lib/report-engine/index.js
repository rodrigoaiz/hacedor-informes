const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

const { normalizeStructuredInput } = require('./schema');

function procesarImagenes(contenidoMd, carpetaBase) {
  return contenidoMd.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    if (/^(https?:|data:|file:)/i.test(src)) {
      return match;
    }

    const rutaAbsoluta = path.resolve(carpetaBase, src);

    if (fs.existsSync(rutaAbsoluta)) {
      return `![${alt}](file://${rutaAbsoluta})`;
    }

    return match;
  });
}

function procesarProbatorios(htmlContent) {
  const probatoriosRegex = /(<h2[^>]*>PROBATORIOS<\/h2>)([\s\S]*?)(?=<h2[^>]*>|$)/i;

  if (!probatoriosRegex.test(htmlContent)) {
    return htmlContent;
  }

  return htmlContent.replace(probatoriosRegex, (match, h2Tag, contenido) => {
    const subseccionesConGrid = contenido.replace(
      /(<h3[^>]*>.*?<\/h3>)\s*<p>((?:<img[^>]+>\s*)+)<\/p>/gi,
      (subMatch, h3Tag, imagenesHtml) => {
        const tituloMatch = h3Tag.match(/<h3[^>]*>(.*?)<\/h3>/i);
        const tituloCompleto = tituloMatch ? tituloMatch[1].replace(/<[^>]+>/g, '') : '';
        const tituloCorto = tituloCompleto.split(' - ')[0].trim();
        const h3TagCorto = h3Tag.replace(/>.*?<\/h3>/, `>${tituloCorto}</h3>`);

        const imagenesArray = [];
        const imgRegex = /<img\s+src="([^"]+)"\s+alt="([^"]*)"/gi;
        let imgMatch;

        while ((imgMatch = imgRegex.exec(imagenesHtml)) !== null) {
          imagenesArray.push({ src: imgMatch[1], alt: imgMatch[2] });
        }

        let gridHtml = '<div class="probatorios-section">\n';
        gridHtml += '<div class="probatorios-grid">\n';

        imagenesArray.forEach((img) => {
          gridHtml += `  <img src="${img.src}" alt="${img.alt}">\n`;
        });

        gridHtml += '</div>\n';
        gridHtml += `<p class="probatorios-caption">${tituloCompleto}</p>\n`;
        gridHtml += '</div>';

        return h3TagCorto + '\n' + gridHtml;
      }
    );

    return h2Tag + subseccionesConGrid;
  });
}

function replaceAll(template, key, value) {
  return template.replace(new RegExp(`{{${key}}}`, 'g'), value ?? '');
}

function getRootDir(customRootDir) {
  return customRootDir || path.resolve(__dirname, '..', '..');
}

function renderReportHtml({ data, markdownContent, markdownBaseDir, rootDir }) {
  const resolvedRootDir = getRootDir(rootDir);
  const templateHtmlPath = path.join(resolvedRootDir, 'plantillas', 'template.html');
  const cssHtmlPath = path.join(resolvedRootDir, 'plantillas', 'style.css');

  const contenidoConImagenesCorregidas = procesarImagenes(markdownContent, markdownBaseDir);
  let htmlContent = marked.parse(contenidoConImagenesCorregidas);
  htmlContent = procesarProbatorios(htmlContent);
  htmlContent = htmlContent.replace(/<!--\s*SALTO-PAGINA\s*-->/gi, '<div class="salto-pagina"></div>');

  let template = fs.readFileSync(templateHtmlPath, 'utf8');

  const logoUnamPath = path.resolve(resolvedRootDir, 'assets', 'logos', 'logo-unam.png');
  const logoFacmedPath = path.resolve(resolvedRootDir, 'assets', 'logos', 'logo-facmed.png');
  const logoUnamUrl = fs.existsSync(logoUnamPath) ? `file://${logoUnamPath}` : '';
  const logoFacmedUrl = fs.existsSync(logoFacmedPath) ? `file://${logoFacmedPath}` : '';

  template = replaceAll(template, 'logo_unam', logoUnamUrl);
  template = replaceAll(template, 'logo_facmed', logoFacmedUrl);
  template = replaceAll(template, 'titulo', data.titulo || 'Informe');
  template = replaceAll(template, 'nombre', data.nombre || '');
  template = replaceAll(template, 'correo', data.correo || '');
  template = replaceAll(template, 'telefono', data.telefono || '');
  template = replaceAll(template, 'jefe', data.jefe || '');
  template = replaceAll(template, 'fecha', data.fecha || '');
  template = replaceAll(template, 'periodo', data.periodo || '');
  template = replaceAll(template, 'rfc', data.rfc || '');
  template = replaceAll(template, 'nombre_firma_1', data.nombre_firma_1 || '');
  template = replaceAll(template, 'cargo_firma_1', data.cargo_firma_1 || '');
  template = replaceAll(template, 'nombre_firma_2', data.nombre_firma_2 || '');
  template = replaceAll(template, 'cargo_firma_2', data.cargo_firma_2 || '');
  template = replaceAll(template, 'nombre_firma_3', data.nombre_firma_3 || '');
  template = replaceAll(template, 'cargo_firma_3', data.cargo_firma_3 || '');
  template = replaceAll(template, 'contenido', htmlContent);

  const cssContent = fs.readFileSync(cssHtmlPath, 'utf8');
  template = template.replace('<link rel="stylesheet" href="style.css">', `<style>${cssContent}</style>`);

  return template;
}

async function generatePdfFromHtml({ htmlPath, pdfPath, rootDir }) {
  const resolvedRootDir = getRootDir(rootDir);
  const logoUnamPath = path.resolve(resolvedRootDir, 'assets', 'logos', 'logo-unam.png');
  const logoFacmedPath = path.resolve(resolvedRootDir, 'assets', 'logos', 'logo-facmed.png');
  const logoUnamBase64 = fs.existsSync(logoUnamPath)
    ? `data:image/png;base64,${fs.readFileSync(logoUnamPath).toString('base64')}`
    : '';
  const logoFacmedBase64 = fs.existsSync(logoFacmedPath)
    ? `data:image/png;base64,${fs.readFileSync(logoFacmedPath).toString('base64')}`
    : '';

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width: 100%; margin: 0; padding: 5px 30px 10px 30px; border-bottom: 2px solid #1f3864; background: white; font-family: Arial, sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px;">
            <img src="${logoUnamBase64}" style="width: 60px; height: auto; flex-shrink: 0;">
            <div style="flex: 1; text-align: center;">
              <p style="font-size: 7pt; font-weight: bold; text-transform: uppercase; margin: 1px 0; color: #1f3864;">UNIVERSIDAD NACIONAL AUTONOMA DE MEXICO</p>
              <p style="font-size: 6.5pt; font-weight: bold; text-transform: uppercase; margin: 1px 0; color: #1f3864;">FACULTAD DE MEDICINA</p>
              <p style="font-size: 6.5pt; font-weight: bold; text-transform: uppercase; margin: 1px 0; color: #1f3864;">SECRETARIA DE UNIVERSIDAD ABIERTA Y EDUCACION A DISTANCIA</p>
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
        top: '115px',
        right: '12mm',
        bottom: '12mm',
        left: '12mm',
      },
    });
  } finally {
    await browser.close();
  }
}

function buildFrontmatter(input) {
  const frontmatter = {
    titulo: input.titulo,
    nombre: input.nombre,
    correo: input.correo,
    telefono: input.telefono,
    jefe: input.jefe,
    fecha: input.fecha,
    periodo: input.periodo,
    rfc: input.rfc,
    nombre_firma_1: input.firmas[0].nombre,
    cargo_firma_1: input.firmas[0].cargo,
    nombre_firma_2: input.firmas[1].nombre,
    cargo_firma_2: input.firmas[1].cargo,
    nombre_firma_3: input.firmas[2].nombre,
    cargo_firma_3: input.firmas[2].cargo,
  };

  return `---\n${Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value ?? '')}`)
    .join('\n')}\n---`;
}

function buildMarkdownFromStructuredInput(input, markdownBaseDir, filesByField) {
  const structured = normalizeStructuredInput(input);
  let markdown = `${buildFrontmatter(structured)}\n\n`;
  markdown += `## DESCRIPCION GENERAL DE ACTIVIDADES\n${structured.descripcionGeneral}\n\n`;
  markdown += '## ACTIVIDADES REALIZADAS\n\n';

  structured.proyectos.forEach((proyecto) => {
    markdown += `### ${proyecto.nombre}\n`;
    if (proyecto.descripcion) {
      markdown += `${proyecto.descripcion}\n`;
    }
    proyecto.actividades.forEach((actividad) => {
      markdown += `* ${actividad}\n`;
    });
    markdown += '\n';
  });

  const proyectosConProbatorios = structured.proyectos.filter((proyecto) => proyecto.probatorios.length > 0);
  if (proyectosConProbatorios.length > 0) {
    markdown += '## PROBATORIOS\n\n';
    proyectosConProbatorios.forEach((proyecto) => {
      markdown += `### ${proyecto.nombre}\n\n`;
      proyecto.probatorios.forEach((probatorio) => {
        const fileData = filesByField.get(probatorio.fileField);
        if (!fileData) {
          throw new Error(`No se encontro el archivo del probatorio "${probatorio.titulo}".`);
        }

        const relativePath = path.relative(markdownBaseDir, fileData.path).split(path.sep).join('/');
        markdown += `![${probatorio.titulo}](${relativePath})\n`;
      });
      markdown += '\n';
    });
  }

  return {
    data: matter(markdown).data,
    markdownContent: matter(markdown).content,
  };
}

async function maybeGenerateDocx({ data, markdownContent, markdownBaseDir, outputDir, baseName }) {
  const outputDocxPath = path.join(outputDir, `${baseName}.docx`);
  const tempMdPath = path.join(outputDir, `${baseName}_temp.md`);
  const seccionFirmas = `\n\n---\n\n## FIRMAS\n\n**${data.nombre_firma_1 || ''}**  \n_${data.cargo_firma_1 || ''}_\n\n**${data.nombre_firma_2 || ''}**  \n_${data.cargo_firma_2 || ''}_\n\n**${data.nombre_firma_3 || ''}**  \n_${data.cargo_firma_3 || ''}_\n`;
  const markdownParaPandoc = `---\ntitle: ${JSON.stringify(data.titulo || 'Informe')}\nauthor: ${JSON.stringify(data.nombre || '')}\ndate: ${JSON.stringify(data.fecha || '')}\n---\n\n# INFORME DE ACTIVIDADES\n\n**Nombre:** ${data.nombre || ''}  \n**Correo:** ${data.correo || ''}  \n**Telefono de contacto:** ${data.telefono || ''}  \n**Nombre del jefe inmediato:** ${data.jefe || ''}  \n**Fecha:** ${data.fecha || ''}  \n**Periodo a reportar:** ${data.periodo || ''}  \n**RFC:** ${data.rfc || ''}\n\n---\n\n${markdownContent}${seccionFirmas}`;

  fs.writeFileSync(tempMdPath, markdownParaPandoc);

  try {
    const pandocCmd = `cd "${markdownBaseDir}" && pandoc "${tempMdPath}" -o "${outputDocxPath}" --resource-path="${markdownBaseDir}" 2>/dev/null || pandoc "${tempMdPath}" -o "${outputDocxPath}"`;
    execSync(pandocCmd, { stdio: 'pipe', shell: '/bin/bash' });
    return outputDocxPath;
  } finally {
    if (fs.existsSync(tempMdPath)) {
      fs.unlinkSync(tempMdPath);
    }
  }
}

async function writeOutputs({ data, markdownContent, markdownBaseDir, outputDir, baseName, rootDir, generateDocx = false }) {
  fs.mkdirSync(outputDir, { recursive: true });

  const html = renderReportHtml({ data, markdownContent, markdownBaseDir, rootDir });
  const htmlPath = path.join(outputDir, `${baseName}.html`);
  const pdfPath = path.join(outputDir, `${baseName}.pdf`);
  fs.writeFileSync(htmlPath, html);
  await generatePdfFromHtml({ htmlPath, pdfPath, rootDir });

  let docxPath = null;
  if (generateDocx) {
    try {
      docxPath = await maybeGenerateDocx({ data, markdownContent, markdownBaseDir, outputDir, baseName });
    } catch (error) {
      docxPath = null;
    }
  }

  return { htmlPath, pdfPath, docxPath };
}

async function generateReportFromMarkdownFile({ inputMarkdownPath, outputDir, baseName, rootDir, generateDocx = false }) {
  const fileContent = fs.readFileSync(inputMarkdownPath, 'utf8');
  const parsed = matter(fileContent);

  return writeOutputs({
    data: parsed.data,
    markdownContent: parsed.content,
    markdownBaseDir: path.dirname(inputMarkdownPath),
    outputDir,
    baseName,
    rootDir,
    generateDocx,
  });
}

async function generateReportFromStructuredInput({ input, filesByField, workspaceDir, outputDir, baseName, rootDir }) {
  const { data, markdownContent } = buildMarkdownFromStructuredInput(input, workspaceDir, filesByField);
  return writeOutputs({
    data,
    markdownContent,
    markdownBaseDir: workspaceDir,
    outputDir,
    baseName,
    rootDir,
    generateDocx: false,
  });
}

function findMatchingReportFile({ argument, rootDir }) {
  const resolvedRootDir = getRootDir(rootDir);
  const reportesDir = path.join(resolvedRootDir, 'reportes');
  const archivos = fs.readdirSync(reportesDir).filter((file) => file.endsWith('.md'));

  const archivoSeleccionado = archivos.find((archivo) => {
    const sinExtension = archivo.replace('.md', '');
    return (
      archivo.includes(argument) ||
      sinExtension === argument ||
      sinExtension.toLowerCase().includes(argument.toLowerCase())
    );
  });

  return {
    reportesDir,
    archivos,
    archivoSeleccionado,
  };
}

module.exports = {
  findMatchingReportFile,
  generateReportFromMarkdownFile,
  generateReportFromStructuredInput,
  normalizeStructuredInput,
};
