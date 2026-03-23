import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchJson } from "../api.js";
import { simpleMarkdownToHtml } from "../markdown.js";

export default function HistoryDetailPage() {
  const { id } = useParams();
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJson(`/api/history/${id}`);
        if (!cancelled) setEntry(data);
      } catch (e) {
        if (!cancelled) setError(e.message || "Not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function downloadPdf() {
    if (!entry?.pdfBase64) return;
    const bin = atob(entry.pdfBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partner-report-${entry.partnerId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p className="muted">Loading…</p>;
  }
  if (error || !entry) {
    return (
      <div>
        <p className="error">{error || "Not found"}</p>
        <Link to="/history">← Back to history</Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/history" className="muted" style={{ fontSize: "0.9rem" }}>
        ← History
      </Link>
      <h1 style={{ fontSize: "1.35rem", marginTop: "0.75rem" }}>{entry.partnerName}</h1>
      <p className="muted" style={{ marginTop: "-0.25rem" }}>
        {new Date(entry.createdAt).toLocaleString()} · {entry.period} · {entry.metricsSource}
      </p>
      {entry.pdfBase64 ? (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: "0.75rem" }}
          onClick={downloadPdf}
        >
          Download PDF
        </button>
      ) : null}
      <section className="card markdown-body" style={{ marginTop: "1.25rem" }}>
        <div
          dangerouslySetInnerHTML={{
            __html: simpleMarkdownToHtml(entry.reportMarkdown || ""),
          }}
        />
      </section>
    </div>
  );
}
