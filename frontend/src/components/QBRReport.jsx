import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { detectSensitiveData } from "../utils/sensitiveDataDetector.js";
import { anonymizeBlock } from "../utils/anonymizer.js";
import "./QBRReport.css";

const Y = {
  blue: "#3E4FE0",
  darkBlue: "#1726A6",
  black: "#282A30",
  green: "#E0ED80",
  lilac: "#E8EAF5",
  gray: "#92959B",
  crit: "#E24B4A",
  ok: "#3E4FE0",
};

const SLIDE_LABELS = [
  "Visão Geral",
  "Performance",
  "Rejeições",
  "Issues",
  "Próximos Passos",
  "Encerramento",
];

function getApprovalBadgeClass(rate) {
  const r = Number(rate) || 0;
  if (r >= 70) return "qbr-badge qbr-badge-ok";
  if (r >= 65) return "qbr-badge qbr-badge-warn";
  return "qbr-badge qbr-badge-crit";
}

function getApprovalColor(rate) {
  const r = Number(rate) || 0;
  if (r >= 70) return "#1D9E75";
  if (r >= 65) return "#c07010";
  return "#E24B4A";
}

function getKpiTopColor(type, value) {
  if (type === "declined") return "#E24B4A";
  if (type === "approval") {
    const r = parseFloat(String(value).replace(/%/g, "").replace(",", ".")) || 0;
    if (r >= 70) return "#1D9E75";
    if (r >= 65) return "#c07010";
    return "#E24B4A";
  }
  return "#3E4FE0";
}

function getPriorityClass(p) {
  const n = Number(p) || 99;
  if (n <= 2) return "qbr-ns-p1";
  if (n <= 4) return "qbr-ns-p2";
  return "qbr-ns-p3";
}

function formatNum(n) {
  const num = parseInt(String(n).replace(/\D/g, ""), 10) || Number(n) || 0;
  const x = Math.round(num);
  if (x >= 1e6) return `${(x / 1e6).toFixed(1)}M`;
  if (x >= 1e3) return `${Math.round(x / 1e3)}K`;
  return x.toLocaleString("pt-BR");
}

function getIssueBadgeClass(priority) {
  const map = { Highest: "highest", High: "high", Medium: "medium", Low: "low" };
  return "qbr-badge qbr-badge-" + (map[priority] || "low");
}

function parsePctFromString(s) {
  if (s == null || s === "") return NaN;
  const m = String(s).match(/([\d.,]+)\s*%/);
  const raw = m ? m[1] : String(s).replace(/[^\d.,]/g, "");
  if (!raw) return NaN;
  let n = raw;
  if (n.includes(",") && n.includes(".")) {
    if (n.lastIndexOf(",") > n.lastIndexOf("."))
      n = n.replace(/\./g, "").replace(",", ".");
    else n = n.replace(/,/g, "");
  } else if (n.includes(",")) n = n.replace(",", ".");
  const v = parseFloat(n);
  return Number.isFinite(v) ? v : NaN;
}

function parsePctNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const p = parsePctFromString(v);
  return Number.isFinite(p) ? p : 0;
}

function resolveMerchantName(m) {
  if (!m || typeof m !== "object") return "";
  const x =
    m.name ??
    m.merchant ??
    m.Merchant ??
    m.organization_name ??
    m.nome_organizacao ??
    m.organizationName ??
    m["Organization Name"] ??
    m["Nome da organização"];
  return String(x ?? "").trim();
}

function parseMagnitudeRough(str) {
  if (str == null || str === "") return 0;
  const u = String(str).toUpperCase();
  let mult = 1;
  if (/\bM\b|MI|milh/i.test(u)) mult = 1e6;
  if (/\bB\b|bilh/i.test(u)) mult = 1e9;
  const m = String(str).replace(/[^\d.,]/g, " ").match(/[\d.,]+/);
  if (!m) return 0;
  let n = m[0];
  if (n.includes(",") && !n.includes(".")) n = n.replace(",", ".");
  else if (n.includes(",")) n = n.replace(/\./g, "").replace(",", ".");
  const v = parseFloat(n);
  return (Number.isFinite(v) ? v : 0) * mult;
}

function formatRecoverableLabel(total) {
  if (!total || total <= 0) return "~R$ — potencial";
  if (total >= 1e9) return `~R$ ${(total / 1e9).toFixed(1)}B potencial`;
  if (total >= 1e6) return `~R$ ${(total / 1e6).toFixed(0)}M potencial`;
  if (total >= 1e3) return `~R$ ${(total / 1e3).toFixed(0)}K potencial`;
  return `~R$ ${total.toFixed(0)} potencial`;
}

function declineBadgeType(t) {
  const x = String(t || "").toLowerCase();
  if (x.includes("soft")) return "soft";
  if (x.includes("hard")) return "hard";
  return "op";
}

function unwrapReportPayload(raw) {
  if (!raw || typeof raw !== "object") return {};
  if (raw.report && typeof raw.report === "object") return raw.report;
  if (raw.data && typeof raw.data === "object") return raw.data;
  return raw;
}

function normalizeKpis(raw) {
  const k = raw && typeof raw === "object" ? raw : {};
  return {
    totalTPV: k.totalTPV ?? k.total_tpv ?? k.Total_TPV,
    totalTransactions: k.totalTransactions ?? k.total_transactions,
    approvalRate: k.approvalRate ?? k.approval_rate,
    declinedVolume: k.declinedVolume ?? k.declined_volume,
    tpvGrowth: k.tpvGrowth ?? k.tpv_growth,
    topOpportunity: k.topOpportunity ?? k.top_opportunity,
    merchantCount: k.merchantCount ?? k.merchant_count ?? k.merchants_count,
  };
}

function halftoneBoxShadow(cols, rows, step = 9) {
  const parts = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue;
      parts.push(`${c * step}px ${r * step}px 0 rgba(255,255,255,0.15)`);
    }
  }
  return parts.join(", ");
}

function normalizeCategory(cat) {
  const x = String(cat || "").toLowerCase();
  if (x.includes("urg")) return "urgente";
  if (x.includes("tecn") || x.includes("tech")) return "tecnico";
  if (x.includes("comerc") || x.includes("commercial")) return "comercial";
  return x;
}

function priorityStyle(p) {
  const n = Number(p) || 99;
  if (n <= 2) return { bg: "#fef2f2", c: "#dc2626" };
  if (n <= 4) return { bg: "#fffbeb", c: "#d97706" };
  return { bg: "#eff6ff", c: "#2563eb" };
}

function HighlightedOriginal({ text, matches }) {
  if (text == null || text === "") return "—";
  const t = String(text);
  if (!matches?.length) return t;
  const sorted = [...matches].sort((a, b) => a.startIndex - b.startIndex);
  const parts = [];
  let last = 0;
  sorted.forEach((m, idx) => {
    if (m.startIndex > last) {
      parts.push(<span key={`p-${idx}-${last}`}>{t.slice(last, m.startIndex)}</span>);
    }
    parts.push(
      <mark key={`h-${m.startIndex}`} className="qbr-sens-highlight">
        {t.slice(m.startIndex, m.endIndex)}
      </mark>
    );
    last = m.endIndex;
  });
  if (last < t.length) parts.push(<span key="tail">{t.slice(last)}</span>);
  return <>{parts}</>;
}

function SlideHeader({ partner, period, generatedAt }) {
  return (
    <div className="qbr-slide-header">
      <div className="qbr-slide-header-dots">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="qbr-slide-header-dot" />
        ))}
      </div>
      <div className="qbr-slide-header-left">
        <div className="qbr-slide-header-bar" />
        <div>
          <div className="qbr-slide-header-eyebrow">QBR · {period}</div>
          <div className="qbr-slide-header-partner">{partner}</div>
        </div>
      </div>
      <div className="qbr-slide-header-right">
        Yuno Partner Intelligence ·{" "}
        {generatedAt
          ? new Date(generatedAt).toLocaleDateString("pt-BR")
          : new Date().toLocaleDateString("pt-BR")}
      </div>
    </div>
  );
}

function DetailPanel({ id, open, onToggle, label, children }) {
  return (
    <>
      <button
        type="button"
        className={`qbr-see-btn${open ? " open" : ""}`}
        onClick={() => onToggle(id)}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 4l4 4 4-4"
            stroke="#3E4FE0"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {label}
      </button>
      <div className={`qbr-detail-panel${open ? " open" : ""}`}>{children}</div>
    </>
  );
}

class QBRReportErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("QBRReport render error:", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="qbr-narrative">
          <strong>Erro ao renderizar o relatório.</strong> Recarrega a página ou gera
          de novo.
        </div>
      );
    }
    return this.props.children;
  }
}

function QBRReportInner({ report: rawReport, meta }) {
  if (rawReport == null) {
    return <div className="qbr-narrative">Aguardando dados do relatório...</div>;
  }

  const report = unwrapReportPayload(rawReport);
  const kpis = normalizeKpis(report?.kpis || {});

  const partnerName = report?.partner ?? meta?.partnerName ?? "Partner";
  const period = report?.period ?? meta?.period ?? "—";
  const generatedAt =
    report?.generatedAt ??
    report?.generated_at ??
    meta?.generatedAt ??
    new Date().toISOString();
  const genLabel = new Date(generatedAt).toLocaleString("pt-BR");

  const [currentSlide, setCurrentSlide] = useState(0);
  const [openDetails, setOpenDetails] = useState({
    monthly: false,
    merchants: false,
    declines: false,
    issues: false,
    nextsteps: false,
  });

  const [showExport, setShowExport] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [showReview, setShowReview] = useState(false);
  const [reviewBlocks, setReviewBlocks] = useState([]);
  const [allReviewed, setAllReviewed] = useState(false);
  const [sensitiveScanClean, setSensitiveScanClean] = useState(null);
  const prevShowExportRef = useRef(false);

  const nextSteps = Array.isArray(report?.nextSteps)
    ? report.nextSteps
    : Array.isArray(report?.next_steps)
      ? report.next_steps
      : [];

  const [selectedSteps, setSelectedSteps] = useState(() => new Set());

  useEffect(() => {
    setSelectedSteps(new Set(nextSteps.map((_, i) => String(i))));
  }, [nextSteps]);

  useEffect(() => {
    if (showExport && !prevShowExportRef.current) {
      setShowReview(false);
      setReviewBlocks([]);
      setAllReviewed(false);
      setSensitiveScanClean(null);
    }
    prevShowExportRef.current = showExport;
  }, [showExport]);

  useEffect(() => {
    if (!reviewBlocks.length) {
      setAllReviewed(false);
      return;
    }
    setAllReviewed(
      reviewBlocks.every(
        (b) => b.status === "approved" || b.status === "anonymized"
      )
    );
  }, [reviewBlocks]);

  useEffect(() => {
    const handler = (e) => {
      if (showExport || showReview) return;
      if (e.key === "ArrowRight") setCurrentSlide((c) => Math.min(c + 1, 5));
      if (e.key === "ArrowLeft") setCurrentSlide((c) => Math.max(c - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showExport, showReview]);

  const monthlyPerformance =
    report?.monthlyPerformance ?? report?.monthly_performance ?? [];

  const merchantsBlock =
    report?.merchants && typeof report.merchants === "object"
      ? report.merchants
      : null;

  const merchantRanking = Array.isArray(report?.merchantRanking)
    ? report.merchantRanking
    : Array.isArray(report?.merchant_ranking)
      ? report.merchant_ranking
      : [];

  const merchantsFullList = useMemo(() => {
    return [...merchantRanking].sort(
      (a, b) => (Number(b.volumeRaw) || 0) - (Number(a.volumeRaw) || 0)
    );
  }, [merchantRanking]);

  const perfHighlightsFromCsv = useMemo(() => {
    return merchantRanking
      .filter((m) => parsePctNum(m.approvalRate) >= 75)
      .slice(0, 2)
      .map((m) => {
        const rate = parsePctNum(m.approvalRate);
        return {
          name: resolveMerchantName(m) || m.name,
          approvalRate: `${rate.toFixed(2)}%`,
          volume: m.volume,
          transactions: formatNum(m.totalTxns),
          whyHighlight: `Taxa de aprovação de ${rate.toFixed(1)}% — acima do benchmark de 70%.`,
          opportunity: `Volume de ${m.volume} com potencial de expansão de métodos de pagamento.`,
        };
      });
  }, [merchantRanking]);

  const perfAlertsFromCsv = useMemo(() => {
    return merchantRanking
      .filter((m) => parsePctNum(m.approvalRate) < 55)
      .slice(0, 2)
      .map((m) => {
        const rate = parsePctNum(m.approvalRate);
        return {
          name: resolveMerchantName(m) || m.name,
          approvalRate: `${rate.toFixed(2)}%`,
          volume: m.volume,
          transactions: formatNum(m.totalTxns),
          whyAlert: `Approval rate de ${rate.toFixed(1)}% — crítico, abaixo de 55%.`,
          rootCause:
            "Análise detalhada necessária — ver decline codes por merchant.",
          suggestion:
            "Reunião técnica urgente para diagnóstico e plano de ação conjunto.",
          potentialImpact: "Alto impacto em revenue da parceria.",
        };
      });
  }, [merchantRanking]);

  const merchantsHighlights = Array.isArray(merchantsBlock?.highlights)
    ? merchantsBlock.highlights
    : [];
  const merchantsAlerts = Array.isArray(merchantsBlock?.alerts)
    ? merchantsBlock.alerts
    : [];

  const highlights =
    Array.isArray(report?.merchantInsights?.highlights) &&
    report.merchantInsights.highlights.length > 0
      ? report.merchantInsights.highlights
      : merchantsHighlights.length > 0
        ? merchantsHighlights
        : perfHighlightsFromCsv;

  const alerts =
    Array.isArray(report?.merchantInsights?.alerts) &&
    report.merchantInsights.alerts.length > 0
      ? report.merchantInsights.alerts
      : merchantsAlerts.length > 0
        ? merchantsAlerts
        : perfAlertsFromCsv;

  const merchantsTotals = useMemo(() => {
    let sumTx = 0;
    let sumAp = 0;
    for (const m of merchantsFullList) {
      sumTx += Math.round(Number(m.totalTxns)) || 0;
      sumAp += Math.round(Number(m.approved)) || 0;
    }
    const pctW =
      sumTx > 0 ? ((sumAp / sumTx) * 100).toFixed(1) : null;
    return { sumTx, sumAp, pctW };
  }, [merchantsFullList]);

  const declineCodesRaw = report?.declineCodes || report?.decline_codes || [];
  const declineCodes = useMemo(() => {
    const arr = Array.isArray(declineCodesRaw) ? declineCodesRaw : [];
    return arr.map((d) => ({
      ...d,
      code: d?.code ?? d?.decline_code ?? d?.Code,
      total: d?.total ?? d?.count,
      pctOfDeclines:
        Number(d?.pctOfDeclines ?? d?.pct_of_declines ?? d?.pct ?? d?.percentage) ||
        0,
      estimatedLostVolume: d?.estimatedLostVolume ?? d?.estimated_lost_volume,
      type: d?.type ?? d?.category,
      action: d?.action ?? d?.response_message,
    }));
  }, [declineCodesRaw]);

  const declineInsights = Array.isArray(report?.declineInsights)
    ? report.declineInsights
    : [];

  const recoverableVolume = useMemo(() => {
    return declineCodes.reduce((s, d) => {
      const t = String(d.type ?? "").toLowerCase();
      if (t.includes("hard")) return s;
      return s + parseMagnitudeRough(d.estimatedLostVolume);
    }, 0);
  }, [declineCodes]);

  const issuesData = report?.issuesData ?? report?.issues_data ?? null;
  const issuesAnalysisRaw =
    report?.issuesAnalysis ?? report?.issues_analysis ?? null;
  const issuesAnalysis = issuesAnalysisRaw
    ? {
        ...issuesAnalysisRaw,
        summary: issuesAnalysisRaw.summary ?? issuesAnalysisRaw.issues_summary,
        connectionToMetrics:
          issuesAnalysisRaw.connectionToMetrics ??
          issuesAnalysisRaw.connection_to_metrics,
      }
    : null;

  const issuesNarrative =
    report?.issuesAnalysis?.summary ||
    report?.issuesAnalysis?.connection_to_metrics ||
    (issuesData?.summary?.totalOpen > 0
      ? `Existem ${issuesData.summary.totalOpen} tickets abertos com Mercado Pago, sendo ${issuesData.summary.highestOpen + issuesData.summary.highOpen} de prioridade High ou superior. Os issues mais recorrentes no período foram: ${(issuesData.summary.topIssues || []).slice(0, 3).join("; ")}.`
      : null);

  const connectionText =
    report?.issuesAnalysis?.connectionToMetrics ||
    report?.issuesAnalysis?.connection_to_metrics ||
    (issuesData
      ? "Issues técnicos como falhas de 3DS e device fingerprint impactam diretamente a taxa de aprovação — merchants como Q2 Ingressos registraram queda de 82% para 30% durante incidentes de autenticação."
      : null);

  const executiveSummary = Array.isArray(report?.executiveSummary)
    ? report.executiveSummary
    : Array.isArray(report?.executive_summary)
      ? report.executive_summary
      : [];

  const top3Opportunities =
    report?.top3Opportunities ?? report?.top_3_opportunities ?? [];

  const approvalPctGlobal = parsePctNum(kpis?.approvalRate);

  const apprStatus =
    !Number.isFinite(approvalPctGlobal) || approvalPctGlobal >= 70
      ? "ok"
      : approvalPctGlobal >= 65
        ? "warn"
        : "crit";

  const statusBorder =
    apprStatus === "crit" ? Y.crit : apprStatus === "warn" ? "#c07010" : Y.ok;

  const toggleOpenDetail = useCallback((id) => {
    setOpenDetails((p) => ({ ...p, [id]: !p[id] }));
  }, []);

  const toggleStep = useCallback((id) => {
    setSelectedSteps((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const selectAllSteps = useCallback(() => {
    setSelectedSteps(new Set(nextSteps.map((_, i) => String(i))));
  }, [nextSteps]);

  const deselectAllSteps = useCallback(() => {
    setSelectedSteps(new Set());
  }, []);

  const filteredStepEntries = useMemo(() => {
    return nextSteps
      .map((s, idx) => ({ s, idx, id: String(idx) }))
      .filter(({ s }) => {
        if (filterCat === "all") return true;
        return normalizeCategory(s.category) === filterCat;
      });
  }, [nextSteps, filterCat]);

  const runPrint = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  }, []);

  const getValueForPrint = useCallback(
    (section, field, originalValue) => {
      const v = originalValue == null ? "—" : String(originalValue);
      const block = reviewBlocks.find(
        (b) =>
          b.section === section &&
          b.field === field &&
          b.originalValue === v
      );
      if (!block) return v;
      if (block.status === "anonymized" && block.anonymizedValue != null) {
        return block.anonymizedValue;
      }
      return v;
    },
    [reviewBlocks]
  );

  const nextStepCell = useCallback(
    (i, key, step) => {
      const raw = step?.[key];
      const v = typeof raw === "string" ? raw : "—";
      return getValueForPrint("nextSteps", `${i}.${key}`, v);
    },
    [getValueForPrint]
  );

  const pickTopOppForPrint = useCallback(() => {
    const t0 = top3Opportunities[0];
    if (t0?.lostVolume != null && typeof t0.lostVolume === "string") {
      return getValueForPrint("top3", "0.lostVolume", t0.lostVolume);
    }
    if (t0?.lost_volume != null && typeof t0.lost_volume === "string") {
      return getValueForPrint("top3", "0.lost_volume", t0.lost_volume);
    }
    return getValueForPrint(
      "kpis",
      "topOpportunity",
      typeof kpis?.topOpportunity === "string" ? kpis.topOpportunity : "—"
    );
  }, [getValueForPrint, top3Opportunities, kpis?.topOpportunity]);

  const onBaixarFromChecklist = useCallback(() => {
    if (selectedSteps.size === 0) return;
    const blocks = detectSensitiveData(report);
    if (blocks.length === 0) {
      setSensitiveScanClean(true);
      setShowReview(false);
      runPrint();
    } else {
      setSensitiveScanClean(false);
      setReviewBlocks(blocks);
      setShowReview(true);
    }
  }, [report, selectedSteps.size, runPrint]);

  const approveReviewBlock = useCallback((id) => {
    setReviewBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "approved" } : b))
    );
  }, []);

  const anonymizeReviewBlock = useCallback((id) => {
    setReviewBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const anonymizedValue = anonymizeBlock(b);
        return { ...b, status: "anonymized", anonymizedValue };
      })
    );
  }, []);

  const anonymizeAllPendingReviewBlocks = useCallback(() => {
    setReviewBlocks((prev) =>
      prev.map((b) => {
        if (b.status !== "pending") return b;
        const anonymizedValue = anonymizeBlock(b);
        return { ...b, status: "anonymized", anonymizedValue };
      })
    );
  }, []);

  const approveAllPendingReviewBlocks = useCallback(() => {
    setReviewBlocks((prev) =>
      prev.map((b) =>
        b.status === "pending" ? { ...b, status: "approved" } : b
      )
    );
  }, []);

  const hasPendingReviewBlocks = useMemo(
    () => reviewBlocks.some((b) => b.status === "pending"),
    [reviewBlocks]
  );

  const selectedList = useMemo(() => {
    return nextSteps
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => selectedSteps.has(String(i)));
  }, [nextSteps, selectedSteps]);

  const printHalftone = useMemo(() => halftoneBoxShadow(7, 5, 8), []);

  const allIssueTickets = useMemo(() => {
    if (!issuesData) return [];
    return [
      ...(issuesData.openTickets || []),
      ...(issuesData.closedTickets || []),
    ];
  }, [issuesData]);

  const printPortal = createPortal(
    <div id="qbr-print-document">
      <div className="qbr-print-inner">
        <header className="qbr-print-header">
          <div
            className="qbr-print-halftone"
            style={{
              boxShadow: printHalftone,
              background: "rgba(255,255,255,0.15)",
            }}
          />
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              opacity: 0.9,
            }}
          >
            Partner Performance Report
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>yuno</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>
            {partnerName}
          </div>
          <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>{period}</div>
        </header>

        <div className="qbr-print-kpis">
          <div className="qbr-card" style={{ borderTopColor: Y.ok }}>
            <div className="qbr-kpi-label">Total TPV</div>
            <div className="qbr-kpi-value">
              {typeof kpis?.totalTPV === "string"
                ? getValueForPrint("kpis", "totalTPV", kpis.totalTPV)
                : (kpis?.totalTPV ?? "—")}
            </div>
          </div>
          <div className="qbr-card" style={{ borderTopColor: Y.ok }}>
            <div className="qbr-kpi-label">Transações</div>
            <div className="qbr-kpi-value">
              {typeof kpis?.totalTransactions === "string"
                ? getValueForPrint(
                    "kpis",
                    "totalTransactions",
                    kpis.totalTransactions
                  )
                : (kpis?.totalTransactions ?? "—")}
            </div>
          </div>
          <div className="qbr-card" style={{ borderTopColor: statusBorder }}>
            <div className="qbr-kpi-label">Approval rate</div>
            <div className="qbr-kpi-value">
              {typeof kpis?.approvalRate === "string"
                ? getValueForPrint("kpis", "approvalRate", kpis.approvalRate)
                : (kpis?.approvalRate ?? "—")}
            </div>
          </div>
          <div className="qbr-card" style={{ borderTopColor: Y.crit }}>
            <div className="qbr-kpi-label">Volume recusado</div>
            <div className="qbr-kpi-value">
              {typeof kpis?.declinedVolume === "string"
                ? getValueForPrint("kpis", "declinedVolume", kpis.declinedVolume)
                : (kpis?.declinedVolume ?? "—")}
            </div>
          </div>
        </div>

        <div className="qbr-impact" style={{ marginBottom: 20 }}>
          <div className="qbr-impact-accent">Resumo de impacto</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>
            {typeof kpis?.declinedVolume === "string"
              ? getValueForPrint("kpis", "declinedVolume", kpis.declinedVolume)
              : (kpis?.declinedVolume ?? "—")}
          </div>
          <div className="qbr-impact-accent" style={{ marginTop: 12 }}>
            Oportunidade
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {pickTopOppForPrint()}
          </div>
        </div>

        <h2
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: Y.darkBlue,
            margin: "0 0 10px",
          }}
        >
          Próximos passos selecionados
        </h2>
        <table className="qbr-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Ação</th>
              <th>Responsável</th>
              <th>Prazo</th>
              <th>Impacto</th>
            </tr>
          </thead>
          <tbody>
            {selectedList.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: Y.gray }}>
                  Nenhuma ação selecionada
                </td>
              </tr>
            ) : (
              selectedList.map(({ s, i }) => (
                <tr key={i}>
                  <td>{s.priority ?? i + 1}</td>
                  <td>{nextStepCell(i, "action", s)}</td>
                  <td>{nextStepCell(i, "owner", s)}</td>
                  <td>{nextStepCell(i, "deadline", s)}</td>
                  <td>{nextStepCell(i, "expectedImpact", s)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="qbr-disclaimer" style={{ marginTop: 24 }}>
          Aviso sobre geração por IA — Este relatório foi produzido com auxílio de
          inteligência artificial a partir dos dados exportados da plataforma Yuno. Os
          números e métricas refletem os dados originais fornecidos. As análises e
          recomendações foram geradas automaticamente e devem ser revisadas pelo Partner
          Manager antes da apresentação ao parceiro.
        </div>

        <footer className="qbr-footer" style={{ marginTop: 28, borderRadius: 8 }}>
          <span style={{ fontWeight: 800 }}>yuno</span>
          <span style={{ color: Y.gray }}>{genLabel}</span>
          <span style={{ color: Y.green, fontWeight: 700 }}>www.y.uno</span>
        </footer>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <div className="qbr-root">
        {!showExport ? (
          <>
            <div className="qbr-topbar">
              <div className="qbr-topbar-logo">yuno</div>
              <div className="qbr-topbar-chips">
                <span className="qbr-chip qbr-chip-blue">{partnerName}</span>
                <span className="qbr-chip qbr-chip-dim">{period}</span>
              </div>
              <button
                type="button"
                className="qbr-gen-btn"
                onClick={() => setShowExport(true)}
              >
                Gerar relatório
              </button>
            </div>

            <div className="qbr-progress">
              {SLIDE_LABELS.map((title, i) => (
                <button
                  key={title}
                  type="button"
                  className={`qbr-step${currentSlide === i ? " active" : ""}`}
                  onClick={() => setCurrentSlide(i)}
                >
                  <span className="qbr-step-num">{i + 1}</span>
                  {title}
                </button>
              ))}
            </div>

            <div className="qbr-slide-area">
              <div className={`qbr-slide${currentSlide === 0 ? " active" : ""}`}>
                <SlideHeader
                  partner={partnerName}
                  period={period}
                  generatedAt={generatedAt}
                />
                <div className="qbr-slide-content">
                  <div className="qbr-kpi-grid">
                    <div
                      className="qbr-kpi-card"
                      style={{ borderTopColor: "#3E4FE0" }}
                    >
                      <div className="qbr-kpi-label">Total TPV</div>
                      <div className="qbr-kpi-value c-blue">
                        {kpis?.totalTPV ?? "—"}
                      </div>
                      <div className="qbr-kpi-delta c-green">
                        {kpis?.tpvGrowth ?? "—"}
                      </div>
                    </div>
                    <div
                      className="qbr-kpi-card"
                      style={{ borderTopColor: "#3E4FE0" }}
                    >
                      <div className="qbr-kpi-label">Transações</div>
                      <div className="qbr-kpi-value c-blue">
                        {kpis?.totalTransactions ?? "—"}
                      </div>
                      <div className="qbr-kpi-delta c-blue">
                        aprovadas no período
                      </div>
                    </div>
                    <div
                      className="qbr-kpi-card"
                      style={{
                        borderTopColor: getKpiTopColor(
                          "approval",
                          kpis?.approvalRate
                        ),
                      }}
                    >
                      <div className="qbr-kpi-label">Approval Rate</div>
                      <div
                        className="qbr-kpi-value"
                        style={{
                          color: getApprovalColor(
                            parseFloat(
                              String(kpis?.approvalRate || "").replace(
                                /%/g,
                                ""
                              )
                            ) || parsePctNum(kpis?.approvalRate)
                          ),
                        }}
                      >
                        {kpis?.approvalRate ?? "—"}
                      </div>
                      <div className="qbr-kpi-delta c-amber">Meta: 70%</div>
                    </div>
                    <div
                      className="qbr-kpi-card"
                      style={{ borderTopColor: "#E24B4A" }}
                    >
                      <div className="qbr-kpi-label">Vol. Recusado</div>
                      <div className="qbr-kpi-value c-red">
                        {kpis?.declinedVolume ?? "—"}
                      </div>
                      <div className="qbr-kpi-delta c-red">
                        volume não convertido
                      </div>
                    </div>
                  </div>
                  {(report?.trendAnalysis || report?.trend_analysis) ? (
                    <div
                      className="qbr-narrative"
                      dangerouslySetInnerHTML={{
                        __html: String(
                          report.trendAnalysis || report.trend_analysis
                        ).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                      }}
                    />
                  ) : null}
                  {!(report?.trendAnalysis || report?.trend_analysis) &&
                  executiveSummary.length > 0 ? (
                    <div className="qbr-narrative">
                      <ul style={{ paddingLeft: 16, margin: 0 }}>
                        {executiveSummary.map((b, i) => (
                          <li
                            key={i}
                            style={{ marginBottom: 6 }}
                            dangerouslySetInnerHTML={{
                              __html: String(b).replace(
                                /\*\*(.*?)\*\*/g,
                                "<strong>$1</strong>"
                              ),
                            }}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <DetailPanel
                    id="monthly"
                    open={!!openDetails.monthly}
                    onToggle={toggleOpenDetail}
                    label="Ver dados mensais detalhados"
                  >
                    <div className="qbr-detail-title">Evolução mensal</div>
                    <table className="qbr-table">
                      <thead>
                        <tr>
                          <th>Mês</th>
                          <th>Transações</th>
                          <th>Aprovadas</th>
                          <th>Approval Rate</th>
                          <th>Volume Total</th>
                          <th>Volume Aprovado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(monthlyPerformance || []).map((m, i) => {
                          const rateRaw = m.approvalRate ?? m.taxa_aprovacao;
                          const rateN = parsePctNum(rateRaw);
                          return (
                            <tr key={i}>
                              <td>{m.month || m.mes}</td>
                              <td>{formatNum(m.transactions ?? m.totalTxns ?? m.total_txns)}</td>
                              <td>{formatNum(m.approved ?? m.aprovadas)}</td>
                              <td>
                                <span
                                  className={getApprovalBadgeClass(rateN)}
                                >
                                  {rateN.toFixed(1)}%
                                </span>
                              </td>
                              <td>{m.totalVolume ?? m.volume_total_brl ?? "—"}</td>
                              <td>{m.approvedVolume ?? m.volume_aprovado_brl ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </DetailPanel>
                </div>
              </div>

              <div className={`qbr-slide${currentSlide === 1 ? " active" : ""}`}>
                <SlideHeader
                  partner={partnerName}
                  period={period}
                  generatedAt={generatedAt}
                />
                <div className="qbr-slide-content">
                  {highlights.length === 0 && alerts.length === 0 ? (
                    <div className="qbr-narrative">
                      Os dados de análise de merchants serão gerados pelo Claude na
                      próxima execução. Os dados brutos estão disponíveis em
                      &quot;Ver todos os merchants&quot;.
                    </div>
                  ) : null}
                  <div className="qbr-two-col">
                    <div>
                      <div className="qbr-section-label" style={{ color: "#1D9E75" }}>
                        Destaques
                      </div>
                      {highlights.slice(0, 2).map((m, i) => {
                        const rateN = parsePctNum(m.approvalRate);
                        return (
                          <div
                            key={i}
                            className="qbr-perf-card"
                            style={{
                              borderLeftColor: "#3E4FE0",
                              marginBottom: i === 0 ? 10 : 0,
                            }}
                          >
                            <div className="qbr-perf-header">
                              <div>
                                <div className="qbr-perf-name">
                                  {resolveMerchantName(m) || m.name || "—"}
                                </div>
                                <div className="qbr-perf-meta">
                                  {m.volume} · {m.transactions} txns
                                </div>
                              </div>
                              <span className="qbr-badge qbr-badge-ok">Destaque</span>
                            </div>
                            <div
                              className="qbr-perf-rate"
                              style={{ color: getApprovalColor(rateN) }}
                            >
                              {m.approvalRate}
                            </div>
                            <div className="qbr-rate-bar-wrap">
                              <div
                                className="qbr-rate-bar"
                                style={{
                                  width: `${Math.min(100, rateN)}%`,
                                  background: getApprovalColor(rateN),
                                }}
                              />
                            </div>
                            <div className="qbr-perf-insight">
                              {m.whyHighlight}{" "}
                              {m.opportunity ? (
                                <>
                                  <br />
                                  <strong style={{ color: "#1726A6" }}>
                                    {m.opportunity}
                                  </strong>
                                </>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <div className="qbr-section-label" style={{ color: "#E24B4A" }}>
                        Alertas críticos
                      </div>
                      {alerts.slice(0, 2).map((m, i) => {
                        const rateN = parsePctNum(m.approvalRate);
                        return (
                          <div
                            key={i}
                            className="qbr-perf-card"
                            style={{
                              borderLeftColor: "#E24B4A",
                              marginBottom: i === 0 ? 10 : 0,
                            }}
                          >
                            <div className="qbr-perf-header">
                              <div>
                                <div className="qbr-perf-name">
                                  {resolveMerchantName(m) || m.name || "—"}
                                </div>
                                <div className="qbr-perf-meta">
                                  {m.volume} · {m.transactions} txns
                                </div>
                              </div>
                              <span className="qbr-badge qbr-badge-crit">Alerta</span>
                            </div>
                            <div
                              className="qbr-perf-rate"
                              style={{ color: "#E24B4A" }}
                            >
                              {m.approvalRate}
                            </div>
                            <div className="qbr-rate-bar-wrap">
                              <div
                                className="qbr-rate-bar"
                                style={{
                                  width: `${Math.min(100, rateN)}%`,
                                  background: "#E24B4A",
                                }}
                              />
                            </div>
                            <div className="qbr-perf-insight">
                              <strong style={{ color: "#E24B4A" }}>Causa:</strong>{" "}
                              {m.rootCause}
                              <br />
                              <strong>Ação:</strong> {m.suggestion}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <DetailPanel
                    id="merchants"
                    open={!!openDetails.merchants}
                    onToggle={toggleOpenDetail}
                    label={`Ver todos os ${merchantsFullList.length} merchants`}
                  >
                    <div className="qbr-detail-title">Tabela completa de merchants</div>
                    <table className="qbr-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Merchant</th>
                          <th>Txns</th>
                          <th>Aprovadas</th>
                          <th>Approval Rate</th>
                          <th>Volume</th>
                          <th>Ticket Médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {merchantsFullList.map((m, i) => {
                          const rateN = parsePctNum(m.approvalRate);
                          return (
                            <tr key={i}>
                              <td style={{ color: "#92959B" }}>{i + 1}</td>
                              <td>
                                <strong>
                                  {resolveMerchantName(m) || m.name || "—"}
                                </strong>
                              </td>
                              <td>{formatNum(m.totalTxns)}</td>
                              <td>{formatNum(m.approved)}</td>
                              <td>
                                <span className={getApprovalBadgeClass(rateN)}>
                                  {rateN.toFixed(2)}%
                                </span>
                              </td>
                              <td>{m.volume}</td>
                              <td style={{ color: "#92959B" }}>{m.avgTicket}</td>
                            </tr>
                          );
                        })}
                        <tr className="total-row">
                          <td>—</td>
                          <td>TOTAL</td>
                          <td>{formatNum(merchantsTotals.sumTx)}</td>
                          <td>{formatNum(merchantsTotals.sumAp)}</td>
                          <td>
                            <span
                              className="qbr-badge"
                              style={{ background: "#3E4FE0", color: "#fff" }}
                            >
                              {merchantsTotals.pctW != null
                                ? `${merchantsTotals.pctW}%`
                                : kpis?.approvalRate ?? "—"}
                            </span>
                          </td>
                          <td>{kpis?.totalTPV}</td>
                          <td>—</td>
                        </tr>
                      </tbody>
                    </table>
                  </DetailPanel>
                </div>
              </div>

              <div className={`qbr-slide${currentSlide === 2 ? " active" : ""}`}>
                <SlideHeader
                  partner={partnerName}
                  period={period}
                  generatedAt={generatedAt}
                />
                <div className="qbr-slide-content">
                  {declineCodes.slice(0, 5).map((d, i) => {
                    const insight = declineInsights.find(
                      (di) => di.code === d.code
                    );
                    const insightAction =
                      insight?.suggestedAction ?? insight?.action;
                    const bType = declineBadgeType(d.type);
                    return (
                      <div key={i} className="qbr-decline-row">
                        <div className="qbr-decline-rank">{i + 1}</div>
                        <div className="qbr-decline-name">
                          <div className="qbr-decline-code">{d.code}</div>
                          <div className="qbr-decline-action">
                            {insightAction || d.action || "—"}
                          </div>
                        </div>
                        <div className="qbr-decline-right">
                          <div className="qbr-decline-vol">
                            {d.estimatedLostVolume}
                          </div>
                          <div className="qbr-decline-pct">
                            {Number(d.pctOfDeclines).toFixed(1)}% ·
                            <span
                              className={`qbr-badge qbr-badge-${bType}`}
                              style={{ marginLeft: 4 }}
                            >
                              {bType === "soft"
                                ? "Soft"
                                : bType === "hard"
                                  ? "Hard"
                                  : "Op."}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="qbr-impact-card">
                    <div>
                      <div className="qbr-impact-label">Volume total recusado</div>
                      <div className="qbr-impact-value">
                        {kpis?.declinedVolume ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="qbr-impact-rl">
                        Recuperável (soft + op.)
                      </div>
                      <div className="qbr-impact-rv">
                        {formatRecoverableLabel(recoverableVolume)}
                      </div>
                    </div>
                  </div>
                  <DetailPanel
                    id="declines"
                    open={!!openDetails.declines}
                    onToggle={toggleOpenDetail}
                    label="Ver todos os códigos"
                  >
                    <div className="qbr-detail-title">Top decline codes</div>
                    <table className="qbr-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Total</th>
                          <th>% Rejeições</th>
                          <th>Vol. Estimado Perdido</th>
                          <th>Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {declineCodes.map((d, i) => {
                          const bType = declineBadgeType(d.type);
                          return (
                            <tr key={i}>
                              <td>{d.code}</td>
                              <td>{formatNum(d.total)}</td>
                              <td>{Number(d.pctOfDeclines).toFixed(1)}%</td>
                              <td style={{ color: "#E24B4A", fontWeight: 600 }}>
                                {d.estimatedLostVolume}
                              </td>
                              <td>
                                <span className={`qbr-badge qbr-badge-${bType}`}>
                                  {bType === "soft"
                                    ? "Soft"
                                    : bType === "hard"
                                      ? "Hard"
                                      : "Operacional"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </DetailPanel>
                </div>
              </div>

              <div className={`qbr-slide${currentSlide === 3 ? " active" : ""}`}>
                <SlideHeader
                  partner={partnerName}
                  period={period}
                  generatedAt={generatedAt}
                />
                <div className="qbr-slide-content">
                  {!issuesData ? (
                    <div className="qbr-narrative">
                      Nenhum arquivo de issues carregado. Gere o CSV com o prompt
                      sugerido na tela inicial e faça upload junto com os dados.
                    </div>
                  ) : (
                    <>
                      <div className="qbr-issues-kpi-grid">
                        <div
                          className="qbr-issues-kpi"
                          style={{ borderTopColor: "#E24B4A" }}
                        >
                          <div className="qbr-kpi-label">Abertos</div>
                          <div className="qbr-kpi-value c-red">
                            {issuesData.summary?.totalOpen ?? 0}
                          </div>
                          <div className="qbr-kpi-delta c-dark">tickets ativos</div>
                        </div>
                        <div
                          className="qbr-issues-kpi"
                          style={{ borderTopColor: "#c07010" }}
                        >
                          <div className="qbr-kpi-label">Prioridade High+</div>
                          <div className="qbr-kpi-value c-amber">
                            {(issuesData.byPriority?.Highest?.length || 0) +
                              (issuesData.byPriority?.High?.length || 0)}
                          </div>
                          <div className="qbr-kpi-delta c-dark">
                            requerem ação
                          </div>
                        </div>
                        <div
                          className="qbr-issues-kpi"
                          style={{ borderTopColor: "#3E4FE0" }}
                        >
                          <div className="qbr-kpi-label">Fechados</div>
                          <div className="qbr-kpi-value c-blue">
                            {issuesData.summary?.totalClosed ?? 0}
                          </div>
                          <div className="qbr-kpi-delta c-dark">
                            resolvidos no trim.
                          </div>
                        </div>
                        <div
                          className="qbr-issues-kpi"
                          style={{ borderTopColor: "#1D9E75" }}
                        >
                          <div className="qbr-kpi-label">Padrão recorrente</div>
                          <div
                            className="qbr-kpi-value c-green"
                            style={{ fontSize: 16 }}
                          >
                            3DS
                          </div>
                          <div className="qbr-kpi-delta c-dark">
                            + device fingerprint
                          </div>
                        </div>
                      </div>
                      {issuesNarrative ? (
                        <div className="qbr-narrative">{issuesNarrative}</div>
                      ) : null}
                      {connectionText ? (
                        <div
                          className="qbr-connection-box"
                          style={{ marginTop: 12 }}
                        >
                          {connectionText}
                        </div>
                      ) : null}
                      <DetailPanel
                        id="issues"
                        open={!!openDetails.issues}
                        onToggle={toggleOpenDetail}
                        label={`Ver todos os ${issuesData.totalTickets} tickets`}
                      >
                        <div className="qbr-detail-title">
                          Tickets — abertos e fechados
                        </div>
                        <table className="qbr-table">
                          <thead>
                            <tr>
                              <th>Ticket</th>
                              <th>Problema</th>
                              <th>Merchant</th>
                              <th>Prioridade</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allIssueTickets.map((t, i) => (
                              <tr
                                key={i}
                                style={{ opacity: t.isOpen ? 1 : 0.6 }}
                              >
                                <td style={{ fontWeight: 600, color: "#3E4FE0" }}>
                                  {t.ticket}
                                </td>
                                <td>{t.problem}</td>
                                <td>{t.merchant}</td>
                                <td>
                                  <span className={getIssueBadgeClass(t.priority)}>
                                    {t.priority}
                                  </span>
                                </td>
                                <td style={{ color: "#92959B", fontSize: 10 }}>
                                  {t.status}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </DetailPanel>
                    </>
                  )}
                </div>
              </div>

              <div className={`qbr-slide${currentSlide === 4 ? " active" : ""}`}>
                <SlideHeader
                  partner={partnerName}
                  period={period}
                  generatedAt={generatedAt}
                />
                <div className="qbr-slide-content">
                  {nextSteps.slice(0, 5).map((ns, i) => (
                    <div key={i} className="qbr-ns-row">
                      <div
                        className={`qbr-ns-num ${getPriorityClass(ns.priority || i + 1)}`}
                      >
                        {ns.priority || i + 1}
                      </div>
                      <div className="qbr-ns-body">
                        <div className="qbr-ns-title">{ns.action}</div>
                        <div className="qbr-ns-desc">
                          {ns.description} · {ns.owner} · {ns.deadline}
                        </div>
                      </div>
                      <div className="qbr-ns-right">
                        <div className="qbr-ns-impact">{ns.expectedImpact}</div>
                        <div className="qbr-ns-owner">impacto estimado</div>
                      </div>
                    </div>
                  ))}
                  <DetailPanel
                    id="nextsteps"
                    open={!!openDetails.nextsteps}
                    onToggle={toggleOpenDetail}
                    label="Selecionar e exportar próximos passos"
                  >
                    <div className="qbr-narrative">
                      Clique em &quot;Gerar relatório&quot; no topo para acessar o
                      checklist completo de export.
                    </div>
                  </DetailPanel>
                </div>
              </div>

              <div className={`qbr-slide${currentSlide === 5 ? " active" : ""}`}>
                <div
                  style={{
                    background: "linear-gradient(135deg, #3E4FE0 0%, #1726A6 100%)",
                    padding: "56px 48px",
                    minHeight: 320,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 20,
                      right: 24,
                      display: "grid",
                      gridTemplateColumns: "repeat(7,1fr)",
                      gap: 5,
                      opacity: 0.12,
                    }}
                  >
                    {Array.from({ length: 35 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: "#fff",
                        }}
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 20,
                      left: 24,
                      display: "grid",
                      gridTemplateColumns: "repeat(5,1fr)",
                      gap: 5,
                      opacity: 0.08,
                    }}
                  >
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: "#fff",
                        }}
                      />
                    ))}
                  </div>

                  <div
                    style={{
                      width: 48,
                      height: 3,
                      background: "#E0ED80",
                      borderRadius: 2,
                      marginBottom: 28,
                    }}
                  />

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.5)",
                      marginBottom: 12,
                    }}
                  >
                    Yuno × {report?.partner || "Parceiro"}
                  </div>
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      color: "#fff",
                      lineHeight: 1.15,
                      marginBottom: 12,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Obrigado pela parceria.
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      color: "rgba(255,255,255,0.65)",
                      fontWeight: 300,
                      marginBottom: 32,
                      maxWidth: 420,
                      lineHeight: 1.7,
                    }}
                  >
                    Acreditamos no potencial desta parceria e estamos comprometidos em
                    trabalhar juntos para aumentar a aprovação, expandir o volume e
                    gerar mais receita para ambos os lados.
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3,1fr)",
                      gap: 16,
                      width: "100%",
                      maxWidth: 480,
                      marginBottom: 32,
                    }}
                  >
                    {[
                      { label: "TPV Q1 2026", value: kpis?.totalTPV || "—" },
                      {
                        label: "Oportunidade",
                        value: kpis?.topOpportunity || "R$ 21,6M/mês",
                      },
                      {
                        label: "Merchants ativos",
                        value: kpis?.merchantCount || "17",
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        style={{
                          background: "rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          padding: "12px 14px",
                          border: "1px solid rgba(255,255,255,0.15)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: "0.13em",
                            textTransform: "uppercase",
                            color: "rgba(255,255,255,0.45)",
                            marginBottom: 6,
                          }}
                        >
                          {item.label}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: "#fff",
                      letterSpacing: "-0.02em",
                      marginBottom: 6,
                    }}
                  >
                    yuno
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      fontWeight: 600,
                    }}
                  >
                    www.y.uno · {new Date().getFullYear()}
                  </div>
                </div>
              </div>
            </div>

            <div className="qbr-nav">
              <button
                type="button"
                className="qbr-nav-btn"
                disabled={currentSlide === 0}
                onClick={() => setCurrentSlide((c) => c - 1)}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path
                    d="M8 2L3 6.5l5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Anterior
              </button>
              <div className="qbr-nav-center">
                {currentSlide + 1} de 6 · {SLIDE_LABELS[currentSlide]}
              </div>
              <button
                type="button"
                className="qbr-nav-btn"
                disabled={currentSlide === 5}
                onClick={() => setCurrentSlide((c) => c + 1)}
              >
                Próximo
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path
                    d="M5 2l5 4.5L5 11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </>
        ) : showReview ? (
          <div className="qbr-review qbr-export-panel">
            <div className="qbr-review-header">
              <button
                type="button"
                className="qbr-export-back"
                onClick={() => setShowReview(false)}
              >
                ← Voltar ao checklist
              </button>
              <div className="qbr-review-title">Revisão de dados sensíveis</div>
              <div className="qbr-review-progress-meta">
                {
                  reviewBlocks.filter(
                    (b) =>
                      b.status === "approved" || b.status === "anonymized"
                  ).length
                }{" "}
                de {reviewBlocks.length} blocos revisados
              </div>
              <div className="qbr-review-progress-track">
                <div
                  className="qbr-review-progress-fill"
                  style={{
                    width: `${reviewBlocks.length ? (100 * reviewBlocks.filter((b) => b.status === "approved" || b.status === "anonymized").length) / reviewBlocks.length : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="qbr-review-explainer">
              Identificamos dados que podem ser sensíveis neste relatório. Revise cada
              item e escolha aprovação ou anonimização antes de gerar o PDF.
            </div>
            <div className="qbr-review-bulk">
              <button
                type="button"
                className="qbr-review-btn-approve qbr-review-btn-approve-all"
                disabled={!hasPendingReviewBlocks}
                onClick={approveAllPendingReviewBlocks}
              >
                Aprovar todos
              </button>
              <button
                type="button"
                className="qbr-review-btn-anon qbr-review-btn-anon-all"
                disabled={!hasPendingReviewBlocks}
                onClick={anonymizeAllPendingReviewBlocks}
              >
                Anonimizar todos
              </button>
            </div>
            <div className="qbr-review-list">
              {reviewBlocks.map((block) => {
                const typeLabels = [
                  ...new Set(block.sensitiveMatches.map((m) => m.label)),
                ];
                const statusLabel =
                  block.status === "approved"
                    ? "Aprovado"
                    : block.status === "anonymized"
                      ? "Anonimizado"
                      : "Pendente";
                const cardMod =
                  block.status === "approved"
                    ? "qbr-review-card--approved"
                    : block.status === "anonymized"
                      ? "qbr-review-card--anonymized"
                      : "qbr-review-card--pending";
                const pending = block.status === "pending";
                return (
                  <div
                    key={block.id}
                    className={`qbr-review-card ${cardMod}`}
                  >
                    <div className="qbr-review-card-top">
                      <span className="qbr-review-badge qbr-review-badge--section">
                        {block.sectionLabel}
                      </span>
                      {typeLabels.map((lb) => (
                        <span
                          key={lb}
                          className="qbr-review-badge qbr-review-badge--type"
                        >
                          {lb}
                        </span>
                      ))}
                      <span
                        className={`qbr-review-badge qbr-review-badge--status qbr-review-badge--status-${block.status}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="qbr-review-field">{block.field}</div>
                    <div className="qbr-review-tlabel">Texto original:</div>
                    <div className="qbr-review-original-box">
                      <HighlightedOriginal
                        text={block.originalValue}
                        matches={block.sensitiveMatches}
                      />
                    </div>
                    {block.status === "anonymized" &&
                    block.anonymizedValue != null ? (
                      <>
                        <div className="qbr-review-tlabel qbr-review-tlabel--after">
                          Após anonimização:
                        </div>
                        <div className="qbr-review-anon-box">
                          {block.anonymizedValue}
                        </div>
                      </>
                    ) : null}
                    <div className="qbr-review-card-actions">
                      <button
                        type="button"
                        className="qbr-review-btn-approve"
                        disabled={!pending}
                        onClick={() => approveReviewBlock(block.id)}
                      >
                        Aprovar como está
                      </button>
                      <button
                        type="button"
                        className="qbr-review-btn-anon"
                        disabled={!pending}
                        onClick={() => anonymizeReviewBlock(block.id)}
                      >
                        Anonimizar dados
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="qbr-review-footer">
              <span className="qbr-review-footer-count">
                {
                  reviewBlocks.filter(
                    (b) =>
                      b.status === "approved" || b.status === "anonymized"
                  ).length
                }{" "}
                de {reviewBlocks.length} itens revisados
              </span>
              <button
                type="button"
                className="qbr-btn-pdf"
                disabled={!allReviewed}
                onClick={runPrint}
              >
                Gerar PDF revisado
              </button>
            </div>
          </div>
        ) : (
          <div className="qbr-export qbr-export-panel">
            <div className="qbr-export-header">
              <button
                type="button"
                className="qbr-export-back"
                onClick={() => setShowExport(false)}
              >
                ← Voltar
              </button>
              <div className="qbr-export-title">
                Selecione as ações para o relatório
              </div>
              <div className="qbr-export-count">
                <strong>{selectedSteps.size}</strong> de {nextSteps.length}{" "}
                selecionadas
              </div>
            </div>
            <div className="qbr-export-filters">
              {[
                ["all", "Todos"],
                ["urgente", "Urgente"],
                ["tecnico", "Técnico"],
                ["comercial", "Comercial"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`qbr-pill ${filterCat === id ? "qbr-pill--active" : ""}`}
                  onClick={() => setFilterCat(id)}
                >
                  {label}
                </button>
              ))}
              <div className="qbr-export-filters-spacer" />
              <button
                type="button"
                className="qbr-pill-ghost"
                onClick={selectAllSteps}
              >
                Marcar todos
              </button>
              <button
                type="button"
                className="qbr-pill-ghost"
                onClick={deselectAllSteps}
              >
                Desmarcar todos
              </button>
            </div>
            <div className="qbr-export-list">
              {filteredStepEntries.map(({ s, id }) => {
                const sel = selectedSteps.has(id);
                const st = priorityStyle(s.priority);
                const cat = normalizeCategory(s.category);
                const catLabel =
                  cat === "urgente"
                    ? "Urgente"
                    : cat === "tecnico"
                      ? "Técnico"
                      : cat === "comercial"
                        ? "Comercial"
                        : (s.category ?? "—");
                return (
                  <div
                    key={id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleStep(id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleStep(id);
                      }
                    }}
                    className={`qbr-check-item ${sel ? "qbr-check-item--selected" : ""}`}
                  >
                    <div className="qbr-check-box">{sel ? "✓" : ""}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          className="qbr-prio"
                          style={{ background: st.bg, color: st.c }}
                        >
                          {s.priority ?? id}
                        </span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 14,
                            color: Y.black,
                          }}
                        >
                          {s.action ?? "—"}
                        </span>
                      </div>
                      {s.description ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: Y.gray,
                            marginTop: 6,
                            lineHeight: 1.45,
                          }}
                        >
                          {s.description}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 11, color: Y.gray, marginTop: 8 }}>
                        {(s.owner ?? "—") +
                          " · " +
                          (s.deadline ?? "—") +
                          " · " +
                          catLabel}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: Y.blue,
                        textAlign: "right",
                        maxWidth: 120,
                      }}
                    >
                      {s.expectedImpact ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="qbr-export-footer">
              <div className="qbr-disclaimer">
                Aviso sobre geração por IA — Este relatório foi produzido com auxílio
                de inteligência artificial a partir dos dados exportados da plataforma
                Yuno. Os números e métricas refletem os dados originais fornecidos. As
                análises e recomendações foram geradas automaticamente e devem ser
                revisadas pelo Partner Manager antes da apresentação ao parceiro.
              </div>
              <div className="qbr-export-actions">
                <div className="qbr-export-actions-left">
                  <span style={{ fontSize: 13, color: Y.gray }}>
                    {selectedSteps.size} selecionada(s)
                  </span>
                  {sensitiveScanClean === true ? (
                    <span className="qbr-sensitive-clean-badge">
                      Nenhum dado sensível detectado
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="qbr-btn-pdf"
                  disabled={selectedSteps.size === 0}
                  onClick={onBaixarFromChecklist}
                >
                  Baixar documento PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {printPortal}
    </>
  );
}

export default function QBRReport(props) {
  return (
    <QBRReportErrorBoundary>
      <QBRReportInner {...props} />
    </QBRReportErrorBoundary>
  );
}
