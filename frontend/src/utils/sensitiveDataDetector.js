/**
 * Padrões de dados sensíveis no texto do relatório.
 * Cada pattern deve ter flag `g` para varredura global.
 */
export const SENSITIVE_PATTERNS = [
  {
    type: "financial",
    pattern: /R\$\s*[\d.,]+[MB]/gi,
    label: "Valor financeiro",
  },
  {
    type: "financial_plain",
    pattern: /R\$\s*[\d]{1,3}(?:\.\d{3})*(?:,\d+)?/g,
    label: "Valor financeiro",
  },
  {
    type: "merchant",
    pattern:
      /\b(Payt|JetSmart|Livelo|Petrobras|Rappi|Raízen|Raizen|BigBox)\b/gi,
    label: "Nome de merchant",
  },
  {
    type: "internal_url",
    pattern: /internal-prod\.y\.uno[^\s]*/gi,
    label: "URL interna",
  },
  {
    type: "connection_id",
    pattern:
      /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi,
    label: "ID interno",
  },
  {
    type: "ticket_id",
    pattern: /\b(YSHUB|PRIOR|OR)-\d+\b/gi,
    label: "Ticket Jira",
  },
];

/** Mapeia tipo financeiro_plain para financial nos placeholders */
export function normalizeMatchType(type) {
  if (type === "financial_plain") return "financial";
  return type;
}

const SECTION_LABELS = {
  nextSteps: "Próximos Passos",
  issues: "Issues",
  merchants: "Merchants",
  declines: "Rejeições",
  executiveSummary: "Resumo executivo",
  kpis: "KPIs (PDF)",
  top3: "Oportunidades",
};

function collectMatches(text) {
  if (typeof text !== "string" || !text.trim()) return [];
  const all = [];
  for (const { type, pattern, label } of SENSITIVE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let m;
    while ((m = re.exec(text)) !== null) {
      const t = normalizeMatchType(type);
      all.push({
        type: t,
        label,
        value: m[0],
        startIndex: m.index,
        endIndex: m.index + m[0].length,
      });
    }
  }
  all.sort((a, b) => a.startIndex - b.startIndex);
  return mergeOverlappingMatches(all);
}

/** Mantém o primeiro match quando há sobreposição. */
function mergeOverlappingMatches(sorted) {
  const out = [];
  let lastEnd = -1;
  for (const m of sorted) {
    if (m.startIndex >= lastEnd) {
      out.push(m);
      lastEnd = m.endIndex;
    }
  }
  return out;
}

function pushBlock(blocks, section, sectionLabel, field, originalValue) {
  const sensitiveMatches = collectMatches(originalValue);
  if (sensitiveMatches.length === 0) return;
  blocks.push({
    id: `${section}:${field}:${blocks.length}:${hashSnippet(originalValue)}`,
    section,
    sectionLabel,
    field,
    originalValue,
    sensitiveMatches,
    status: "pending",
    anonymizedValue: null,
  });
}

function hashSnippet(s) {
  let h = 0;
  const str = String(s).slice(0, 80);
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

function scanObjectStrings(obj, section, sectionLabel, fieldPrefix, blocks, depth = 0) {
  if (depth > 8 || obj == null) return;
  if (typeof obj === "string") {
    pushBlock(blocks, section, sectionLabel, fieldPrefix, obj);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      scanObjectStrings(item, section, sectionLabel, `${fieldPrefix}[${i}]`, blocks, depth + 1);
    });
    return;
  }
  if (typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string") {
        pushBlock(blocks, section, sectionLabel, `${fieldPrefix}.${k}`, v);
      } else if (v != null && typeof v === "object") {
        scanObjectStrings(v, section, sectionLabel, `${fieldPrefix}.${k}`, blocks, depth + 1);
      }
    }
  }
}

/**
 * Varre o report e devolve blocos com texto sensível detectado.
 * @param {object} report
 * @returns {Array<{
 *   id: string,
 *   section: string,
 *   sectionLabel: string,
 *   field: string,
 *   originalValue: string,
 *   sensitiveMatches: Array<{type: string, label: string, value: string, startIndex: number, endIndex: number}>,
 *   status: 'pending'|'approved'|'anonymized',
 *   anonymizedValue: string|null
 * }>}
 */
export function detectSensitiveData(report) {
  if (!report || typeof report !== "object") return [];
  const blocks = [];

  const exec = Array.isArray(report.executiveSummary) ? report.executiveSummary : [];
  exec.forEach((row, i) => {
    ["label", "value", "context"].forEach((k) => {
      const v = row?.[k];
      if (typeof v === "string") {
        pushBlock(
          blocks,
          "executiveSummary",
          SECTION_LABELS.executiveSummary,
          `${i}.${k}`,
          v
        );
      }
    });
  });

  const steps = Array.isArray(report.nextSteps) ? report.nextSteps : [];
  steps.forEach((s, i) => {
    ["action", "description", "owner", "deadline", "expectedImpact"].forEach((k) => {
      const v = s?.[k];
      if (typeof v === "string") {
        pushBlock(blocks, "nextSteps", SECTION_LABELS.nextSteps, `${i}.${k}`, v);
      }
    });
  });

  const merch = report.merchants && typeof report.merchants === "object" ? report.merchants : {};
  (Array.isArray(merch.highlights) ? merch.highlights : []).forEach((m, i) => {
    scanObjectStrings(m, "merchants", SECTION_LABELS.merchants, `highlights[${i}]`, blocks);
  });
  (Array.isArray(merch.alerts) ? merch.alerts : []).forEach((m, i) => {
    scanObjectStrings(m, "merchants", SECTION_LABELS.merchants, `alerts[${i}]`, blocks);
  });

  (Array.isArray(report.declineCodes) ? report.declineCodes : []).forEach((d, i) => {
    ["code", "total", "estimatedLostVolume", "action"].forEach((k) => {
      const v = d?.[k];
      if (typeof v === "string") {
        pushBlock(blocks, "declines", SECTION_LABELS.declines, `${i}.${k}`, v);
      }
    });
  });

  const ia = report.issuesAnalysis && typeof report.issuesAnalysis === "object" ? report.issuesAnalysis : {};
  if (typeof ia.summary === "string") {
    pushBlock(blocks, "issues", SECTION_LABELS.issues, "issuesAnalysis.summary", ia.summary);
  }
  if (typeof ia.connectionToMetrics === "string") {
    pushBlock(
      blocks,
      "issues",
      SECTION_LABELS.issues,
      "issuesAnalysis.connectionToMetrics",
      ia.connectionToMetrics
    );
  }
  (Array.isArray(ia.criticalOpen) ? ia.criticalOpen : []).forEach((row, i) => {
    ["ticket", "problem", "impact", "suggestedAction"].forEach((k) => {
      const v = row?.[k];
      if (typeof v === "string") {
        pushBlock(blocks, "issues", SECTION_LABELS.issues, `criticalOpen[${i}].${k}`, v);
      }
    });
  });

  const idata = report.issuesData && typeof report.issuesData === "object" ? report.issuesData : null;
  if (idata) {
    [...(idata.openTickets || []), ...(idata.closedTickets || [])].forEach((t, i) => {
      ["ticket", "status", "problem", "impact", "merchant", "category"].forEach((k) => {
        const v = t?.[k];
        if (typeof v === "string") {
          pushBlock(blocks, "issues", SECTION_LABELS.issues, `issuesData.ticket[${i}].${k}`, v);
        }
      });
    });
  }

  const k = report.kpis && typeof report.kpis === "object" ? report.kpis : {};
  [
    "totalTPV",
    "totalTransactions",
    "approvalRate",
    "declinedVolume",
    "tpvGrowth",
    "topOpportunity",
  ].forEach((key) => {
    const v = k[key];
    if (typeof v === "string") {
      pushBlock(blocks, "kpis", SECTION_LABELS.kpis, key, v);
    }
  });

  (Array.isArray(report.top3Opportunities) ? report.top3Opportunities : []).forEach(
    (o, i) => {
      [
        "lostVolume",
        "lost_volume",
        "whatIsHappening",
        "suggestedAction",
        "estimatedRecovery",
      ].forEach((key) => {
        const v = o?.[key];
        if (typeof v === "string") {
          pushBlock(blocks, "top3", SECTION_LABELS.top3, `${i}.${key}`, v);
        }
      });
    }
  );

  return blocks;
}
