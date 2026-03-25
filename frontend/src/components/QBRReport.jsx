import { useCallback, useEffect, useMemo, useState } from "react";
import "./QBRReport.css";

const C = {
  primary: "#3E4FE0",
  darkBlue: "#1726A6",
  black: "#282A30",
  accent: "#E0ED80",
  lilac: "#E8EAF5",
  gray: "#92959B",
  lightBlue: "#788CFF",
  barBelow: "#c0c4d8",
  white: "#fff",
  red: "#e24b4a",
  amber: "#E0A020",
};

function parseMagnitude(str) {
  if (str == null || str === "") return 0;
  const s0 = String(str).trim();
  const upper = s0.toUpperCase();
  let mult = 1;
  if (/\bMM\b|\bM\b|MI\b|MI\s|milh|milhão|milhao/i.test(upper)) mult = 1e6;
  if (/\bBB\b|\bB\b|bilh/i.test(upper)) mult = 1e9;
  const s = s0.replace(/R\$\s*/gi, "").replace(/[^\d.,\-]/g, " ");
  const m = s.match(/[\d.,]+/);
  if (!m) return 0;
  let n = m[0];
  if (n.includes(",") && n.includes(".")) {
    if (n.lastIndexOf(",") > n.lastIndexOf("."))
      n = n.replace(/\./g, "").replace(",", ".");
    else n = n.replace(/,/g, "");
  } else if (n.includes(",")) n = n.replace(",", ".");
  const v = parseFloat(n);
  if (!Number.isFinite(v)) return 0;
  if (mult === 1 && /[\d.,]+\s*M\b/i.test(s0)) return v * 1e6;
  if (mult === 1 && /[\d.,]+\s*B\b/i.test(s0)) return v * 1e9;
  return v * mult;
}

function parseCount(str) {
  if (str == null || str === "") return 0;
  const s = String(str).replace(/[^\d.,]/g, " ").trim();
  const m = s.match(/[\d.,]+/);
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

/** @param {{ data: { label: string; value: number }[]; height?: number; barColor?: string; showValues?: boolean }} p */
export function renderBarChart(data, options = {}) {
  const height = options.height ?? 200;
  const w = 640;
  const pad = { l: 44, r: 16, t: 16, b: 40 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const vals = data.map((d) => d.value);
  const maxV = Math.max(...vals, 1);
  const n = data.length || 1;
  const slot = iw / n;
  const bw = slot * 0.62;
  const gap = slot * 0.38;
  const color = options.color || C.primary;
  const showValues = options.showValues !== false;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      {data.map((d, i) => {
        const h = (d.value / maxV) * ih;
        const x = pad.l + i * slot + gap / 2;
        const y = pad.t + ih - h;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw} height={h} fill={color} rx={4} />
            {showValues && h > 14 && (
              <text
                x={x + bw / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="10"
                fill={C.black}
              >
                {d.value >= 1e6
                  ? `${(d.value / 1e6).toFixed(1)}M`
                  : d.value >= 1e3
                    ? `${(d.value / 1e3).toFixed(0)}k`
                    : String(Math.round(d.value))}
              </text>
            )}
            <text
              x={x + bw / 2}
              y={height - 10}
              textAnchor="middle"
              fontSize="10"
              fill={C.gray}
            >
              {d.label.length > 10 ? d.label.slice(0, 9) + "…" : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SvgApprovalMonthly({ rows, benchmark = 70 }) {
  const height = 220;
  const w = 640;
  const pad = { l: 40, r: 20, t: 20, b: 36 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const n = Math.max(rows.length, 1);
  const slot = iw / n;
  const bw = slot * 0.62;
  const gap = slot * 0.38;
  const yAt = (v) => pad.t + ih * (1 - Math.min(100, Math.max(0, v)) / 100);
  const benchY = yAt(benchmark);

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      <line
        x1={pad.l}
        y1={benchY}
        x2={w - pad.r}
        y2={benchY}
        stroke={C.accent}
        strokeWidth={2}
        strokeDasharray="6 6"
      />
      {rows.map((r, i) => {
        const val = Math.min(
          100,
          Math.max(0, Number(r.approvalRate) || 0)
        );
        const y = yAt(val);
        const x = pad.l + i * slot + gap / 2;
        const col = val > benchmark ? C.primary : C.barBelow;
        return (
          <g key={`${r.month}-${i}`}>
            <rect
              x={x}
              y={y}
              width={bw}
              height={pad.t + ih - y}
              fill={col}
              rx={4}
            />
            <text
              x={x + bw / 2}
              y={height - 10}
              textAnchor="middle"
              fontSize="10"
              fill={C.gray}
            >
              {String(r.month || "").replace(/^(\d{4})-(\d{2})$/, "$2/$1")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SvgHorizontalBars({ items, height = 200 }) {
  const w = 640;
  const rowH = Math.max(28, Math.floor(height / Math.max(items.length, 1)));
  const h = Math.max(height, items.length * rowH + 24);
  const padL = 120;
  const padR = 80;
  const maxV = Math.max(...items.map((i) => i.value), 1);
  const barW = w - padL - padR;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      {items.map((it, idx) => {
        const y = 12 + idx * rowH;
        const bw = (it.value / maxV) * barW;
        return (
          <g key={it.label}>
            <text
              x={padL - 8}
              y={y + rowH / 2 + 4}
              textAnchor="end"
              fontSize="11"
              fill={C.black}
            >
              {it.label.length > 16
                ? it.label.slice(0, 15) + "…"
                : it.label}
            </text>
            <rect
              x={padL}
              y={y + 6}
              width={bw}
              height={rowH - 14}
              fill={it.color || C.primary}
              rx={4}
            />
            <text
              x={padL + bw + 8}
              y={y + rowH / 2 + 4}
              fontSize="10"
              fill={C.gray}
            >
              {it.sublabel || ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function normalizeCategory(cat) {
  const c = String(cat || "").toLowerCase();
  if (c.includes("urg")) return "urgente";
  if (c.includes("tecn") || c.includes("tech")) return "tecnico";
  if (c.includes("comerc") || c.includes("commercial")) return "comercial";
  return c;
}

function priorityTone(p) {
  const n = Number(p) || 99;
  if (n <= 2) return { bg: "#fef2f2", c: "#dc2626" };
  if (n <= 4) return { bg: "#fffbeb", c: "#d97706" };
  return { bg: "#eff6ff", c: "#2563eb" };
}

function declineTypeColor(t) {
  const x = String(t || "").toLowerCase();
  if (x.includes("soft")) return C.lightBlue;
  if (x.includes("hard")) return C.black;
  return C.amber;
}

export default function QBRReport({ report: rawReport, meta }) {
  const report = rawReport && typeof rawReport === "object" ? rawReport : {};
  const kpis = report.kpis || {};
  const monthly = Array.isArray(report.monthlyPerformance)
    ? report.monthlyPerformance
    : [];
  const filteredMonthly = useMemo(
    () =>
      monthly.filter((r) => /^\d{4}-\d{2}$/.test(String(r.month || "").trim())),
    [monthly]
  );

  const [tab, setTab] = useState("overview");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState("all");
  const nextSteps = Array.isArray(report.nextSteps) ? report.nextSteps : [];
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    setSelected(new Set(nextSteps.map((_, i) => i)));
  }, [nextSteps]);

  const toggle = useCallback((i) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(nextSteps.map((_, i) => i)));
  }, [nextSteps]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const filteredSteps = useMemo(() => {
    return nextSteps
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => {
        if (exportFilter === "all") return true;
        return normalizeCategory(s.category) === exportFilter;
      });
  }, [nextSteps, exportFilter]);

  const selectedCount = selected.size;
  const totalSteps = nextSteps.length;

  const declineCodes = Array.isArray(report.declineCodes)
    ? report.declineCodes
    : [];
  const topDeclines = useMemo(() => {
    const sorted = [...declineCodes].sort(
      (a, b) => (Number(b.pctOfDeclines) || 0) - (Number(a.pctOfDeclines) || 0)
    );
    return sorted.slice(0, 5);
  }, [declineCodes]);

  const declineAgg = useMemo(() => {
    let soft = 0,
      hard = 0,
      op = 0;
    for (const d of declineCodes) {
      const t = String(d.type || "").toLowerCase();
      const v = parseMagnitude(d.estimatedLostVolume);
      if (t.includes("soft")) soft += v;
      else if (t.includes("hard")) hard += v;
      else op += v;
    }
    return { soft, hard, op };
  }, [declineCodes]);

  const declinedTxTotal = useMemo(() => {
    return declineCodes.reduce((acc, d) => acc + parseCount(d.total), 0);
  }, [declineCodes]);

  const tpvData = useMemo(
    () =>
      filteredMonthly.map((r) => ({
        label: r.month,
        value: parseMagnitude(r.totalVolume),
      })),
    [filteredMonthly]
  );

  const txnData = useMemo(
    () =>
      filteredMonthly.map((r) => ({
        label: r.month,
        value: parseCount(r.transactions),
      })),
    [filteredMonthly]
  );

  const halftoneShadow = useMemo(() => {
    const parts = [];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (r === 0 && c === 0) continue;
        parts.push(`${c * 11}px ${r * 11}px 0 rgba(255,255,255,0.15)`);
      }
    }
    return parts.join(", ");
  }, []);

  const partnerName = report.partner || meta?.partnerName || "Partner";
  const period = report.period || meta?.period || "—";
  const generatedAt =
    report.generatedAt || meta?.generatedAt || new Date().toISOString();
  const genLabel = new Date(generatedAt).toLocaleString("pt-BR");

  const execSummary = Array.isArray(report.executiveSummary)
    ? report.executiveSummary
    : [];

  const openExport = () => {
    setExportOpen(true);
    setExportFilter("all");
  };

  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    { id: "overview", label: "Visão Geral" },
    { id: "performance", label: "Performance" },
    { id: "merchants", label: "Merchants" },
    { id: "declines", label: "Rejeições" },
    { id: "next", label: "Próximos Passos" },
  ];

  return (
    <div className="qbr-shell">
      <header
        style={{
          position: "relative",
          overflow: "hidden",
          background: C.primary,
          color: C.white,
          padding: "24px 28px 28px",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 20,
            right: 32,
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            boxShadow: halftoneShadow,
          }}
        />
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            opacity: 0.9,
            marginBottom: 8,
          }}
        >
          Partner Performance Report
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{partnerName}</h1>
        <p style={{ margin: "8px 0 0", fontSize: 16, opacity: 0.92 }}>{period}</p>
      </header>

      <nav
        className="nav-bar"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0,
          background: C.black,
          padding: "0 8px",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              flex: "1 1 auto",
              minWidth: 100,
              padding: "12px 10px",
              border: "none",
              background: tab === t.id ? C.primary : "transparent",
              color: C.white,
              fontSize: 12,
              fontWeight: tab === t.id ? 700 : 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {exportOpen && (
        <div
          className="export-step"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "#fff",
            overflow: "auto",
            padding: "20px 24px 100px",
          }}
        >
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
            }}
          >
            <button
              type="button"
              className="qbr-no-print"
              onClick={() => setExportOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                color: C.primary,
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
                marginBottom: 16,
                fontFamily: "inherit",
              }}
            >
              ← Voltar ao relatório
            </button>
            <div style={{ fontSize: 13, color: C.gray, marginBottom: 8 }}>
              {selectedCount} de {totalSteps} ações selecionadas
            </div>
            <h2 className="qbr-h2" style={{ fontSize: 18, marginBottom: 16 }}>
              Selecione as ações para incluir
            </h2>

            <div
              className="filter-bar"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
                alignItems: "center",
              }}
            >
              {[
                { id: "all", label: "Todos" },
                { id: "urgente", label: "Urgente" },
                { id: "tecnico", label: "Técnico" },
                { id: "comercial", label: "Comercial" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setExportFilter(f.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: `1px solid ${exportFilter === f.id ? C.primary : "#e5e5e5"}`,
                    background: exportFilter === f.id ? C.lilac : "#fff",
                    color: C.black,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {f.label}
                </button>
              ))}
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={selectAll}
                className="qbr-no-print"
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `1px solid ${C.primary}`,
                  background: "#fff",
                  color: C.primary,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="qbr-no-print"
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "#fff",
                  color: C.gray,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Desmarcar todos
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredSteps.map(({ s, idx }) => {
                const isSel = selected.has(idx);
                const tone = priorityTone(s.priority);
                const cat = normalizeCategory(s.category);
                const catLabel =
                  cat === "urgente"
                    ? "Urgente"
                    : cat === "tecnico"
                      ? "Técnico"
                      : cat === "comercial"
                        ? "Comercial"
                        : String(s.category || "—");
                return (
                  <div
                    key={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(idx);
                      }
                    }}
                    className={`cl-item ${isSel ? "selected" : ""}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 16px",
                      border: "1px solid #eee",
                      borderRadius: 10,
                      cursor: "pointer",
                      background: isSel ? "#fafbff" : "#fff",
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: `2px solid ${isSel ? C.primary : "#ccc"}`,
                        background: isSel ? C.primary : "#fff",
                        flexShrink: 0,
                        marginTop: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {isSel ? "✓" : ""}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 26,
                            height: 26,
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 800,
                            background: tone.bg,
                            color: tone.c,
                          }}
                        >
                          {s.priority ?? idx + 1}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: C.black }}>
                          {s.action || "Ação"}
                        </span>
                      </div>
                      {s.description ? (
                        <div style={{ fontSize: 12, color: C.gray, marginTop: 6, lineHeight: 1.45 }}>
                          {s.description}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 8 }}>
                        {(s.owner || "—") +
                          " · " +
                          (s.deadline || "—") +
                          " · " +
                          catLabel}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.darkBlue,
                        textAlign: "right",
                        maxWidth: 120,
                        flexShrink: 0,
                      }}
                    >
                      {s.expectedImpact || "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                background: "#fff",
                borderTop: "1px solid #eee",
                padding: "12px 20px 16px",
                zIndex: 2010,
              }}
              className="qbr-no-print"
            >
              <div
                style={{
                  maxWidth: 720,
                  margin: "0 auto 12px",
                  padding: "10px 12px",
                  background: "#fafafa",
                  borderLeft: "2px solid #e0e0e0",
                  fontSize: 10,
                  color: "#aaa",
                  lineHeight: 1.45,
                }}
              >
                Aviso sobre geração por IA — Este relatório foi produzido com auxílio de
                inteligência artificial a partir dos dados exportados da plataforma Yuno. Os
                números e métricas refletem os dados originais fornecidos. As análises e
                recomendações foram geradas automaticamente e devem ser revisadas pelo Partner
                Manager antes da apresentação ao parceiro.
              </div>
              <div
                style={{
                  maxWidth: 720,
                  margin: "0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 13, color: C.gray }}>
                  {selectedCount} selecionada(s)
                </span>
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={handlePrint}
                  style={{
                    padding: "10px 22px",
                    borderRadius: 8,
                    border: "none",
                    background:
                      selectedCount === 0 ? "#e5e5e5" : `linear-gradient(135deg,${C.primary},${C.darkBlue})`,
                    color: selectedCount === 0 ? "#999" : "#fff",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: selectedCount === 0 ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Baixar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tab-content" style={{ padding: "24px 28px 32px" }}>
        {tab === "overview" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h2 className="qbr-h2" style={{ marginBottom: 0 }}>
                Visão geral
              </h2>
              <button
                type="button"
                className="qbr-no-print"
                onClick={openExport}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: `linear-gradient(135deg,${C.primary},${C.darkBlue})`,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Gerar relatório
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              {[
                {
                  label: "Total TPV",
                  value: kpis.totalTPV || "—",
                  delta: kpis.tpvGrowth || "—",
                  deltaPos: true,
                },
                {
                  label: "Transações",
                  value: kpis.totalTransactions || "—",
                  delta: "",
                },
                {
                  label: "Approval rate",
                  value: kpis.approvalRate || "—",
                  delta: "",
                },
                {
                  label: "Volume recusado",
                  value: kpis.declinedVolume || "—",
                  delta: kpis.topOpportunity || "",
                  deltaPos: true,
                },
              ].map((c) => (
                <div
                  key={c.label}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 8,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: C.gray,
                    }}
                  >
                    {c.label}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 20,
                      fontWeight: 700,
                      color: C.darkBlue,
                    }}
                  >
                    {c.value}
                  </div>
                  {c.delta ? (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: c.deltaPos ? "#16a34a" : C.gray,
                      }}
                    >
                      {c.delta}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 20,
                background: C.black,
                color: C.white,
                borderRadius: 10,
                padding: "20px 22px",
                marginBottom: 24,
              }}
            >
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 6 }}>
                  Volume recusado
                </div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {kpis.declinedVolume || "—"}
                </div>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontSize: 11, color: C.accent, marginBottom: 6 }}>
                  Maior oportunidade
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>
                  {(report.top3Opportunities && report.top3Opportunities[0]?.lostVolume) ||
                    kpis.topOpportunity ||
                    "—"}
                </div>
              </div>
            </div>

            {execSummary.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 className="qbr-h2">Sumário executivo</h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                  {execSummary.slice(0, 5).map((row, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>
                      <strong style={{ color: C.darkBlue }}>{row.label}:</strong>{" "}
                      {row.value} — {row.context}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <h3 className="qbr-h2">Taxa de aprovação por mês vs benchmark 70%</h3>
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              {filteredMonthly.length ? (
                <SvgApprovalMonthly rows={filteredMonthly} benchmark={70} />
              ) : (
                <div style={{ color: C.gray, fontSize: 13 }}>Sem dados mensais.</div>
              )}
            </div>
          </div>
        )}

        {tab === "performance" && (
          <div>
            <h2 className="qbr-h2">Performance</h2>
            <h3 className="qbr-h2" style={{ fontSize: 13 }}>
              TPV mensal
            </h3>
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 20 }}>
              {tpvData.length ? renderBarChart(tpvData, { height: 200 }) : (
                <div style={{ color: C.gray }}>—</div>
              )}
            </div>
            <h3 className="qbr-h2" style={{ fontSize: 13 }}>
              Transações mensais
            </h3>
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 20 }}>
              {txnData.length ? renderBarChart(txnData, { height: 200, color: C.darkBlue }) : (
                <div style={{ color: C.gray }}>—</div>
              )}
            </div>
            {report.trendAnalysis ? (
              <div
                style={{
                  background: "#fafafa",
                  borderLeft: "3px solid #E0ED80",
                  padding: "14px 16px",
                  fontSize: 12,
                  lineHeight: 1.55,
                  marginBottom: 24,
                }}
              >
                {report.trendAnalysis}
              </div>
            ) : null}

            {Array.isArray(report.paymentMethods) && report.paymentMethods.length > 0 && (
              <>
                <h3 className="qbr-h2">Por método de pagamento</h3>
                <div className="qbr-table-wrap">
                  <table className="qbr-table">
                    <thead>
                      <tr>
                        <th>Método</th>
                        <th>Transações</th>
                        <th>Taxa aprov.</th>
                        <th>Volume</th>
                        <th>Ticket médio</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.paymentMethods.map((p, i) => (
                        <tr key={i}>
                          <td>{p.method}</td>
                          <td>{p.transactions}</td>
                          <td>{p.approvalRate != null ? `${p.approvalRate}%` : "—"}</td>
                          <td>{p.volume}</td>
                          <td>{p.avgTicket}</td>
                          <td>{p.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {report.paymentMethods.map(
                  (p, i) =>
                    (p.status === "attention" || p.status === "critical") && p.analysis ? (
                      <p
                        key={`a-${i}`}
                        style={{ fontSize: 12, color: C.black, lineHeight: 1.5, marginTop: 10 }}
                      >
                        <strong>{p.method}:</strong> {p.analysis}
                      </p>
                    ) : null
                )}
              </>
            )}

            {Array.isArray(report.growthOpportunities) &&
              report.growthOpportunities.length > 0 && (
                <>
                  <h3 className="qbr-h2" style={{ marginTop: 24 }}>
                    Oportunidades de crescimento
                  </h3>
                  {report.growthOpportunities.map((g, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 8,
                        padding: 14,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontWeight: 800, color: C.darkBlue, marginBottom: 8 }}>
                        {g.title}
                      </div>
                      <div style={{ fontSize: 12, marginBottom: 6 }}>{g.dataEvidence}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                        {g.revenuePotential}
                      </div>
                      <div style={{ fontSize: 12, color: C.gray }}>{g.suggestedAction}</div>
                    </div>
                  ))}
                </>
              )}
          </div>
        )}

        {tab === "merchants" && (
          <div>
            <h2 className="qbr-h2">Merchants</h2>
            <h3 className="qbr-h2">Destaques</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
                marginBottom: 24,
              }}
            >
              {(report.merchants?.highlights || []).map((m, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #eee",
                    borderLeft: `3px solid ${C.primary}`,
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{m.name}</div>
                  <div style={{ color: "#16a34a", fontWeight: 800, marginTop: 6 }}>
                    {m.approvalRate}
                  </div>
                  <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>
                    {m.volume} · {m.transactions}
                  </div>
                  <p style={{ fontSize: 12, marginTop: 10, lineHeight: 1.45 }}>{m.whyHighlight}</p>
                  <p style={{ fontSize: 12, color: C.darkBlue, fontWeight: 600 }}>
                    {m.opportunity}
                  </p>
                </div>
              ))}
            </div>
            <h3 className="qbr-h2">Alertas</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
              }}
            >
              {(report.merchants?.alerts || []).map((m, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #eee",
                    borderLeft: `3px solid ${C.red}`,
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{m.name}</div>
                  <div style={{ color: C.red, fontWeight: 800, marginTop: 6 }}>
                    {m.approvalRate}
                  </div>
                  <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>
                    {m.volume} · {m.transactions}
                  </div>
                  <p style={{ fontSize: 12, marginTop: 10 }}>{m.whyAlert}</p>
                  <p style={{ fontSize: 12, color: C.gray }}>{m.rootCause}</p>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{m.suggestion}</p>
                  <p style={{ fontSize: 11, color: C.darkBlue, fontWeight: 700 }}>
                    {m.potentialImpact}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "declines" && (
          <div>
            <h2 className="qbr-h2">Rejeições</h2>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 20,
                background: C.black,
                color: C.white,
                borderRadius: 10,
                padding: "20px 22px",
                marginBottom: 20,
              }}
            >
              <div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Total recusado (est.)</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                  {kpis.declinedVolume || "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Transações recusadas (soma códigos)</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                  {declinedTxTotal.toLocaleString("pt-BR")}
                </div>
              </div>
            </div>

            <h3 className="qbr-h2">Top 5 decline codes</h3>
            <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 20 }}>
              {topDeclines.length ? (
                <SvgHorizontalBars
                  items={topDeclines.map((d) => ({
                    label: d.code,
                    value: d.pctOfDeclines || 0,
                    color: declineTypeColor(d.type),
                    sublabel: `${d.pctOfDeclines ?? "—"}% · ${d.estimatedLostVolume || ""}`,
                  }))}
                  height={220}
                />
              ) : (
                <div style={{ color: C.gray }}>—</div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              {[
                { title: "Soft", v: declineAgg.soft, c: C.lightBlue },
                { title: "Hard", v: declineAgg.hard, c: C.black },
                { title: "Operational", v: declineAgg.op, c: C.amber },
              ].map((x) => (
                <div
                  key={x.title}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 8,
                    padding: 14,
                    borderTop: `3px solid ${x.c}`,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.gray }}>
                    {x.title}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>
                    {x.v >= 1e6
                      ? `R$ ${(x.v / 1e6).toFixed(1)}M`
                      : x.v >= 1e3
                        ? `R$ ${(x.v / 1e3).toFixed(0)}k`
                        : `R$ ${Math.round(x.v)}`}
                  </div>
                </div>
              ))}
            </div>

            {Array.isArray(report.top3Opportunities) &&
              report.top3Opportunities.length > 0 && (
                <>
                  <h3 className="qbr-h2" style={{ marginTop: 24 }}>
                    Top 3 oportunidades
                  </h3>
                  {report.top3Opportunities.map((o, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 8,
                        padding: 14,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{o.code}</div>
                      <div style={{ fontSize: 13, color: C.darkBlue, fontWeight: 700 }}>
                        {o.lostVolume}
                      </div>
                      <p style={{ fontSize: 12 }}>{o.whatIsHappening}</p>
                      <p style={{ fontSize: 12 }}>{o.suggestedAction}</p>
                      <p style={{ fontSize: 11, color: C.gray }}>{o.estimatedRecovery}</p>
                    </div>
                  ))}
                </>
              )}
          </div>
        )}

        {tab === "next" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 className="qbr-h2" style={{ marginBottom: 0 }}>
                Próximos passos
              </h2>
              <button
                type="button"
                className="qbr-no-print"
                onClick={openExport}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: `linear-gradient(135deg,${C.primary},${C.darkBlue})`,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Gerar relatório
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
                  {nextSteps.map((s, i) => (
                    <tr key={i}>
                      <td>{s.priority ?? i + 1}</td>
                      <td>{s.action}</td>
                      <td>{s.owner}</td>
                      <td>{s.deadline}</td>
                      <td>{s.expectedImpact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <footer
        style={{
          background: C.black,
          color: C.white,
          padding: "14px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          fontSize: 12,
        }}
      >
        <span style={{ fontWeight: 700 }}>yuno</span>
        <span style={{ color: C.gray }}>{genLabel}</span>
        <a href="https://www.y.uno" style={{ color: C.accent, fontWeight: 600 }}>
          www.y.uno
        </a>
      </footer>
    </div>
  );
}
