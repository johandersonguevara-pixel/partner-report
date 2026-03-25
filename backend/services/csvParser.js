/**
 * CSV de issues Jira: separador `;`
 * Colunas: Ticket;Status;Categoria;Problema;Impacto;Merchant;Prioridade
 */

const KNOWN_CATEGORIES = [
  "Support Hub",
  "Integration Request",
  "Story",
  "Hot Feature",
];

const PRIORITY_KEYS = ["Highest", "High", "Medium", "Low"];

function emptyResult() {
  const byCategory = {};
  for (const c of KNOWN_CATEGORIES) byCategory[c] = [];
  byCategory.Outros = [];
  return {
    totalTickets: 0,
    openTickets: [],
    closedTickets: [],
    byPriority: {
      Highest: [],
      High: [],
      Medium: [],
      Low: [],
    },
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

/** Split por `;` respeitando aspas duplas. */
export function parseSemicolonLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  const s = String(line ?? "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === ";" && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeaderCell(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function normalizePriority(p) {
  const s = String(p ?? "")
    .trim()
    .toLowerCase();
  if (s === "highest") return "Highest";
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  if (s === "low") return "Low";
  return "Medium";
}

function priorityRank(p) {
  const i = PRIORITY_KEYS.indexOf(p);
  return i === -1 ? 99 : i;
}

function bucketCategory(cat) {
  const c = String(cat ?? "").trim();
  if (KNOWN_CATEGORIES.includes(c)) return c;
  return "Outros";
}

/**
 * @param {string} csvText
 * @returns {ReturnType<typeof emptyResult>}
 */
export function parseIssuesCSV(csvText) {
  const raw = String(csvText ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!raw) return emptyResult();

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return emptyResult();

  const headerCells = parseSemicolonLine(lines[0]).map(normalizeHeaderCell);
  const idx = {
    ticket: headerCells.findIndex((h) => /ticket/.test(h)),
    status: headerCells.findIndex((h) => /status/.test(h)),
    category: headerCells.findIndex((h) => /categor/.test(h)),
    problem: headerCells.findIndex((h) => /problema/.test(h)),
    impact: headerCells.findIndex((h) => /impacto/.test(h)),
    merchant: headerCells.findIndex((h) => /merchant/.test(h)),
    priority: headerCells.findIndex((h) => /prioridade/.test(h)),
  };

  const fallback = [0, 1, 2, 3, 4, 5, 6];
  const col = (name, i) => (idx[name] >= 0 ? idx[name] : fallback[i]);

  const byCategory = {};
  for (const c of KNOWN_CATEGORIES) byCategory[c] = [];
  byCategory.Outros = [];

  const byPriority = {
    Highest: [],
    High: [],
    Medium: [],
    Low: [],
  };

  const openTickets = [];
  const closedTickets = [];
  const merchantSet = new Set();

  for (let r = 1; r < lines.length; r++) {
    const cols = parseSemicolonLine(lines[r]);
    if (cols.length < 2) continue;

    const ticketId = cols[col("ticket", 0)] ?? "";
    const status = cols[col("status", 1)] ?? "";
    const categoryRaw = cols[col("category", 2)] ?? "";
    const problem = cols[col("problem", 3)] ?? "";
    const impact = cols[col("impact", 4)] ?? "";
    const merchant = cols[col("merchant", 5)] ?? "";
    const priority = normalizePriority(cols[col("priority", 6)]);

    const isOpen = String(status).toLowerCase().startsWith("aberto");
    const catBucket = bucketCategory(categoryRaw);

    const row = {
      ticket: ticketId || "—",
      status,
      isOpen,
      category: categoryRaw || "—",
      problem: problem || "—",
      impact: impact || "—",
      merchant: merchant || "—",
      priority,
    };

    if (merchant && merchant !== "—") merchantSet.add(merchant.trim());

    if (PRIORITY_KEYS.includes(priority)) {
      byPriority[priority].push(row);
    } else {
      byPriority.Medium.push(row);
    }

    if (!byCategory[catBucket]) byCategory[catBucket] = [];
    byCategory[catBucket].push(row);

    if (isOpen) openTickets.push(row);
    else closedTickets.push(row);
  }

  const totalOpen = openTickets.length;
  const totalClosed = closedTickets.length;
  const highestOpen = openTickets.filter((t) => t.priority === "Highest").length;
  const highOpen = openTickets.filter((t) => t.priority === "High").length;

  const openSorted = [...openTickets].sort(
    (a, b) => priorityRank(a.priority) - priorityRank(b.priority)
  );
  const topIssues = openSorted
    .slice(0, 3)
    .map((t) => t.problem || t.ticket)
    .filter(Boolean);

  return {
    totalTickets: openTickets.length + closedTickets.length,
    openTickets,
    closedTickets,
    byPriority,
    byCategory,
    merchantsAffected: [...merchantSet].sort(),
    summary: {
      totalOpen,
      totalClosed,
      highestOpen,
      highOpen,
      topIssues,
    },
  };
}
