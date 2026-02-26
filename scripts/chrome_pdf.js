#!/usr/bin/env node
const path = require("path");
const puppeteer = require("puppeteer");

async function main() {
  const [, , inputHtml, outputPdf, chromePathArg] = process.argv;
  if (!inputHtml || !outputPdf) {
    console.error("Uso: node scripts/chrome_pdf.js <input_html> <output_pdf> [chrome_path]");
    process.exit(2);
  }

  const htmlAbs = path.resolve(inputHtml);
  const pdfAbs = path.resolve(outputPdf);

  const launchOptions = {
    headless: true,
  };
  if (chromePathArg) {
    launchOptions.executablePath = chromePathArg;
  }

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlAbs}`, { waitUntil: "networkidle0" });

    await page.pdf({
      path: pdfAbs,
      format: "Letter",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate:
        "<div style='font-size:10px;width:100%;text-align:center;color:#000;'><span class='pageNumber'></span></div>",
      margin: {
        top: "14mm",
        right: "15mm",
        bottom: "14mm",
        left: "15mm",
      },
    });
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
