import { useState, useEffect } from 'react'
import GeneratePage from './pages/GeneratePage'
import HistoryPage from './pages/HistoryPage'
import Header from './components/Header'
import { fetchJson } from './api.js'

const CURRENT_USER = {
  name: 'Johanderson Guevara',
  role: 'Partner Manager',
  initials: 'JG',
}

export default function App() {
  const [page, setPage] = useState('generate')
  const [history, setHistory] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await fetchJson('/api/history')
        const list = Array.isArray(rows) ? rows : []
        const mapped = list.map((h) => ({
          id: h.id,
          partner: h.partnerName ?? h.partner ?? '—',
          quarter: h.period ?? h.quarter ?? '—',
          region: h.region ?? '—',
          generated_by: h.generated_by ?? '—',
          generated_at:
            h.generated_at ??
            (h.createdAt ? new Date(h.createdAt).toLocaleString('pt-BR') : '—'),
          url: null,
          filename: null,
        }))
        if (!cancelled) setHistory(mapped)
      } catch {
        if (!cancelled) setHistory([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function addToHistory(entry) {
    setHistory(prev => [entry, ...prev])
  }

  return (
    <div
      className="app-layout-root"
      style={{
        minHeight: '100vh',
        background: '#fff9e0',
        fontFamily: "'Titillium Web', sans-serif",
      }}
    >
      <Header user={CURRENT_USER} page={page} setPage={setPage} />
      <main
        className="app-main"
        style={{
          maxWidth: page === 'generate' ? 1180 : 960,
          margin: '0 auto',
          padding: '32px 24px',
        }}
      >
        {page === 'generate'
          ? <GeneratePage user={CURRENT_USER} onGenerated={addToHistory} />
          : <HistoryPage history={history} />
        }
      </main>
    </div>
  )
}