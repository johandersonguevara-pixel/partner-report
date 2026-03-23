import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchJson } from "../api.js";

export default function HistoryPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchJson("/api/history");
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: "1.35rem", marginTop: 0 }}>History</h1>
      <p className="muted" style={{ marginTop: "-0.25rem" }}>
        Reports generated in this environment (stored in <code>backend/data/history.json</code>).
      </p>

      <div className="card" style={{ marginTop: "1.25rem" }}>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : items.length === 0 ? (
          <p className="muted">No reports yet. Generate one from the home page.</p>
        ) : (
          items.map((row) => (
            <div key={row.id} className="list-row">
              <div>
                <Link to={`/history/${row.id}`}>{row.partnerName}</Link>
                <div className="muted" style={{ fontSize: "0.82rem" }}>
                  {new Date(row.createdAt).toLocaleString()} · {row.period}
                  {row.hasPdf ? " · PDF" : ""}
                </div>
              </div>
              <span className="muted" style={{ fontSize: "0.82rem" }}>
                {row.metricsSource}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
