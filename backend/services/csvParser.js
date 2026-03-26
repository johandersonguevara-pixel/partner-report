/**
 * CSV Yuno (pagamentos): vírgula, seções === SECAO: … ===
 * CSV Jira (issues): ponto-e-vírgula, header na linha 1
 */

const KNOWN_CATEGORIES = [
  "Support Hub",
  "Integration Request",
  "Story",
  "Hot Feature",
];

/**
 * @param {string} line
 * @param {string} [separator=',']
 * @returns {string[]}
 */
export function parseCSVLine(line, separator = ",") {
  const result = [];
  let current = "";
  let inQuotes = false;
  const s = String(line ?? "");
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (char === '"') {
      if (inQuotes && s[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const SKIP_SECTIONS = [
  "POR TIPO DE TRANSACAO",
  "BANDEIRA DE CARTAO (MENSAL)",
  "TOP 30 RESPOSTAS DO PROVEDOR",
];

/**
 * @param {string} text
 * @returns {{
 *   meta: object,
 *   monthlyPerformance: object[],
 *   paymentMethods: object[],
 *   paymentMethodsMonthly: object[],
 *   cardBrands: object[],
 *   cardTypeMonthly: object[],
 *   declineCodes: object[],
 *   declineEvolution: object[],
 *   merchants: object[],
 *   merchantsMonthly: object[]
 * }}
 */
export function parseYunoCSV(text) {
  const lines = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);

  const data = {
    meta: {},
    monthlyPerformance: [],
    paymentMethods: [],
    paymentMethodsMonthly: [],
    cardBrands: [],
    cardTypeMonthly: [],
    declineCodes: [],
    declineEvolution: [],
    merchants: [],
    merchantsMonthly: [],
  };

  let currentSection = null;
  let currentHeaders = null;
  let skipSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("=== SECAO:")) {
      const inner = line
        .replace(/^===\s*SECAO:\s*/i, "")
        .replace(/\s*===\s*$/i, "")
        .trim();
      currentSection = inner;
      currentHeaders = null;
      skipSection = SKIP_SECTIONS.some((s) => currentSection.includes(s));
      continue;
    }

    if (skipSection) continue;
    if (!currentSection) continue;

    if (!currentHeaders) {
      currentHeaders = parseCSVLine(line, ",");
      continue;
    }

    const values = parseCSVLine(line, ",");
    if (values.length < 2) continue;

    const obj = {};
    currentHeaders.forEach((h, i) => {
      const key = String(h ?? "").trim();
      if (key) obj[key] = values[i] ?? "";
    });

    if (currentSection.includes("VISAO GERAL MENSAL")) {
      data.monthlyPerformance.push(obj);
    } else if (currentSection.includes("METODO DE PAGAMENTO (MENSAL)")) {
      data.paymentMethodsMonthly.push(obj);
    } else if (currentSection.includes("METODO DE PAGAMENTO")) {
      data.paymentMethods.push(obj);
    } else if (currentSection.includes("BANDEIRA DE CARTAO (AGREGADO)")) {
      data.cardBrands.push(obj);
    } else if (currentSection.includes("TIPO DE CARTAO")) {
      data.cardTypeMonthly.push(obj);
    } else if (
      currentSection.includes("TOP 30 REJEICOES") ||
      currentSection.includes("REJEICOES (YUNO)")
    ) {
      data.declineCodes.push(obj);
    } else if (currentSection.includes("EVOLUCAO MENSAL")) {
      data.declineEvolution.push(obj);
    } else if (currentSection.includes("TOP MERCHANTS (AGREGADO)")) {
      data.merchants.push(obj);
    } else if (currentSection.includes("TOP 10 MERCHANTS")) {
      data.merchantsMonthly.push(obj);
    }
  }

  return data;
}

function normalizeJiraPriority(p) {
  const s = String(p ?? "")
    .trim()
    .toLowerCase();
  if (s === "highest") return "Highest";
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  if (s === "low") return "Low";
  return "Medium";
}

function bucketCategory(cat) {
  const c = String(cat ?? "").trim();
  if (KNOWN_CATEGORIES.includes(c)) return c;
  return "Outros";
}

/**
 * @param {string} csvText
 */
export function parseIssuesCSV(csvText) {
  const raw = String(csvText ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!raw) {
    return emptyIssuesResult();
  }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return emptyIssuesResult();
  }

  const headers = parseCSVLine(lines[0], ";").map((h) => h.trim());
  const tickets = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], ";");
    if (values.length < 2) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? "";
    });

    const status = row.Status ?? row.status ?? "";
    const priorityNorm = normalizeJiraPriority(
      row.Prioridade ?? row.prioridade ?? ""
    );

    const normalized = {
      ticket: row.Ticket ?? row.ticket ?? "—",
      status,
      isOpen: String(status).toLowerCase().startsWith("aberto"),
      category: row.Categoria ?? row.categoria ?? "—",
      problem: row.Problema ?? row.problema ?? "—",
      impact: row.Impacto ?? row.impacto ?? "—",
      merchant: row.Merchant ?? row.merchant ?? "—",
      priority: priorityNorm,
    };

    tickets.push(normalized);
  }

  const open = tickets.filter((t) => t.isOpen);
  const closed = tickets.filter((t) => !t.isOpen);

  const byPriority = {
    Highest: [],
    High: [],
    Medium: [],
    Low: [],
  };
  open.forEach((t) => {
    const bucket = byPriority[t.priority] ? t.priority : "Medium";
    byPriority[bucket].push(t);
  });

  const byCategory = {};
  for (const c of KNOWN_CATEGORIES) byCategory[c] = [];
  byCategory.Outros = [];
  tickets.forEach((t) => {
    const b = bucketCategory(t.category);
    if (!byCategory[b]) byCategory[b] = [];
    byCategory[b].push(t);
  });

  const merchantSet = new Set();
  tickets.forEach((t) => {
    if (t.merchant && t.merchant !== "—") merchantSet.add(t.merchant.trim());
  });

  const topIssues = [...byPriority.Highest, ...byPriority.High]
    .slice(0, 5)
    .map((t) => t.problem)
    .filter(Boolean);

  return {
    totalTickets: tickets.length,
    openTickets: open,
    closedTickets: closed,
    byPriority,
    byCategory,
    merchantsAffected: [...merchantSet].sort(),
    summary: {
      totalOpen: open.length,
      totalClosed: closed.length,
      highestOpen: byPriority.Highest.length,
      highOpen: byPriority.High.length,
      topIssues,
    },
  };
}

function emptyIssuesResult() {
  const byCategory = {};
  for (const c of KNOWN_CATEGORIES) byCategory[c] = [];
  byCategory.Outros = [];
  return {
    totalTickets: 0,
    openTickets: [],
    closedTickets: [],
    byPriority: { Highest: [], High: [], Medium: [], Low: [] },
    byCategory,
    merchantsAffected: [],
    summary: {
      totalOpen: 0,
      totalClosed: 0,
      highestOpen: 0,
      highOpen: 0,
      topIssues: [],
    },
  };
}
