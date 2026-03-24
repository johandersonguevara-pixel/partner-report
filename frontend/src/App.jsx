import { useState, useEffect } from 'react'
import GeneratePage from './pages/GeneratePage'
import HistoryPage from './pages/HistoryPage'
import Header from './components/Header'

const CURRENT_USER = {
  name: 'Johanderson Guevara',
  role: 'Partner Manager',
  initials: 'JG',
}

export default function App() {
  const [page, setPage] = useState('generate')
  const [history, setHistory] = useState([])

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/history`)
      .then(r => r.json())
      .then(data => setHistory(data.history || []))
      .catch(() => {})
  }, [])

  function addToHistory(entry) {
    setHistory(prev => [entry, ...prev])
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F6FA', fontFamily: "'Titillium Web', sans-serif" }}>
      <Header user={CURRENT_USER} page={page} setPage={setPage} />
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        {page === 'generate'
          ? <GeneratePage user={CURRENT_USER} onGenerated={addToHistory} />
          : <HistoryPage history={history} />
        }
      </main>
    </div>
  )
}