import { useEffect, useState } from "react";
import { fetchJson } from "../api.js";
import { simpleMarkdownToHtml } from "../markdown.js";

export default function GeneratePage() {
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState("");
  const [period, setPeriod] = useState("Last 30 days");
  const [includePdf, setIncludePdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchJson("/api/partners");
        if (cancelled) return;
        setPartners(list);
        if (list[0]?.id) setPartnerId((id) => id || list[0].id);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load partners");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await fetchJson("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          partnerId,
          period,
          includePdf,
        }),
      });
      setResult(data);
    } catch (e) {
      setError(e.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadPdf() {
    if (!result?.pdfBase64) return;
    const bin = atob(result.pdfBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partner-report-${result.partnerId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem", marginTop: 0 }}>New report</h1>
      <p className="muted" style={{ marginTop: "-0.25rem" }}>
        Pulls metrics (Metabase when configured) and drafts markdown via Claude when an API key is set.
      </p>

      <form className="card" onSubmit={onSubmit} style={{ marginTop: "1.25rem" }}>
        <div className="field">
          <label htmlFor="partner">Partner</label>
          <select
            id="partner"
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            required
          >
            {partners.length === 0 ? (
              <option value="">Loading…</option>
            ) : (
              partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.tier})
                </option>
              ))
            )}
          </select>
        </div>
        <div className="field">
          <label htmlFor="period">Period label</label>
          <input
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="e.g. Q1 2025"
          />
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1rem",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={includePdf}
            onChange={(e) => setIncludePdf(e.target.checked)}
          />
          <span className="muted">Include PDF (larger response)</span>
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={loading || !partnerId}>
          {loading ? "Generating…" : "Generate report"}
        </button>
      </form>

      {result ? (
        <section style={{ marginTop: "1.75rem" }} className="card">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: "0.75rem",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div>
              <strong>{result.partnerName}</strong>
              <span className="muted" style={{ marginLeft: "0.5rem" }}>
                {result.period} · {result.metricsSource}
              </span>
            </div>
            {result.pdfBase64 ? (
              <button type="button" className="btn btn-ghost" onClick={downloadPdf}>
                Download PDF
              </button>
            ) : null}
          </div>
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{
              __html: simpleMarkdownToHtml(result.reportMarkdown || ""),
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
