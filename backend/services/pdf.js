import puppeteer from "puppeteer";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtmlDocument(markdownHtml, partnerName, period) {
  const pName = escHtml(partnerName || "Partner");
  const pPeriod = escHtml(period || "—");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #282A30;
      font-family: "Titillium Web", system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.55;
    }
    .page-wrap { min-height: 100vh; display: flex; flex-direction: column; }
    .header {
      width: 100%;
      background: linear-gradient(135deg, #3E4FE0 0%, #1726A6 100%);
      color: #ffffff;
      padding: 28px 56px 36px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
    }
    .wordmark {
      font-size: 28px;
      font-weight: 600;
      color: #ffffff;
      letter-spacing: -0.02em;
    }
    .report-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.92);
      text-align: right;
      max-width: 55%;
    }
    .header-main-title {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
      margin: 0 0 8px 0;
      color: #ffffff;
    }
    .header-period {
      font-size: 18px;
      font-weight: 400;
      color: rgba(255,255,255,0.9);
      margin: 0;
    }
    .content {
      flex: 1;
      padding: 48px 56px;
    }
    .content :first-child { margin-top: 0; }
    .content h1 {
      font-size: 26px;
      font-weight: 700;
      color: #1726A6;
      margin: 0 0 20px 0;
      line-height: 1.25;
    }
    .content h2 {
      position: relative;
      font-size: 18px;
      font-weight: 700;
      color: #282A30;
      margin: 36px 0 14px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #3E4FE0;
    }
    .content h2::before {
      content: "SECTION";
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #3E4FE0;
      margin-bottom: 8px;
    }
    .content h3 {
      font-size: 15px;
      font-weight: 700;
      color: #1726A6;
      margin: 24px 0 10px 0;
    }
    .content p { margin: 0 0 12px 0; color: #282A30; }
    .content a { color: #3E4FE0; }
    .content ul, .content ol {
      margin: 0 0 14px 0;
      padding-left: 1.35rem;
      color: #282A30;
    }
    .content li { margin-bottom: 6px; }
    .content li::marker { color: #3E4FE0; }
    .content ul li::marker { color: #3E4FE0; }
    .content blockquote {
      margin: 14px 0;
      padding: 12px 16px;
      border-left: 4px solid #E0ED80;
      background: #E8EAF5;
      color: #282A30;
    }
    .content pre {
      background: #E8EAF5;
      border: 1px solid #d8dce8;
      border-radius: 8px;
      padding: 14px 16px;
      overflow-x: auto;
      font-size: 12px;
      margin: 14px 0;
    }
    .content code {
      font-family: ui-monospace, monospace;
      font-size: 12px;
      background: #E8EAF5;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .content pre code { background: transparent; padding: 0; }
    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      font-size: 13px;
    }
    .content thead th {
      background: #3E4FE0;
      color: #ffffff;
      font-weight: 700;
      text-align: left;
      padding: 12px 14px;
      border: 1px solid #1726A6;
    }
    .content tbody td {
      padding: 10px 14px;
      border: 1px solid #d8dce8;
      color: #282A30;
    }
    .content tbody tr:nth-child(even) { background: #E8EAF5; }
    .content tbody tr:nth-child(odd) { background: #ffffff; }
    .content hr {
      border: none;
      border-top: 1px solid #E8EAF5;
      margin: 28px 0;
    }
    .content strong { color: #1726A6; }
    .footer {
      width: 100%;
      background: #282A30;
      color: #ffffff;
      padding: 18px 56px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
    }
    .footer a { color: #E0ED80; text-decoration: none; }
    .secondary { color: #92959B; font-size: 12px; }
  </style>
</head>
<body>
  <div class="page-wrap">
    <header class="header">
      <div class="header-top">
        <div class="wordmark">yuno</div>
        <div class="report-label">Partner Performance Report</div>
      </div>
      <h1 class="header-main-title">${pName}</h1>
      <p class="header-period">${pPeriod}</p>
    </header>
    <main class="content">
      ${markdownHtml}
    </main>
    <footer class="footer">
      <span>yuno</span>
      <a href="https://www.y.uno">www.y.uno</a>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * @param {string} text - Markdown report body
 * @param {{ partnerName?: string; period?: string }} [options]
 * @returns {Promise<Buffer>}
 */
export async function markdownToPdfBuffer(text, options = {}) {
  const { partnerName = "", period = "" } = options;
  const markdownHtml = marked.parse(String(text || ""));
  const html = buildHtmlDocument(markdownHtml, partnerName, period);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfUint8 = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}
