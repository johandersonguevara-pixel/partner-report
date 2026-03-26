const PRIORITY_ORDER = { Highest: 0, High: 1, Medium: 2, Low: 3 };

function toNumber(v) {
  if (v == null || v === "") return 0;
  const s = String(v).trim().replace(/\s/g, "");
  if (!s) return 0;
  if (s.includes(",") && !s.includes(".")) {
    return parseFloat(s.replace(",", ".")) || 0;
  }
  return parseFloat(s.replace(/,/g, "")) || 0;
}

function formatBRL(n) {
  const num = toNumber(n);
  if (num >= 1e9) return `R$ ${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `R$ ${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `R$ ${(num / 1e3).toFixed(1)}K`;
  return `R$ ${num.toFixed(0)}`;
}

function formatNum(n) {
  const num = parseInt(String(n ?? "").replace(/\D/g, ""), 10) || toNumber(n);
  const x = Math.round(num);
  if (x >= 1e6) return `${(x / 1e6).toFixed(1)}M`;
  if (x >= 1e3) return `${(x / 1e3).toFixed(0)}K`;
  return String(x);
}

function getMethodStatus(method, rate) {
  const m = String(method || "").toUpperCase();
  const benchmarks = {
    CARD: 70,
    CREDIT: 70,
    DEBIT: 40,
    PIX: 75,
    BOLETO: 38,
    MERCADO_PAGO_WALLET: 55,
    CLICK_TO_PAY: 65,
    WALLET: 55,
  };
  let bench = 65;
  for (const [k, v] of Object.entries(benchmarks)) {
    if (m.includes(k)) {
      bench = v;
      break;
    }
  }
  if (rate >= bench) return "healthy";
  if (rate >= bench * 0.9) return "attention";
  return "critical";
}

function classifyDeclineCode(code) {
  const c = String(code ?? "").trim().toUpperCase();
  const soft = [
    "INSUFFICIENT_FUNDS",
    "CALL_FOR_AUTHORIZE",
    "DO_NOT_HONOR",
    "AUTHENTICATION_FAILED_THREE_D_SECURE",
  ];
  const hard = ["FRAUD_VALIDATION", "DISABLED", "USER_RESTRICTION"];
  if (soft.includes(c)) return "soft";
  if (hard.includes(c)) return "hard";
  return "operational";
}

/**
 * @param {{ yunoParsed: object, partnerName: string, period: string, claudeJson: object }} opts
 */
function buildReportFromYunoCsv({ yunoParsed, partnerName, period, claudeJson }) {
  const c =
    claudeJson && typeof claudeJson === "object" && !Array.isArray(claudeJson)
      ? claudeJson
      : {};

  const parsed = yunoParsed;
  const monthly = Array.isArray(parsed.monthlyPerformance)
    ? parsed.monthlyPerformance
    : [];

  const totalVolume = monthly.reduce(
    (s, r) => s + toNumber(r.volume_total_brl),
    0
  );
  const totalApprovedVolume = monthly.reduce(
    (s, r) => s + toNumber(r.volume_aprovado_brl),
    0
  );
  const totalTxns = monthly.reduce(
    (s, r) => s + (parseInt(r.total_txns, 10) || toNumber(r.total_txns)),
    0
  );
  const totalApproved = monthly.reduce(
    (s, r) => s + (parseInt(r.aprovadas, 10) || toNumber(r.aprovadas)),
    0
  );
  const totalDeclined = Math.max(0, totalTxns - totalApproved);
  const approvalRate =
    totalTxns > 0 ? ((totalApproved / totalTxns) * 100).toFixed(2) : "0";
  const declinedVolume = Math.max(0, totalVolume - totalApprovedVolume);

  const firstMonth = monthly[0];
  const lastMonth = monthly[monthly.length - 1];
  const fVol = toNumber(firstMonth?.volume_total_brl);
  const lVol = toNumber(lastMonth?.volume_total_brl);
  const tpvGrowth =
    firstMonth && lastMonth && fVol > 0
      ? `${(((lVol - fVol) / fVol) * 100).toFixed(0)}%`
      : null;

  const debitData = (parsed.cardTypeMonthly || []).filter(
    (r) => String(r.card_type || "").toUpperCase() === "DEBIT"
  );
  let debitApproval = null;
  if (debitData.length > 0) {
    const da = debitData.reduce((s, r) => s + (parseInt(r.aprovadas, 10) || 0), 0);
    const dt = debitData.reduce((s, r) => s + (parseInt(r.total_txns, 10) || 0), 0);
    if (dt > 0) debitApproval = ((da / dt) * 100).toFixed(1);
  }

  const totalDeclinedVolume = declinedVolume;
  const declineCodesFormatted = (parsed.declineCodes || [])
    .slice(0, 10)
    .map((d) => {
      const pct = toNumber(d.pct_rejeicoes);
      const totalInt = parseInt(String(d.total ?? "").replace(/\D/g, ""), 10) || 0;
      return {
        code: String(d.response_code ?? "").trim(),
        message: d.response_message ?? "",
        total: String(totalInt),
        pctOfDeclines: pct,
        estimatedLostVolume: formatBRL((pct / 100) * totalDeclinedVolume),
        type: classifyDeclineCode(d.response_code),
        action: d.response_message ?? "",
      };
    });

  const merchantsFormatted = (parsed.merchants || []).map((m) => {
    const orgName =
      m.organization_name ??
      m["Organization Name"] ??
      m.nome_organizacao ??
      m["Nome da organização"] ??
      m.merchant ??
      m.Merchant ??
      m.name ??
      "";
    return {
      name: String(orgName).trim(),
      organization_code:
        m.organization_code ?? m["Organization Code"] ?? m.codigo_organizacao ?? "",
      totalTxns:
        parseInt(m.total_txns, 10) ||
        toNumber(m.total_txns ?? m["Total txns"] ?? m.Total_txns),
      approved:
        parseInt(m.aprovadas, 10) ||
        toNumber(m.aprovadas ?? m.approved ?? m.Aprovadas),
      approvalRate: toNumber(
        m.taxa_aprovacao ?? m["Taxa aprovação"] ?? m.approval_rate
      ),
      volume: formatBRL(m.volume_brl ?? m["Volume BRL"] ?? m.volume_BRL),
      volumeRaw: toNumber(m.volume_brl ?? m["Volume BRL"] ?? m.volume_BRL),
      avgTicket: formatBRL(m.ticket_medio ?? m["Ticket médio"]),
      weighted_score: m.weighted_score,
    };
  });

  const paymentMethodsFormatted = (parsed.paymentMethods || []).map((m) => {
    const rate = toNumber(m.taxa_aprovacao);
    return {
      method: m.payment_method_type,
      totalTxns: parseInt(m.total_txns, 10) || toNumber(m.total_txns),
      approvalRate: rate,
      volume: formatBRL(m.volume_brl),
      avgTicket: formatBRL(m.ticket_medio),
      status: getMethodStatus(m.payment_method_type, rate),
    };
  });

  const cardBrandsFormatted = (parsed.cardBrands || []).slice(0, 6).map((b) => ({
    brand: b.card_brand,
    totalTxns: parseInt(b.total_txns, 10) || toNumber(b.total_txns),
    approvalRate: toNumber(b.taxa_aprovacao),
    volume: formatBRL(b.volume_brl),
  }));

  const monthlyPerformance = monthly.map((m) => ({
    month: m.mes,
    transactions: formatNum(m.total_txns),
    approved: formatNum(m.aprovadas),
    declined: formatNum(m.recusadas),
    approvalRate: toNumber(m.taxa_aprovacao),
    totalVolume: formatBRL(m.volume_total_brl),
    approvedVolume: formatBRL(m.volume_aprovado_brl),
    totalVolumeRaw: toNumber(m.volume_total_brl),
    total_txns: m.total_txns,
    aprovadas: m.aprovadas,
    recusadas: m.recusadas,
    taxa_aprovacao: m.taxa_aprovacao,
    volume_total_brl: m.volume_total_brl,
    volume_aprovado_brl: m.volume_aprovado_brl,
  }));

  return {
    partner: partnerName,
    period,
    language: "pt-BR",
    generatedAt: new Date().toISOString(),
    kpis: {
      totalTPV: formatBRL(totalVolume),
      totalTransactions: formatNum(totalTxns),
      approvalRate: `${approvalRate}%`,
      declinedVolume: formatBRL(declinedVolume),
      tpvGrowth: tpvGrowth ?? c.kpis?.tpvGrowth ?? "—",
      topOpportunity: c.kpis?.topOpportunity ?? "—",
      debitRate: debitApproval != null ? `${debitApproval}%` : null,
      merchantCount: String((parsed.merchants || []).length),
    },
    monthlyPerformance,
    paymentMethods: paymentMethodsFormatted,
    paymentMethodsMonthly: parsed.paymentMethodsMonthly || [],
    cardBrands: cardBrandsFormatted,
    cardTypeMonthly: parsed.cardTypeMonthly || [],
    merchants: {
      highlights: c.merchants?.highlights ?? [],
      alerts: c.merchants?.alerts ?? [],
    },
    merchantRanking: merchantsFormatted,
    merchantsMonthly: parsed.merchantsMonthly || [],
    declineCodes: declineCodesFormatted,
    declineEvolution: parsed.declineEvolution || [],
    executiveSummary: c.executiveSummary ?? [],
    trendAnalysis: c.trendAnalysis ?? "",
    top3Opportunities: c.top3Opportunities ?? [],
    growthOpportunities: c.growthOpportunities ?? [],
    nextSteps: c.nextSteps ?? [],
    issuesAnalysis: null,
    merchantInsights: {
      highlights: c.merchants?.highlights ?? [],
      alerts: c.merchants?.alerts ?? [],
    },
    declineInsights: c.declineInsights ?? [],
  };
}

/**
 * Next steps automáticos a partir de tickets Highest/High abertos.
 * @param {object | null} issuesData
 */
function buildAutoNextStepsFromIssues(issuesData) {
  if (!issuesData?.openTickets?.length) return [];
  const open = issuesData.openTickets.filter(
    (t) =>
      t.isOpen && (t.priority === "Highest" || t.priority === "High")
  );
  open.sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );
  return open.map((ticket) => ({
    priority: ticket.priority === "Highest" ? 1 : 2,
    action: `Resolver ${ticket.ticket}: ${ticket.problem}`,
    description: ticket.impact,
    owner: "Yuno Engineering + MP",
    deadline: ticket.priority === "Highest" ? "Imediato" : "Abr 2026",
    expectedImpact: ticket.impact,
    category: "tecnico",
  }));
}

function buildReportFallback(partnerName, period, err) {
  return {
    partner: partnerName || "Partner",
    period: period || "—",
    language: "pt-BR",
    generatedAt: new Date().toISOString(),
    kpis: {},
    monthlyPerformance: [],
    paymentMethods: [],
    merchants: { highlights: [], alerts: [] },
    declineCodes: [],
    nextSteps: [],
    executiveSummary: [],
    trendAnalysis: "",
    top3Opportunities: [],
    growthOpportunities: [],
    issuesAnalysis: null,
    issuesData: null,
    error: err?.message || String(err),
  };
}

/**
 * @param {{
 *   claudeJson: object,
 *   issuesData: object | null,
 *   yunoParsed?: object | null,
 *   partnerName?: string,
 *   period?: string
 * }} opts
 */
function buildReportCore({
  claudeJson,
  issuesData,
  yunoParsed = null,
  partnerName = "",
  period = "",
}) {
  let base;
  if (yunoParsed?.monthlyPerformance?.length) {
    base = buildReportFromYunoCsv({
      yunoParsed,
      partnerName,
      period,
      claudeJson,
    });
  } else {
    base =
      claudeJson && typeof claudeJson === "object" && !Array.isArray(claudeJson)
        ? { ...claudeJson }
        : {};
  }

  if (!base.merchants || typeof base.merchants !== "object") {
    base.merchants = { highlights: [], alerts: [] };
  }
  if (!Array.isArray(base.merchants.highlights)) {
    base.merchants.highlights = [];
  }
  if (!Array.isArray(base.merchants.alerts)) {
    base.merchants.alerts = [];
  }

  base.issuesData = issuesData ?? null;
  const iaRaw = base.issuesAnalysis ?? base.issues_analysis ?? null;
  delete base.issues_analysis;
  base.issuesAnalysis =
    issuesData?.totalTickets > 0 ? iaRaw : null;

  const auto = buildAutoNextStepsFromIssues(issuesData);
  const existing = Array.isArray(base.nextSteps) ? base.nextSteps : [];
  base.nextSteps = [...auto, ...existing];

  return base;
}

export function buildReport(opts) {
  try {
    return buildReportCore(opts);
  } catch (err) {
    console.error("BUILD REPORT ERROR:", err?.message, err?.stack);
    const fb = buildReportFallback(
      opts?.partnerName,
      opts?.period,
      err
    );
    fb.issuesData = opts?.issuesData ?? null;
    return fb;
  }
}
