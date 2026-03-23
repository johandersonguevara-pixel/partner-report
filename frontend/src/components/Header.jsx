import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }) =>
  isActive ? "nav-link nav-link-active" : "nav-link";

export default function Header() {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        marginBottom: "1.75rem",
        paddingBottom: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.15rem" }}>Partner report</div>
          <div className="muted" style={{ fontSize: "0.88rem" }}>
            Generate and review partner summaries
          </div>
        </div>
        <nav style={{ display: "flex", gap: "0.5rem" }}>
          <NavLink to="/" end className={linkClass}>
            Generate
          </NavLink>
          <NavLink to="/history" className={linkClass}>
            History
          </NavLink>
        </nav>
      </div>
      <style>{`
        .nav-link {
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          color: var(--muted);
          text-decoration: none !important;
          font-weight: 500;
        }
        .nav-link:hover {
          color: var(--text);
          background: rgba(255,255,255,0.06);
        }
        .nav-link-active {
          color: var(--text);
          background: rgba(110, 168, 254, 0.12);
        }
      `}</style>
    </header>
  );
}
