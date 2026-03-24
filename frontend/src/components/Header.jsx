const B = {
  blue: '#3E4FE0', blueDark: '#1726A6',
  black: '#282A30', gray: '#92959B', white: '#FFFFFF',
}

function DotsSymbol() {
  const dots = [
    [0,0,2.5],[1,0,2.5],[2,0,2],[3,0,2.5],
    [0,1,2.5],[1,1,3.5],[2,1,2.5],[3,1,2.5],
    [0,2,2],[1,2,2.5],[2,2,4],[3,2,2],
    [0,3,2.5],[1,3,2.5],[2,3,2.5],[3,3,2.5],
  ]
  return (
    <svg width="22" height="22" viewBox="0 0 36 36">
      {dots.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx*9+4} cy={cy*9+4} r={r} fill="#3E4FE0" />
      ))}
    </svg>
  )
}

export default function Header({ user, page, setPage }) {
  return (
    <header style={{
      background: B.black, borderBottom: `3px solid ${B.blue}`,
      padding: '0 32px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: 60,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <DotsSymbol />
        <span style={{ color: B.white, fontSize: 22, fontWeight: 600, letterSpacing: -0.5 }}>yuno</span>
        <div style={{ width: 1, height: 24, background: '#3a3f4a', margin: '0 8px' }} />
        <span style={{ color: B.gray, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2 }}>
          Partner Reports
        </span>
      </div>

      <nav style={{ display: 'flex', gap: 4 }}>
        {[
          { id: 'generate', label: '⚡ Gerar QBR' },
          { id: 'history', label: '🕓 Histórico' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setPage(id)} style={{
            padding: '6px 16px', borderRadius: 20, border: '1px solid',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: "'Titillium Web', sans-serif",
            background: page === id ? B.blue : 'transparent',
            borderColor: page === id ? B.blue : '#3a3f4a',
            color: page === id ? B.white : B.gray,
            transition: 'all .2s',
          }}>{label}</button>
        ))}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: B.blue,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: B.white,
        }}>{user.initials}</div>
        <div>
          <div style={{ color: B.white, fontSize: 12, fontWeight: 600 }}>{user.name}</div>
          <div style={{ color: B.gray, fontSize: 10 }}>{user.role}</div>
        </div>
      </div>
    </header>
  )
}