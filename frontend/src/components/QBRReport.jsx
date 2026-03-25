import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Chart, Bar, Doughnut } from "react-chartjs-2";
import "./QBRReport.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const Y = {
  blue: "#3E4FE0",
  darkBlue: "#1726A6",
  black: "#282A30",
  green: "#E0ED80",
  lilac: "#E8EAF5",
  gray: "#92959B",
  lightBlue: "#788CFF",
  ok: "#3E4FE0",
  warn: "#E0A020",
  crit: "#E24B4A",
  bg: "#F7F8FC",
};

const chartFont = { family: "'Titillium Web', sans-serif", size: 10 };

const commonChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: Y.gray, font: chartFont },
    },
    tooltip: {
      backgroundColor: Y.black,
      titleColor: Y.lilac,
      bodyColor: Y.lilac,
      padding: 10,
    },
  },
};

const scaleXY = {
  grid: { color: Y.lilac },
  ticks: { color: Y.gray, font: chartFont },
};

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

function approvalKpiStatus(pct) {
  if (!Number.isFinite(pct)) return "ok";
  if (pct < 65) return "crit";
  if (pct < 70) return "warn";
  return "ok";
}

function statusBorder(c) {
  if (c === "crit") return Y.crit;
  if (c === "warn") return Y.warn;
  return Y.ok;
}

function statusDeltaColor(c) {
  return statusBorder(c);
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

function parseCountRough(str) {
  if (str == null || str === "") return 0;
  const m = String(str).replace(/[^\d.,]/g, " ").match(/[\d.,]+/);
  if (!m) return 0;
  let n = m[0];
  if (n.includes(",") && n.includes(".")) {
    if (n.lastIndexOf(",") > n.lastIndexOf("."))
      n = n.replace(/\./g, "").replace(",", ".");
    else n = n.replace(/,/g, "");
  } else if (n.includes(",")) n = n.replace(",", ".");
  const v = parseFloat(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
}

function declineTypeColor(t) {
  const x = String(t || "").toLowerCase();
  if (x.includes("soft")) return Y.lightBlue;
  if (x.includes("hard")) return Y.black;
  return "#E0A020";
}

/** Desembrulha { report } / { data } e normaliza shape comum da API. */
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
  };
}

export default function QBRReport({ report: rawReport, meta }) {
  useEffect(() => {
    try {
      console.log("QBR REPORT PROP:", JSON.stringify(rawReport, null, 2));
    } catch (e) {
      console.log("QBR REPORT PROP:", rawReport, e);
    }
  }, [rawReport]);

  const report = unwrapReportPayload(rawReport);
  const kpisRaw = report?.kpis || {};
  const kpis = normalizeKpis(kpisRaw);

  const partnerName =
    report?.partner ?? meta?.partnerName ?? "Partner";
  const period = report?.period ?? meta?.period ?? "—";
  const generatedAt =
    report?.generatedAt ??
    report?.generated_at ??
    meta?.generatedAt ??
    new Date().toISOString();
  const genLabel = new Date(generatedAt).toLocaleString("pt-BR");

  const [activeTab, setActiveTab] = useState("overview");
  const [showExport, setShowExport] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [showAllIssueTickets, setShowAllIssueTickets] = useState(false);
  const nextSteps = Array.isArray(report?.nextSteps)
    ? report.nextSteps
    : Array.isArray(report?.next_steps)
      ? report.next_steps
      : [];

  const [selectedSteps, setSelectedSteps] = useState(() => new Set());

  useEffect(() => {
    setSelectedSteps(new Set(nextSteps.map((_, i) => String(i))));
  }, [nextSteps]);

  const monthlyRaw =
    report?.monthlyPerformance ||
    report?.monthly_performance ||
    [];
  const monthly = useMemo(() => {
    const arr = Array.isArray(monthlyRaw) ? monthlyRaw : [];
    const iso = arr.filter((r) =>
      /^\d{4}-\d{2}$/.test(String(r?.month ?? "").trim())
    );
    if (iso.length > 0) return iso;
    return arr.filter((r) => String(r?.month ?? "").trim().length > 0);
  }, [monthlyRaw]);

  const paymentMethodsRaw =
    report?.paymentMethods || report?.payment_methods || [];
  const paymentMethods = useMemo(() => {
    const arr = Array.isArray(paymentMethodsRaw) ? paymentMethodsRaw : [];
    return arr.map((p) => ({
      ...p,
      method: p?.method ?? p?.name ?? p?.payment_method ?? "—",
      approvalRate: p?.approvalRate ?? p?.approval_rate ?? p?.rate,
      volume: p?.volume ?? p?.total_volume,
      status: p?.status ?? p?.health,
    }));
  }, [paymentMethodsRaw]);

  const merchantsBlock =
    report?.merchants && typeof report.merchants === "object"
      ? report.merchants
      : null;
  const highlights = Array.isArray(merchantsBlock?.highlights)
    ? merchantsBlock.highlights
    : Array.isArray(report?.merchant_highlights)
      ? report.merchant_highlights
      : [];
  const alerts = Array.isArray(merchantsBlock?.alerts)
    ? merchantsBlock.alerts
    : Array.isArray(report?.merchant_alerts)
      ? report.merchant_alerts
      : [];

  const declineCodesRaw = report?.declineCodes || report?.decline_codes || [];
  const declineCodes = useMemo(() => {
    const arr = Array.isArray(declineCodesRaw) ? declineCodesRaw : [];
    return arr.map((d) => ({
      ...d,
      code: d?.code ?? d?.decline_code ?? d?.Code,
      total: d?.total ?? d?.count,
      pctOfDeclines:
        Number(
          d?.pctOfDeclines ?? d?.pct_of_declines ?? d?.pct ?? d?.percentage
        ) || 0,
      estimatedLostVolume:
        d?.estimatedLostVolume ?? d?.estimated_lost_volume,
      type: d?.type ?? d?.category,
    }));
  }, [declineCodesRaw]);

  const trendAnalysisText =
    report?.trendAnalysis ?? report?.trend_analysis ?? "";
  const top3Opportunities =
    report?.top3Opportunities ?? report?.top_3_opportunities ?? [];

  const issuesData = report?.issuesData ?? report?.issues_data ?? null;
  const issuesAnalysis =
    report?.issuesAnalysis ?? report?.issues_analysis ?? null;
  const issuesSummaryText =
    issuesAnalysis?.summary ?? issuesAnalysis?.issues_summary ?? "";
  const issuesMetricsLinkText =
    issuesAnalysis?.connectionToMetrics ??
    issuesAnalysis?.connection_to_metrics ??
    "";

  const issuesCriticalRows = useMemo(() => {
    const ai =
      issuesAnalysis?.criticalOpen ?? issuesAnalysis?.critical_open;
    if (Array.isArray(ai) && ai.length > 0) {
      return ai.map((row) => ({
        ticket: row.ticket ?? "—",
        problem: row.problem ?? "—",
        impact: row.impact ?? "—",
        merchant: row.merchant ?? row.Merchant ?? "—",
        priority: row.priority ?? "—",
        suggestedAction:
          row.suggestedAction ?? row.suggested_action ?? "—",
        isOpen: true,
        closed: false,
      }));
    }
    if (!issuesData?.openTickets?.length) return [];
    return issuesData.openTickets
      .filter((t) => t.priority === "Highest" || t.priority === "High")
      .map((t) => ({
        ticket: t.ticket,
        problem: t.problem,
        impact: t.impact,
        merchant: t.merchant,
        priority: t.priority,
        suggestedAction: "—",
        isOpen: true,
        closed: false,
      }));
  }, [issuesAnalysis, issuesData]);

  const allIssueTickets = useMemo(() => {
    if (!issuesData) return [];
    return [
      ...(issuesData.openTickets || []),
      ...(issuesData.closedTickets || []),
    ];
  }, [issuesData]);

  const approvalPctGlobal = parsePctFromString(kpis?.approvalRate);
  const apprStatus = approvalKpiStatus(approvalPctGlobal);

  const debitMethod = useMemo(() => {
    return (
      paymentMethods.find((p) =>
        /débito|debit/i.test(String(p?.method ?? ""))
      ) ?? null
    );
  }, [paymentMethods]);
  const debitPct = debitMethod
    ? Number(debitMethod.approvalRate)
    : NaN;
  const debitStatus = Number.isFinite(debitPct)
    ? debitPct < 20
      ? "crit"
      : debitPct < 40
        ? "warn"
        : "ok"
    : "ok";

  const merchantCount = highlights.length + alerts.length;

  const kpiStrip = useMemo(
    () => [
      {
        key: "tpv",
        label: "Total TPV",
        value: kpis?.totalTPV ?? "—",
        delta: kpis?.tpvGrowth ?? "",
        status: "ok",
      },
      {
        key: "tx",
        label: "Transações",
        value: kpis?.totalTransactions ?? "—",
        delta: "",
        status: "ok",
      },
      {
        key: "appr",
        label: "Approval rate",
        value: kpis?.approvalRate ?? "—",
        delta: "",
        status: apprStatus,
      },
      {
        key: "decl",
        label: "Vol. recusado",
        value: kpis?.declinedVolume ?? "—",
        delta: "",
        status: "crit",
      },
      {
        key: "debit",
        label: "Débito",
        value: debitMethod
          ? `${debitMethod.approvalRate ?? "—"}%`
          : "—",
        delta: debitMethod?.volume ?? "",
        status: debitMethod ? debitStatus : "ok",
      },
      {
        key: "merch",
        label: "Merchants",
        value: merchantCount ? String(merchantCount) : "—",
        delta: "destaques + alertas",
        status: "ok",
      },
    ],
    [kpis, apprStatus, debitMethod, debitStatus, merchantCount]
  );

  const mergedMerchants = useMemo(() => {
    const rows = [];
    for (const h of highlights) {
      const p = parsePctFromString(h?.approvalRate);
      rows.push({
        name: h?.name ?? "—",
        rate: Number.isFinite(p) ? p : 0,
        label: h?.approvalRate ?? "—",
        volume: h?.volume ?? "—",
        kind: "hi",
      });
    }
    for (const a of alerts) {
      const p = parsePctFromString(a?.approvalRate);
      rows.push({
        name: a?.name ?? "—",
        rate: Number.isFinite(p) ? p : 0,
        label: a?.approvalRate ?? "—",
        volume: a?.volume ?? "—",
        kind: "al",
      });
    }
    rows.sort((a, b) => b.rate - a.rate);
    return rows;
  }, [highlights, alerts]);

  function merchantDotColor(rate) {
    if (rate >= 75) return Y.blue;
    if (rate >= 65) return Y.warn;
    return Y.crit;
  }

  const approvalChartData = useMemo(() => {
    const labels = monthly.map((r) => String(r.month ?? ""));
    const rates = monthly.map((r) =>
      Math.min(
        100,
        Math.max(
          0,
          Number(r.approvalRate ?? r.approval_rate ?? r.rate) || 0
        )
      )
    );
    const barColors = rates.map((v) =>
      v > 70 ? Y.blue : Y.gray
    );
    const bench = labels.map(() => 70);
    return {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Taxa aprovação %",
          data: rates,
          backgroundColor: barColors,
          borderRadius: 4,
          order: 2,
        },
        {
          type: "line",
          label: "Benchmark 70%",
          data: bench,
          borderColor: Y.green,
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: 1,
        },
      ],
    };
  }, [monthly]);

  const approvalChartOptions = useMemo(
    () => ({
      ...commonChartOptions,
      scales: {
        x: scaleXY,
        y: {
          ...scaleXY,
          min: 0,
          max: 100,
          grid: {
            color: (ctx) =>
              ctx.tick?.value === 70 ? Y.green : Y.lilac,
            lineWidth: (ctx) => (ctx.tick?.value === 70 ? 2 : 1),
          },
        },
      },
    }),
    []
  );

  const paymentChartData = useMemo(() => {
    const labels = paymentMethods.map((p) => p.method ?? "—");
    const data = paymentMethods.map((p) => Number(p.approvalRate) || 0);
    const colors = paymentMethods.map((p) => {
      const s = String(p.status ?? "").toLowerCase();
      if (s === "critical") return Y.crit;
      if (s === "attention") return Y.warn;
      return Y.blue;
    });
    return {
      labels,
      datasets: [
        {
          label: "Taxa aprovação %",
          data,
          backgroundColor: colors,
          borderRadius: 4,
        },
      ],
    };
  }, [paymentMethods]);

  const tpvChartData = useMemo(() => {
    const labels = monthly.map((r) => r.month ?? "");
    const data = monthly.map((r) =>
      parseMagnitudeRough(r.totalVolume ?? r.total_volume)
    );
    return {
      labels,
      datasets: [
        {
          label: "TPV",
          data,
          backgroundColor: Y.blue,
          borderRadius: 4,
        },
      ],
    };
  }, [monthly]);

  const txnChartData = useMemo(() => {
    const labels = monthly.map((r) => r.month ?? "");
    const data = monthly.map((r) =>
      parseCountRough(r.transactions ?? r.transaction_count)
    );
    return {
      labels,
      datasets: [
        {
          label: "Transações",
          data,
          backgroundColor: Y.darkBlue,
          borderRadius: 4,
        },
      ],
    };
  }, [monthly]);

  const doughnutData = useMemo(() => {
    const top = [...declineCodes]
      .sort(
        (a, b) =>
          (Number(b.pctOfDeclines) || 0) - (Number(a.pctOfDeclines) || 0)
      )
      .slice(0, 6);
    return {
      labels: top.map((d) => d.code ?? "—"),
      datasets: [
        {
          data: top.map((d) => Number(d.pctOfDeclines) || 0),
          backgroundColor: top.map((d) => declineTypeColor(d.type)),
          borderWidth: 1,
          borderColor: "#fff",
        },
      ],
    };
  }, [declineCodes]);

  const declineBarData = useMemo(() => {
    const top = [...declineCodes]
      .sort(
        (a, b) =>
          (Number(b.pctOfDeclines) || 0) - (Number(a.pctOfDeclines) || 0)
      )
      .slice(0, 8);
    return {
      labels: top.map((d) => d.code ?? "—"),
      datasets: [
        {
          label: "% rejeições",
          data: top.map((d) => Number(d.pctOfDeclines) || 0),
          backgroundColor: top.map((d) => declineTypeColor(d.type)),
          borderRadius: 4,
        },
      ],
    };
  }, [declineCodes]);

  const declineAgg = useMemo(() => {
    let soft = 0,
      hard = 0,
      op = 0;
    for (const d of declineCodes) {
      const t = String(d.type ?? "").toLowerCase();
      const v = parseMagnitudeRough(d.estimatedLostVolume);
      if (t.includes("soft")) soft += v;
      else if (t.includes("hard")) hard += v;
      else op += v;
    }
    return { soft, hard, op };
  }, [declineCodes]);

  const declinedTxSum = useMemo(
    () => declineCodes.reduce((a, d) => a + parseCountRough(d.total), 0),
    [declineCodes]
  );

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

  const handlePrint = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  }, []);

  const selectedList = useMemo(() => {
    return nextSteps
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => selectedSteps.has(String(i)));
  }, [nextSteps, selectedSteps]);

  const printHalftone = useMemo(() => halftoneBoxShadow(7, 5, 8), []);

  const topOpp =
    top3Opportunities[0]?.lostVolume ??
    top3Opportunities[0]?.lost_volume ??
    kpis?.topOpportunity ??
    "—";

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
          <div
            className="qbr-card"
            style={{ margin: 0, borderTop: `3px solid ${Y.ok}` }}
          >
            <div className="qbr-kpi-label">Total TPV</div>
            <div className="qbr-kpi-value">{kpis?.totalTPV ?? "—"}</div>
          </div>
          <div
            className="qbr-card"
            style={{ margin: 0, borderTop: `3px solid ${Y.ok}` }}
          >
            <div className="qbr-kpi-label">Transações</div>
            <div className="qbr-kpi-value">{kpis?.totalTransactions ?? "—"}</div>
          </div>
          <div
            className="qbr-card"
            style={{
              margin: 0,
              borderTop: `3px solid ${statusBorder(apprStatus)}`,
            }}
          >
            <div className="qbr-kpi-label">Approval rate</div>
            <div className="qbr-kpi-value">{kpis?.approvalRate ?? "—"}</div>
          </div>
          <div
            className="qbr-card"
            style={{ margin: 0, borderTop: `3px solid ${Y.crit}` }}
          >
            <div className="qbr-kpi-label">Volume recusado</div>
            <div className="qbr-kpi-value">{kpis?.declinedVolume ?? "—"}</div>
          </div>
        </div>

        <div className="qbr-impact" style={{ marginBottom: 20 }}>
          <div className="qbr-impact-accent">Resumo de impacto</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>
            {kpis?.declinedVolume ?? "—"}
          </div>
          <div className="qbr-impact-accent" style={{ marginTop: 12 }}>
            Oportunidade
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{topOpp}</div>
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
                  <td>{s.action ?? "—"}</td>
                  <td>{s.owner ?? "—"}</td>
                  <td>{s.deadline ?? "—"}</td>
                  <td>{s.expectedImpact ?? "—"}</td>
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

        <footer
          className="qbr-footer"
          style={{ marginTop: 28, borderRadius: 8 }}
        >
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
        <div className="qbr-wrap">
          {!showExport ? (
            <div className="qbr-shell">
              <header className="qbr-topbar">
                <span className="qbr-logo">yuno</span>
                <span className="qbr-badge qbr-badge--partner">{partnerName}</span>
                <span className="qbr-badge qbr-badge--period">{period}</span>
                <div className="qbr-topbar-spacer" />
                <button
                  type="button"
                  className="qbr-btn-export-trigger"
                  onClick={() => setShowExport(true)}
                >
                  Gerar relatório
                </button>
              </header>

              <nav className="qbr-tabs" aria-label="Seções do relatório">
                {[
                  ["overview", "Visão Geral"],
                  ["performance", "Performance"],
                  ["merchants", "Merchants"],
                  ["declines", "Rejeições"],
                  ["issues", "Issues"],
                  ["nextsteps", "Próximos Passos"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`qbr-tab ${activeTab === id ? "qbr-tab--active" : ""}`}
                    onClick={() => setActiveTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              <div className="qbr-kpi-strip">
                {kpiStrip.map((k) => (
                  <div
                    key={k.key}
                    className="qbr-kpi-cell"
                    style={{ borderTopColor: statusBorder(k.status) }}
                  >
                    <div className="qbr-kpi-label">{k.label}</div>
                    <div className="qbr-kpi-value">{k.value}</div>
                    {k.delta ? (
                      <div
                        className="qbr-kpi-delta"
                        style={{ color: statusDeltaColor(k.status) }}
                      >
                        {k.delta}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="qbr-body">
                {activeTab === "overview" && (
                  <div className="qbr-grid-3">
                    <div>
                      <div className="qbr-card">
                        <h3 className="qbr-card-title">
                          Approval rate vs benchmark
                        </h3>
                        <div className="qbr-chart-wrap">
                          {monthly.length ? (
                            <Chart
                              type="bar"
                              data={approvalChartData}
                              options={approvalChartOptions}
                            />
                          ) : (
                            <div style={{ color: Y.gray, padding: 24 }}>—</div>
                          )}
                        </div>
                      </div>
                      <div className="qbr-card">
                        <h3 className="qbr-card-title">Métodos de pagamento</h3>
                        <div className="qbr-chart-wrap qbr-chart-wrap--short">
                          {paymentMethods.length ? (
                            <Bar
                              data={paymentChartData}
                              options={{
                                ...commonChartOptions,
                                indexAxis: "y",
                                scales: { x: scaleXY, y: scaleXY },
                              }}
                            />
                          ) : (
                            <div style={{ color: Y.gray, padding: 24 }}>—</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="qbr-card">
                      <h3 className="qbr-card-title">Merchants</h3>
                      {mergedMerchants.length === 0 ? (
                        <div style={{ color: Y.gray }}>—</div>
                      ) : (
                        mergedMerchants.slice(0, 12).map((m, i) => (
                          <div key={i} className="qbr-merchant-row">
                            <span
                              className="qbr-dot"
                              style={{
                                background: merchantDotColor(m.rate),
                              }}
                            />
                            <span style={{ flex: "0 0 90px", fontWeight: 600 }}>
                              {m.name}
                            </span>
                            <div className="qbr-mini-bar">
                              <div
                                className="qbr-mini-bar-fill"
                                style={{
                                  width: `${Math.min(100, m.rate)}%`,
                                  background: merchantDotColor(m.rate),
                                }}
                              />
                            </div>
                            <span
                              style={{
                                flex: "0 0 48px",
                                textAlign: "right",
                                fontWeight: 700,
                              }}
                            >
                              {m.label}
                            </span>
                            <span
                              style={{
                                flex: "0 0 72px",
                                textAlign: "right",
                                color: Y.gray,
                                fontSize: 11,
                              }}
                            >
                              {m.volume}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div>
                      <div className="qbr-impact">
                        <div className="qbr-impact-accent">Impacto estimado</div>
                        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>
                          {kpis?.declinedVolume ?? "—"}
                        </div>
                        <div
                          className="qbr-impact-accent"
                          style={{ marginTop: 16 }}
                        >
                          Maior oportunidade
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                          {topOpp}
                        </div>
                      </div>
                      <div className="qbr-card">
                        <h3 className="qbr-card-title">Decline codes</h3>
                        <div className="qbr-chart-wrap qbr-chart-wrap--short">
                          {declineCodes.length ? (
                            <Bar
                              data={declineBarData}
                              options={{
                                ...commonChartOptions,
                                indexAxis: "y",
                                scales: { x: scaleXY, y: scaleXY },
                              }}
                            />
                          ) : (
                            <div style={{ color: Y.gray }}>—</div>
                          )}
                        </div>
                      </div>
                      <div className="qbr-stat-grid-3">
                        {[
                          ["Soft", declineAgg.soft, Y.lightBlue],
                          ["Hard", declineAgg.hard, Y.black],
                          ["Operacional", declineAgg.op, "#E0A020"],
                        ].map(([name, val, col]) => (
                          <div key={name} className="qbr-stat-mini">
                            <div style={{ color: Y.gray, fontWeight: 700 }}>
                              {name}
                            </div>
                            <div
                              style={{
                                fontWeight: 800,
                                marginTop: 6,
                                color: col,
                              }}
                            >
                              {val >= 1e6
                                ? `R$ ${(val / 1e6).toFixed(1)}M`
                                : val >= 1e3
                                  ? `R$ ${(val / 1e3).toFixed(0)}k`
                                  : `R$ ${Math.round(val)}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "performance" && (
                  <div>
                    <h2 className="qbr-h2">Performance mensal</h2>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                      }}
                    >
                      <div className="qbr-card">
                        <h3 className="qbr-card-title">TPV mensal</h3>
                        <div className="qbr-chart-wrap">
                          {monthly.length ? (
                            <Bar
                              data={tpvChartData}
                              options={{
                                ...commonChartOptions,
                                scales: { x: scaleXY, y: scaleXY },
                              }}
                            />
                          ) : (
                            <div style={{ color: Y.gray, padding: 24 }}>—</div>
                          )}
                        </div>
                      </div>
                      <div className="qbr-card">
                        <h3 className="qbr-card-title">Transações mensais</h3>
                        <div className="qbr-chart-wrap">
                          {monthly.length ? (
                            <Bar
                              data={txnChartData}
                              options={{
                                ...commonChartOptions,
                                scales: { x: scaleXY, y: scaleXY },
                              }}
                            />
                          ) : (
                            <div style={{ color: Y.gray, padding: 24 }}>—</div>
                          )}
                        </div>
                      </div>
                    </div>
                    {trendAnalysisText ? (
                      <div className="qbr-trend" style={{ marginTop: 16 }}>
                        {trendAnalysisText}
                      </div>
                    ) : null}
                  </div>
                )}

                {activeTab === "merchants" && (
                  <div className="qbr-merch-grid">
                    <div>
                      <h2 className="qbr-h2">Destaques</h2>
                      {highlights.length === 0 ? (
                        <div style={{ color: Y.gray }}>—</div>
                      ) : (
                        highlights.map((m, i) => (
                          <div
                            key={i}
                            className="qbr-merch-card qbr-merch-card--hi"
                            style={{ marginBottom: 12 }}
                          >
                            <div style={{ fontWeight: 800, fontSize: 16 }}>
                              {m.name ?? "—"}
                            </div>
                            <div
                              style={{
                                fontSize: 22,
                                fontWeight: 800,
                                color: Y.blue,
                                marginTop: 6,
                              }}
                            >
                              {m.approvalRate ?? "—"}
                            </div>
                            <div style={{ fontSize: 12, color: Y.gray, marginTop: 4 }}>
                              {m.volume ?? "—"} · {m.transactions ?? "—"}
                            </div>
                            <p style={{ fontSize: 13, lineHeight: 1.5 }}>
                              {m.whyHighlight ?? ""}
                            </p>
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: Y.darkBlue,
                              }}
                            >
                              {m.opportunity ?? ""}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <div>
                      <h2 className="qbr-h2">Alertas</h2>
                      {alerts.length === 0 ? (
                        <div style={{ color: Y.gray }}>—</div>
                      ) : (
                        alerts.map((m, i) => (
                          <div
                            key={i}
                            className="qbr-merch-card qbr-merch-card--alert"
                            style={{ marginBottom: 12 }}
                          >
                            <div style={{ fontWeight: 800, fontSize: 16 }}>
                              {m.name ?? "—"}
                            </div>
                            <div
                              style={{
                                fontSize: 22,
                                fontWeight: 800,
                                color: Y.crit,
                                marginTop: 6,
                              }}
                            >
                              {m.approvalRate ?? "—"}
                            </div>
                            <div style={{ fontSize: 12, color: Y.gray, marginTop: 4 }}>
                              {m.volume ?? "—"} · {m.transactions ?? "—"}
                            </div>
                            <p style={{ fontSize: 13 }}>{m.whyAlert ?? ""}</p>
                            <p style={{ fontSize: 12, color: Y.gray }}>
                              {m.rootCause ?? ""}
                            </p>
                            <p style={{ fontSize: 13, fontWeight: 600 }}>
                              {m.suggestion ?? ""}
                            </p>
                            <p
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: Y.darkBlue,
                              }}
                            >
                              {m.potentialImpact ?? ""}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "declines" && (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1.2fr",
                        gap: 16,
                        alignItems: "start",
                      }}
                    >
                      <div className="qbr-card">
                        <h3 className="qbr-card-title">Distribuição (top 6)</h3>
                        <div className="qbr-chart-wrap qbr-chart-wrap--doughnut">
                          {declineCodes.length ? (
                            <Doughnut
                              data={doughnutData}
                              options={{
                                ...commonChartOptions,
                                cutout: "58%",
                                plugins: {
                                  ...commonChartOptions.plugins,
                                  legend: {
                                    position: "bottom",
                                    labels: { color: Y.gray, font: chartFont },
                                  },
                                },
                              }}
                            />
                          ) : (
                            <div style={{ color: Y.gray, padding: 24 }}>—</div>
                          )}
                        </div>
                      </div>
                      <div className="qbr-card">
                        <h3 className="qbr-card-title">Por código</h3>
                        <div className="qbr-chart-wrap">
                          {declineCodes.length ? (
                            <Bar
                              data={declineBarData}
                              options={{
                                ...commonChartOptions,
                                indexAxis: "y",
                                scales: { x: scaleXY, y: scaleXY },
                              }}
                            />
                          ) : (
                            <div style={{ color: Y.gray }}>—</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      className="qbr-stat-grid-3"
                      style={{ marginTop: 16 }}
                    >
                      <div className="qbr-card" style={{ textAlign: "center" }}>
                        <div
                          style={{ color: Y.gray, fontSize: 11, fontWeight: 700 }}
                        >
                          Total recusado
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            marginTop: 8,
                            color: Y.darkBlue,
                          }}
                        >
                          {kpis?.declinedVolume ?? "—"}
                        </div>
                      </div>
                      <div className="qbr-card" style={{ textAlign: "center" }}>
                        <div
                          style={{ color: Y.gray, fontSize: 11, fontWeight: 700 }}
                        >
                          Transações recusadas
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            marginTop: 8,
                            color: Y.darkBlue,
                          }}
                        >
                          {declinedTxSum.toLocaleString("pt-BR")}
                        </div>
                      </div>
                      <div className="qbr-card" style={{ textAlign: "center" }}>
                        <div
                          style={{ color: Y.gray, fontSize: 11, fontWeight: 700 }}
                        >
                          Códigos
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            marginTop: 8,
                            color: Y.darkBlue,
                          }}
                        >
                          {declineCodes.length}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "issues" && (
                  <div className="qbr-issues-panel">
                    {!issuesData?.totalTickets ? (
                      <div className="qbr-card">
                        <p style={{ color: Y.gray, margin: 0 }}>
                          Nenhum CSV de issues Jira foi carregado neste relatório.
                          Na geração, anexe o ficheiro opcional &quot;Issues Jira&quot;
                          para ver KPIs, análise e tabelas aqui.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="qbr-issues-kpi-strip">
                          <div
                            className="qbr-issues-kpi-cell"
                            style={{ borderTopColor: Y.ok }}
                          >
                            <div className="qbr-kpi-label">Total tickets</div>
                            <div className="qbr-kpi-value">
                              {issuesData.totalTickets}
                            </div>
                          </div>
                          <div
                            className="qbr-issues-kpi-cell"
                            style={{
                              borderTopColor:
                                issuesData.summary.totalOpen > 5
                                  ? Y.crit
                                  : Y.ok,
                            }}
                          >
                            <div className="qbr-kpi-label">Abertos</div>
                            <div
                              className="qbr-kpi-value"
                              style={{
                                color:
                                  issuesData.summary.totalOpen > 5
                                    ? Y.crit
                                    : Y.black,
                              }}
                            >
                              {issuesData.summary.totalOpen}
                            </div>
                          </div>
                          <div
                            className="qbr-issues-kpi-cell"
                            style={{
                              borderTopColor:
                                issuesData.summary.highestOpen > 0
                                  ? Y.crit
                                  : Y.ok,
                            }}
                          >
                            <div className="qbr-kpi-label">
                              Highest abertos
                            </div>
                            <div
                              className="qbr-kpi-value"
                              style={{
                                color:
                                  issuesData.summary.highestOpen > 0
                                    ? Y.crit
                                    : Y.black,
                              }}
                            >
                              {issuesData.summary.highestOpen}
                            </div>
                          </div>
                          <div
                            className="qbr-issues-kpi-cell"
                            style={{ borderTopColor: Y.ok }}
                          >
                            <div className="qbr-kpi-label">
                              Merchants afetados
                            </div>
                            <div className="qbr-kpi-value">
                              {issuesData.merchantsAffected?.length ?? 0}
                            </div>
                          </div>
                        </div>

                        {issuesSummaryText ? (
                          <div className="qbr-issues-summary-ai">
                            {issuesSummaryText}
                          </div>
                        ) : null}

                        {issuesMetricsLinkText ? (
                          <div className="qbr-issues-metrics-link">
                            {issuesMetricsLinkText}
                          </div>
                        ) : null}

                        <h2 className="qbr-h2">Issues críticos abertos</h2>
                        <div className="qbr-table-wrap qbr-table-wrap--issues">
                          <table className="qbr-table qbr-table--issues">
                            <thead>
                              <tr>
                                <th>Ticket</th>
                                <th>Problema</th>
                                <th>Impacto</th>
                                <th>Merchant</th>
                                <th>Prioridade</th>
                                <th>Ação sugerida</th>
                              </tr>
                            </thead>
                            <tbody>
                              {issuesCriticalRows.length === 0 ? (
                                <tr>
                                  <td colSpan={6} style={{ color: Y.gray }}>
                                    —
                                  </td>
                                </tr>
                              ) : (
                                issuesCriticalRows.map((row, i) => {
                                  const pr = String(row.priority ?? "").trim();
                                  const rowCls =
                                    pr === "Highest" ||
                                    pr === "" ||
                                    pr === "—"
                                      ? "qbr-issue-row--highest"
                                      : pr === "High"
                                        ? "qbr-issue-row--high"
                                        : "";
                                  return (
                                    <tr key={i} className={rowCls}>
                                      <td>{row.ticket}</td>
                                      <td>{row.problem}</td>
                                      <td>{row.impact}</td>
                                      <td>{row.merchant}</td>
                                      <td>
                                        <span
                                          className={`qbr-prio-badge ${
                                            pr === "Highest" ||
                                            pr === "" ||
                                            pr === "—"
                                              ? "qbr-prio-badge--crit"
                                              : pr === "High"
                                                ? "qbr-prio-badge--warn"
                                                : "qbr-prio-badge--neutral"
                                          }`}
                                        >
                                          {row.priority && row.priority !== "—"
                                            ? row.priority
                                            : "Highest"}
                                        </span>
                                      </td>
                                      <td>{row.suggestedAction}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div style={{ marginTop: 20 }}>
                          <button
                            type="button"
                            className="qbr-btn-toggle-tickets"
                            onClick={() =>
                              setShowAllIssueTickets((v) => !v)
                            }
                          >
                            {showAllIssueTickets
                              ? "Ocultar lista completa"
                              : `Ver todos os ${allIssueTickets.length} tickets`}
                          </button>
                        </div>

                        {showAllIssueTickets ? (
                          <div
                            className="qbr-table-wrap qbr-table-wrap--issues"
                            style={{ marginTop: 12 }}
                          >
                            <table className="qbr-table qbr-table--issues">
                              <thead>
                                <tr>
                                  <th>Ticket</th>
                                  <th>Status</th>
                                  <th>Problema</th>
                                  <th>Merchant</th>
                                  <th>Prioridade</th>
                                </tr>
                              </thead>
                              <tbody>
                                {allIssueTickets.map((t, i) => {
                                  const closed = !t.isOpen;
                                  const pr = t.priority;
                                  const rowCls = [
                                    closed ? "qbr-issue-row--closed" : "",
                                    !closed && pr === "Highest"
                                      ? "qbr-issue-row--highest"
                                      : "",
                                    !closed && pr === "High"
                                      ? "qbr-issue-row--high"
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ");
                                  return (
                                    <tr key={i} className={rowCls}>
                                      <td>{t.ticket}</td>
                                      <td>{t.status}</td>
                                      <td>{t.problem}</td>
                                      <td>{t.merchant}</td>
                                      <td>
                                        <span
                                          className={`qbr-prio-badge ${
                                            closed
                                              ? "qbr-prio-badge--closed"
                                              : pr === "Highest"
                                                ? "qbr-prio-badge--crit"
                                                : pr === "High"
                                                  ? "qbr-prio-badge--warn"
                                                  : "qbr-prio-badge--neutral"
                                          }`}
                                        >
                                          {t.priority}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                )}

                {activeTab === "nextsteps" && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      <h2 className="qbr-h2" style={{ marginBottom: 0 }}>
                        Próximos passos
                      </h2>
                      <button
                        type="button"
                        className="qbr-btn-export-trigger"
                        onClick={() => setShowExport(true)}
                      >
                        Selecionar e exportar
                      </button>
                    </div>
                    <div className="qbr-table-wrap">
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
                          {nextSteps.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ color: Y.gray }}>
                                —
                              </td>
                            </tr>
                          ) : (
                            nextSteps.map((s, i) => (
                              <tr key={i}>
                                <td>{s.priority ?? i + 1}</td>
                                <td>{s.action ?? "—"}</td>
                                <td>{s.owner ?? "—"}</td>
                                <td>{s.deadline ?? "—"}</td>
                                <td>{s.expectedImpact ?? "—"}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <footer className="qbr-footer">
                <span style={{ fontWeight: 800 }}>yuno</span>
                <span style={{ color: Y.gray }}>{genLabel}</span>
                <a href="https://www.y.uno">www.y.uno</a>
              </footer>
            </div>
          ) : (
            <div className="qbr-export">
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
                          : s.category ?? "—";
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
                      <div className="qbr-check-box">
                        {sel ? "✓" : ""}
                      </div>
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
                  <span style={{ fontSize: 13, color: Y.gray }}>
                    {selectedSteps.size} selecionada(s)
                  </span>
                  <button
                    type="button"
                    className="qbr-btn-pdf"
                    disabled={selectedSteps.size === 0}
                    onClick={handlePrint}
                  >
                    Baixar documento PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {printPortal}
    </>
  );
}
