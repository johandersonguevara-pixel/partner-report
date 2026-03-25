import puppeteer from "puppeteer";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

const CHART_CDN =
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Remove common markdown emphasis so chart/table-derived strings render cleanly */
function stripMarkdown(s) {
  let t = String(s ?? "");
  t = t.replace(/\*\*([\s\S]+?)\*\*/g, "$1");
  t = t.replace(/\*([\s\S]+?)\*/g, "$1");
  t = t.replace(/__([\s\S]+?)__/g, "$1");
  t = t.replace(/_([\s\S]+?)_/g, "$1");
  t = t.replace(/[*_]/g, "");
  return t.trim();
}

function splitPipeRow(line) {
  const parts = line.split("|").map((p) => p.trim());
  if (parts[0] === "") parts.shift();
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/** @returns {{ headers: string[], rows: string[][] }[]} */
function parseMarkdownTables(md) {
  const lines = String(md || "").split(/\r?\n/);
  const tables = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) continue;
    const sep = lines[i + 1];
    if (!sep || !/^\|[\s\-:|]+\|/.test(sep.trim())) continue;
    const headers = splitPipeRow(line);
    if (headers.length < 2) continue;
    i += 2;
    const rows = [];
    while (i < lines.length && lines[i].trim().startsWith("|")) {
      const cells = splitPipeRow(lines[i]);
      if (cells.length >= 1) rows.push(cells);
      i++;
    }
    i--;
    tables.push({ headers, rows });
  }
  return tables;
}

function parseNum(s) {
  if (s == null) return NaN;
  let t = String(s).replace(/[^\d.,\-]/g, "").replace(/\s/g, "");
  if (!t) return NaN;
  if (t.includes(",") && t.includes(".")) {
    if (t.lastIndexOf(",") > t.lastIndexOf("."))
      t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(/,/g, "");
  } else if (t.includes(",")) t = t.replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

function parsePct(s) {
  if (s == null) return NaN;
  const m = String(stripMarkdown(s)).match(/([\d.,]+)\s*%/);
  if (m) return parseNum(m[1]);
  return parseNum(stripMarkdown(s));
}

/** BRL / volume cells: supports R$ 473M, 12,5 mi, milhões, MM, bilhões */
function parseMoneyCell(s) {
  const raw = stripMarkdown(s).trim();
  if (!raw) return NaN;
  const lower = raw.toLowerCase().replace(/\s+/g, " ");
  let mult = 1;
  if (
    /\b(mm|milh(ões|oes|ao)|mi\b)/i.test(lower) ||
    /\d[.,]?\d*\s*m\s*$/i.test(raw.trim()) ||
    /\d[.,]?\d*m\s*$/i.test(raw.replace(/\s/g, ""))
  ) {
    mult = 1e6;
  } else if (/\b(bilh(ões|oes|ao)|bi\b)/i.test(lower)) {
    mult = 1e9;
  } else if (/\b(k|mil)\b/i.test(lower) && /[\d.,]{2,}/.test(raw)) {
    mult = 1e3;
  }
  const n = parseNum(raw);
  if (!Number.isFinite(n)) return NaN;
  return mult !== 1 ? n * mult : n;
}

/** Approval rate axis: 0–100; treat decimals 0–1 as fractions */
function normalizePctValue(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  if (x > 0 && x <= 1) return x * 100;
  return x;
}

function approvalRateColScore(name) {
  const c = stripMarkdown(name).toLowerCase();
  if (/^aprovadas$/i.test(c.trim())) return 0;
  if (/transa(c(ões|oes))?$/i.test(c) && !/taxa/i.test(c)) return 0;
  if (/taxa.*aprov|aprov.*%|taxa.*%/i.test(c)) return 12;
  if (/%.*aprov|aprov.*rate|approval.*rate/i.test(c)) return 11;
  if (/\btaxa\b/.test(c) && /aprov|approval/.test(c)) return 10;
  if (/\brate\b/.test(c) && /%|aprov|approval/.test(c)) return 9;
  if (/%/.test(c) && /aprov|approval/.test(c)) return 8;
  if (/^taxa$/i.test(c.trim())) return 3;
  if (/aprov|approval/.test(c) && !/^aprovadas$/i.test(c.trim())) return 2;
  return -1;
}

function findApprovalRateCol(headers) {
  const cleaned = headers.map((x) => stripMarkdown(x || ""));
  let best = -1;
  let score = -99;
  for (let i = 0; i < cleaned.length; i++) {
    const s = approvalRateColScore(cleaned[i]);
    if (s > score) {
      score = s;
      best = i;
    }
  }
  if (score >= 8) return best;
  const h = cleaned.map((c) => c.toLowerCase());
  for (let i = 0; i < h.length; i++) {
    const c = h[i];
    if (/^aprovadas$|^approved$/i.test(c.trim())) continue;
    if (/\b(taxa|rate)\b/.test(c) && /aprov|approval|%/.test(c)) return i;
  }
  for (let i = 0; i < h.length; i++) {
    const c = h[i];
    if (/^aprovadas$/i.test(c.trim())) continue;
    if (/taxa|aprov\.|approval.*rate|rate.*approval/i.test(c)) return i;
  }
  return findCol(headers, [(c) => /approval|aprov|taxa/i.test(c)]);
}

function declineVolumeColScore(name) {
  const c = stripMarkdown(name).toLowerCase();
  if (/^total$/i.test(c.trim())) return -5;
  if (/%/.test(c) && !/volume|brl|perd|lost|estim/.test(c)) return -3;
  if (/volume.*perdid|perdid.*est|vol\.\s*perd|lost.*vol|estim.*perd/i.test(c))
    return 12;
  if (/volume.*brl|brl.*volume/i.test(c) && /perd|lost|estim/i.test(c)) return 11;
  if (/volume.*estim|estimad.*brl/i.test(c)) return 9;
  if (/lost.*volume/i.test(c)) return 9;
  if (/perdid|perdido/i.test(c) && /volume|brl|estim/i.test(c)) return 8;
  if (/brl/i.test(c) && /estim|perd|lost/i.test(c)) return 7;
  if (/volume/i.test(c) && !/(total|aprovado|process)/i.test(c)) return 4;
  return -1;
}

function findDeclineLostVolumeCol(headers) {
  let best = -1;
  let score = -99;
  for (let i = 0; i < headers.length; i++) {
    const s = declineVolumeColScore(headers[i] || "");
    if (s > score) {
      score = s;
      best = i;
    }
  }
  return score >= 4 ? best : -1;
}

function headerLower(h) {
  return h.map((c) => stripMarkdown(c).toLowerCase());
}

function findCol(headers, tests) {
  const h = headerLower(headers);
  for (let i = 0; i < h.length; i++) {
    if (tests.every((fn) => fn(h[i]))) return i;
  }
  return -1;
}

function isMonthlyTable(headers) {
  const h = headerLower(headers).join(" | ");
  return (
    /month|mês|mes/i.test(h) &&
    (/volume|brl|tpv|valor/i.test(h) || /transact/i.test(h)) &&
    /approval|aprov|taxa/i.test(h)
  );
}

function isDeclineTable(headers) {
  const h = headerLower(headers).join(" | ");
  return (
    /decline|rejei|recus|negad/i.test(h) &&
    (/code|código/i.test(h) || /total/i.test(h)) &&
    (/lost|perd|estim|volume|brl/i.test(h) || /%/i.test(h))
  );
}

/**
 * @param {string} md
 */
function extractChartDataFromMarkdown(md) {
  const tables = parseMarkdownTables(md);
  let monthly = null;
  let declines = null;
  /** @type {{ code: string; volume: number; tone: string }[]} */
  let declineRowsAll = [];

  for (const t of tables) {
    if (!monthly && isMonthlyTable(t.headers)) {
      const h = t.headers;
      const mi =
        findCol(h, [(c) => /month|mês|mes/i.test(stripMarkdown(c))]) >= 0
          ? findCol(h, [(c) => /month|mês|mes/i.test(stripMarkdown(c))])
          : 0;
      const vi = findCol(h, [
        (c) =>
          /volume|brl|tpv|valor/i.test(stripMarkdown(c)) &&
          !/lost|perd|declin/i.test(stripMarkdown(c)),
      ]);
      const ai = findApprovalRateCol(h);

      if (vi >= 0 && ai >= 0) {
        const months = [];
        const tpv = [];
        const approvalPct = [];
        for (const row of t.rows) {
          if (row.length < Math.max(mi, vi, ai) + 1) continue;
          const m = stripMarkdown(row[mi] || "");
          const v = parseMoneyCell(row[vi]);
          const a = normalizePctValue(parsePct(row[ai]));
          if (!m || (!Number.isFinite(v) && !Number.isFinite(a))) continue;
          months.push(m.trim());
          tpv.push(Number.isFinite(v) ? v : 0);
          const pct = Number.isFinite(a)
            ? Math.min(100, Math.max(0, a))
            : 0;
          approvalPct.push(pct);
        }
        if (months.length >= 2) monthly = { months, tpv, approvalPct };
      }
    }

    if (!declines && isDeclineTable(t.headers)) {
      const h = t.headers;
      let codeIdx = findCol(h, [
        (c) => /decline.*code|code.*decline|código/i.test(stripMarkdown(c)),
      ]);
      if (codeIdx < 0)
        codeIdx = findCol(h, [(c) => /^code$/i.test(stripMarkdown(c).trim())]);
      if (codeIdx < 0) codeIdx = 0;

      const vi = findDeclineLostVolumeCol(h);
      const viFallback = findCol(h, [
        (c) =>
          /lost|perd|estim|volume|brl/i.test(stripMarkdown(c)) &&
          !/% of total/i.test(stripMarkdown(c)),
      ]);
      const volIdx = vi >= 0 ? vi : viFallback;

      const ti = findCol(h, [
        (c) =>
          /^type$|tipo|classif|soft|hard|operac/i.test(stripMarkdown(c)),
      ]);

      if (codeIdx >= 0 && volIdx >= 0) {
        const items = [];
        for (const row of t.rows) {
          if (row.length <= Math.max(codeIdx, volIdx)) continue;
          const code = stripMarkdown(row[codeIdx] || "").trim();
          const vol = parseMoneyCell(row[volIdx]);
          const typeStr =
            ti >= 0
              ? stripMarkdown(row[ti] || "").toLowerCase()
              : "";
          if (!code || !Number.isFinite(vol) || vol <= 0) continue;
          let tone = "operational";
          if (/soft|recuper/i.test(typeStr)) tone = "soft";
          else if (/hard|não recuper|nao recuper|irrecuper/i.test(typeStr))
            tone = "hard";
          else if (/operac|integrat|config|infra/i.test(typeStr))
            tone = "operational";
          items.push({ code, volume: vol, tone });
        }
        items.sort((a, b) => b.volume - a.volume);
        const top = items.slice(0, 5);
        if (top.length > 0) {
          declineRowsAll = items;
          declines = {
            codes: top.map((x) => x.code),
            volumes: top.map((x) => x.volume),
            tones: top.map((x) => x.tone),
          };
        }
      }
    }
  }

  let impact = null;
  if (declineRowsAll.length > 0) {
    const all = declineRowsAll;
    const total = all.reduce((acc, x) => acc + x.volume, 0);
    let maxItem = all[0];
    for (let i = 1; i < all.length; i++) {
      if (all[i].volume > maxItem.volume) maxItem = all[i];
    }
    impact = {
      totalDeclinedBrl: total,
      topCode: maxItem.code,
      topBrl: maxItem.volume,
    };
  }

  return { monthly, declines, impact };
}

function buildChartsSectionHtml(boot) {
  const hasAny =
    boot.impact ||
    (boot.monthly &&
      boot.monthly.months?.length) ||
    (boot.declines && boot.declines.codes?.length);
  if (!hasAny) return "";

  let html = '<div class="charts-dashboard">';

  if (boot.impact && boot.impact.totalDeclinedBrl > 0) {
    const total = formatBrlMillions(boot.impact.totalDeclinedBrl);
    const top = formatBrlMillions(boot.impact.topBrl);
    const code = escHtml(stripMarkdown(boot.impact.topCode || "—"));
    html += `
    <div class="impact-card" style="page-break-inside: avoid;">
      <div class="impact-card__title">Impacto financeiro (estimado)</div>
      <div class="impact-card__metric">Volume recusado (soma da tabela de rejeições)</div>
      <div class="impact-card__value">${escHtml(total)}</div>
      <div class="impact-card__sub">Maior oportunidade de recuperação</div>
      <div class="impact-card__opp"><strong>${code}</strong> — ${escHtml(top)}</div>
    </div>`;
  }

  if (boot.monthly && boot.monthly.months.length >= 2) {
    html += `
    <div class="chart-block" style="page-break-inside: avoid;">
      <h3 class="chart-title">TPV mensal (volume processado)</h3>
      <div class="chart-canvas-wrap chart-canvas-wrap--tall">
        <canvas id="chartTpv"></canvas>
      </div>
    </div>
    <div class="chart-block" style="page-break-inside: avoid;">
      <h3 class="chart-title">Taxa de aprovação por mês vs benchmark (70%)</h3>
      <div class="chart-canvas-wrap chart-canvas-wrap--tall">
        <canvas id="chartApproval"></canvas>
      </div>
    </div>`;
  }

  if (boot.declines && boot.declines.codes.length > 0) {
    html += `
    <div class="chart-block chart-block--horizontal" style="page-break-inside: avoid;">
      <h3 class="chart-title">Top 5 decline codes por volume de perda</h3>
      <div class="chart-canvas-wrap chart-canvas-wrap--short">
        <canvas id="chartDeclines"></canvas>
      </div>
    </div>`;
  }

  html += "</div>";
  return html;
}

function formatBrl(n) {
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `R$ ${n.toFixed(0)}`;
  }
}

/** Impact card: express BRL in millions, pt-BR grouping/decimals */
function formatBrlMillions(n) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const mi = n / 1e6;
  const fmt = mi.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `R$ ${fmt} mi`;
}

/** 6×6 halftone dots; element at (0,0) is the first dot; rest via box-shadow */
function halftoneBoxShadowExtraDots(
  step = 11,
  n = 6,
  color = "rgba(255,255,255,0.15)"
) {
  const parts = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (r === 0 && c === 0) continue;
      parts.push(`${c * step}px ${r * step}px 0 ${color}`);
    }
  }
  return parts.join(", ");
}

/** Alternating section backgrounds: wrap each H2 block (and leading content) */
function wrapContentSections(markdownHtml) {
  const s = String(markdownHtml || "").trim();
  if (!s) return "";
  const chunks = s.split(/(?=<h2\b[^>]*>)/i).filter((p) => p.length > 0);
  return chunks
    .map((chunk) => `<div class="content-section">${chunk}</div>`)
    .join("");
}

function buildHtmlDocument(markdownHtml, partnerName, period, chartBoot) {
  const pName = escHtml(partnerName || "Partner");
  const pPeriod = escHtml(period || "—");
  const chartsHtml = buildChartsSectionHtml(chartBoot);
  const bootJson = JSON.stringify(chartBoot).replace(/</g, "\\u003c");
  const sectionedContent = wrapContentSections(markdownHtml);
  const halftoneShadow = halftoneBoxShadowExtraDots(11, 6);

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
      font-weight: 400;
      line-height: 1.55;
    }
    .page-wrap { min-height: 100vh; display: flex; flex-direction: column; }
    .header {
      position: relative;
      overflow: hidden;
      width: 100%;
      background: linear-gradient(135deg, #3E4FE0 0%, #1726A6 100%);
      color: #ffffff;
      padding: 28px 56px 36px;
    }
    .header-halftone {
      position: absolute;
      top: 26px;
      right: 52px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      box-shadow: ${halftoneShadow};
      pointer-events: none;
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
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.92);
      text-align: right;
      max-width: 55%;
    }
    .header-main-title {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
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
    .charts-dashboard {
      padding: 32px 56px 8px;
      background: #ffffff;
    }
    .impact-card {
      background: #282A30;
      color: #ffffff;
      border-radius: 12px;
      padding: 24px 28px;
      margin-bottom: 28px;
      box-shadow: 0 8px 24px rgba(40, 42, 48, 0.35);
    }
    .impact-card__title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #E0ED80;
      margin-bottom: 12px;
    }
    .impact-card__metric { font-size: 13px; opacity: 0.9; margin-bottom: 4px; }
    .impact-card__value { font-size: 28px; font-weight: 700; margin-bottom: 16px; }
    .impact-card__sub { font-size: 12px; opacity: 0.85; margin-bottom: 4px; }
    .impact-card__opp { font-size: 15px; font-weight: 600; }
    .chart-block {
      margin-bottom: 28px;
      padding: 20px 22px;
      border: 1px solid #E8EAF5;
      border-left: 3px solid #788CFF;
      border-radius: 12px;
      background: #ffffff;
    }
    .chart-title {
      font-family: "Titillium Web", system-ui, sans-serif;
      margin: 0 0 14px 0;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #92959B;
    }
    .chart-canvas-wrap {
      position: relative;
      width: 100%;
    }
    .chart-canvas-wrap--tall { height: 280px; }
    .chart-canvas-wrap--short { height: 220px; }
    .chart-canvas-wrap canvas {
      width: 100% !important;
      height: 100% !important;
      max-height: 280px;
    }
    .chart-block--horizontal .chart-canvas-wrap canvas {
      max-height: 220px;
    }
    .content {
      flex: 1;
      padding: 0 56px;
    }
    .content-section {
      margin: 0 -56px;
      padding: 32px 56px;
    }
    .content-section:first-child { padding-top: 48px; }
    .content-section:last-child { padding-bottom: 48px; }
    .content-section:nth-child(odd) { background: #ffffff; }
    .content-section:nth-child(even) { background: #E8EAF5; }
    .content-section :first-child { margin-top: 0; }
    .content h1 {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #1726A6;
      margin: 0 0 20px 0;
      line-height: 1.25;
    }
    .content h2 {
      position: relative;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #282A30;
      margin: 36px 0 14px 0;
      padding-bottom: 0;
      padding-left: 16px;
      border-left: 4px solid #E0ED80;
      border-bottom: none;
    }
    .content h3 {
      font-size: 15px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.14em;
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
      border: 1px solid #E8EAF5;
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
      border: 1px solid #E8EAF5;
    }
    .content tbody td {
      padding: 10px 14px;
      border: 1px solid #E8EAF5;
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
      position: relative;
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
    .footer-left {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .footer-halftone {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(255,255,255,0.15);
      box-shadow: ${halftoneShadow};
      flex-shrink: 0;
    }
    .footer span { color: #ffffff; }
    .footer a { color: #E0ED80; text-decoration: none; }
    .secondary { color: #92959B; font-size: 12px; }
  </style>
</head>
<body>
  <div class="page-wrap">
    <header class="header">
      <div class="header-halftone" aria-hidden="true"></div>
      <div class="header-top">
        <div class="wordmark">yuno</div>
        <div class="report-label">Partner Performance Report</div>
      </div>
      <h1 class="header-main-title">${pName}</h1>
      <p class="header-period">${pPeriod}</p>
    </header>
    ${chartsHtml}
    <main class="content">
      ${sectionedContent}
    </main>
    <footer class="footer">
      <div class="footer-left">
        <div class="footer-halftone" aria-hidden="true"></div>
        <span>yuno</span>
      </div>
      <a href="https://www.y.uno">www.y.uno</a>
    </footer>
  </div>
  <script src="${CHART_CDN}"></script>
  <script>
(function () {
  function done() {
    window.__CHARTS_READY__ = true;
  }
  try {
    var boot = ${bootJson};
    if (typeof Chart !== "undefined") {
    var yunoBlue = "#3E4FE0";
    var yunoBlueFill = "rgba(62, 79, 224, 0.15)";
    var unityBlack = "#282A30";
    var innovation = "#E0ED80";
    var securityGray = "#92959B";
    var lightBlue = "#788CFF";
    var benchmark = 70;
    var chartFont = {
      family: "'Titillium Web', system-ui, sans-serif",
      size: 11,
      weight: "600",
    };
    var axisTicks = { color: "#282A30", font: chartFont };

    if (boot.monthly && boot.monthly.months && boot.monthly.months.length >= 2) {
      var el = document.getElementById("chartTpv");
      if (el) {
        new Chart(el, {
          type: "line",
          data: {
            labels: boot.monthly.months,
            datasets: [
              {
                label: "TPV (BRL)",
                data: boot.monthly.tpv.map(function (x) {
                  var n = parseFloat(x);
                  return isFinite(n) ? n : 0;
                }),
                borderColor: yunoBlue,
                backgroundColor: yunoBlueFill,
                fill: true,
                tension: 0.25,
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true, labels: { font: chartFont } },
            },
            scales: {
              y: { beginAtZero: true, ticks: axisTicks },
              x: { ticks: axisTicks },
            },
          },
        });
      }

      var el2 = document.getElementById("chartApproval");
      if (el2) {
        var rates = boot.monthly.approvalPct.map(function (x) {
          var n = parseFloat(x);
          if (!isFinite(n)) return 0;
          if (n > 0 && n <= 1) n = n * 100;
          return Math.min(100, Math.max(0, n));
        });
        var barColors = rates.map(function (v) {
          if (v < 60) return unityBlack;
          if (v > benchmark) return innovation;
          return yunoBlue;
        });
        new Chart(el2, {
          type: "bar",
          data: {
            labels: boot.monthly.months,
            datasets: [
              {
                type: "bar",
                label: "Approval rate %",
                data: rates,
                backgroundColor: barColors,
                borderWidth: 0,
                order: 2,
                yAxisID: "y",
              },
              {
                type: "line",
                label: "Benchmark 70%",
                data: rates.map(function () {
                  return benchmark;
                }),
                borderColor: innovation,
                borderDash: [6, 6],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                order: 1,
                yAxisID: "y",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true, labels: { font: chartFont } },
            },
            scales: {
              y: {
                type: "linear",
                min: 0,
                max: 100,
                beginAtZero: true,
                ticks: axisTicks,
              },
              x: { ticks: axisTicks },
            },
          },
        });
      }
    }

    if (boot.declines && boot.declines.codes && boot.declines.codes.length) {
      var el3 = document.getElementById("chartDeclines");
      if (el3) {
        var bg = boot.declines.tones.map(function (t) {
          if (t === "soft") return lightBlue;
          if (t === "hard") return unityBlack;
          return securityGray;
        });
        new Chart(el3, {
          type: "bar",
          data: {
            labels: boot.declines.codes,
            datasets: [
              {
                label: "Volume perdido (BRL)",
                data: boot.declines.volumes.map(function (x) {
                  var n = parseFloat(x);
                  return isFinite(n) ? n : 0;
                }),
                backgroundColor: bg,
                borderWidth: 0,
              },
            ],
          },
          options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { beginAtZero: true, ticks: axisTicks },
              y: { ticks: axisTicks },
            },
          },
        });
      }
    }
    }
  } catch (e) {
    console.error(e);
  } finally {
    requestAnimationFrame(function () {
      setTimeout(done, 80);
    });
  }
})();
  </script>
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
  const md = String(text || "");
  const markdownHtml = marked.parse(md);
  const chartBoot = extractChartDataFromMarkdown(md);
  const html = buildHtmlDocument(markdownHtml, partnerName, period, chartBoot);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 10000,
    });
    await page.waitForFunction(() => window.__CHARTS_READY__ === true, {
      timeout: 10000,
    });
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
