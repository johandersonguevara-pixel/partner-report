import { useState, useEffect, useRef } from 'react'
import { fetchJson, apiPath } from '../api.js'

const FALLBACK_PARTNERS = [
  { id: 'mercadopago-br', name: 'Mercado Pago', region: 'Brasil', tier: 'Strategic' },
  { id: 'getnet-br', name: 'Getnet', region: 'Brasil', tier: 'Tier 1' },
  { id: 'cielo-br', name: 'Cielo', region: 'Brasil', tier: 'Tier 1' },
  { id: 'clearsale-br', name: 'ClearSale', region: 'Brasil', tier: 'Tier 2' },
  { id: 'paypal-braintree', name: 'PayPal-Braintree', region: 'Global', tier: 'Strategic' },
  { id: 'picpay-br', name: 'PicPay', region: 'Brasil', tier: 'Tier 1' },
]

function normalizePartner(p) {
  return {
    id: p.id,
    name: p.name ?? '—',
    region: p.region ?? p.regiao ?? '—',
    tier: p.tier ?? 'Tier 2',
  }
}

const B = {
  blue: '#3E4FE0', blueDark: '#1726A6', blueLight: '#788CFF',
  black: '#282A30', green: '#E0ED80', lilac: '#E8EAF5',
  gray: '#92959B', grayDark: '#616366', white: '#FFFFFF',
}

const STEPS = [
  { icon: '📊', label: 'Buscando dados do Metabase' },
  { icon: '🧠', label: 'Claude analisando performance' },
  { icon: '✍️', label: 'Gerando narrativa e insights' },
  { icon: '📄', label: 'Montando documento PDF' },
  { icon: '📦', label: 'Exportando arquivo final' },
]

const QUARTERS = ['Q1 2025','Q2 2025','Q3 2025','Q4 2025','Q1 2026']

function TierBadge({ tier }) {
  const map = {
    Strategic: { bg: '#EEF0FD', c: '#3E4FE0' },
    'Tier 1':  { bg: '#f0fdf4', c: '#16a34a' },
    'Tier 2':  { bg: '#fefce8', c: '#ca8a04' },
  }
  const s = map[tier] || map['Tier 2']
  return <span style={{ fontSize:11, padding:'3px 8px', background:s.bg, color:s.c, borderRadius:6, fontWeight:700 }}>{tier}</span>
}

function Spinner() {
  return (
    <div style={{ width:16, height:16, border:`2px solid ${B.blue}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function PartnerAutocomplete({ value, onChange, disabled, partners }) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const [hi, setHi]       = useState(0)
  const inputRef          = useRef(null)

  const selected = partners.find(p => p.id === value)
  const q = query.trim().toLowerCase()
  const filtered =
    q === ''
      ? partners
      : partners.filter((p) => {
          const name = (p.name || '').toLowerCase()
          const region = (p.region || '').toLowerCase()
          const tier = (p.tier || '').toLowerCase()
          return name.includes(q) || region.includes(q) || tier.includes(q)
        })

  const displayValue = open ? query : (selected ? selected.name : '')

  function handleSelect(p) {
    onChange(p.id); setQuery(''); setOpen(false); inputRef.current?.blur()
  }

  return (
    <div style={{ position:'relative', marginBottom: selected ? 6 : 14 }}>
      <div style={{ position:'relative' }}>
        <input
          ref={inputRef}
          value={displayValue}
          onChange={e => { setQuery(e.target.value); setOpen(true); setHi(0); if(!e.target.value) onChange('') }}
          onFocus={() => { setOpen(true); setQuery('') }}
          onBlur={() => setTimeout(() => { setOpen(false); setQuery('') }, 150)}
          onKeyDown={e => {
            if (e.key==='ArrowDown') { e.preventDefault(); if (filtered.length) setHi(h => Math.min(h + 1, filtered.length - 1)) }
            if (e.key==='ArrowUp')   { e.preventDefault(); if (filtered.length) setHi(h => Math.max(h - 1, 0)) }
            if (e.key==='Enter' && filtered[hi]) handleSelect(filtered[hi])
            if (e.key==='Escape')    { setOpen(false); setQuery('') }
          }}
          disabled={disabled}
          placeholder="Digite para buscar parceiro..."
          style={{ width:'100%', padding:'9px 36px 9px 12px', background: selected&&!open?'#F0F2FF':'#F5F6FA', border:`1px solid ${selected?B.blue:open?B.blueLight:'#E8EAF5'}`, borderRadius:8, fontSize:13, color:B.black, fontFamily:'inherit', outline:'none' }}
        />
        <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', cursor: selected?'pointer':'default' }}
          onMouseDown={e => { e.preventDefault(); if(selected){ onChange(''); setQuery(''); inputRef.current?.focus() }}}>
          {selected && !open
            ? <span style={{ color:B.blue, fontSize:14, fontWeight:700 }}>×</span>
            : <span style={{ color:B.gray, fontSize:13 }}>🔍</span>}
        </div>
      </div>
      {open && (
        <div style={{ position:'absolute', zIndex:100, top:'calc(100% + 4px)', left:0, right:0, background:B.white, border:`1px solid ${B.blueLight}`, borderRadius:10, boxShadow:'0 8px 24px rgba(62,79,224,0.12)', overflow:'hidden', maxHeight:220, overflowY:'auto' }}>
          {filtered.length === 0
            ? <div style={{ padding:'12px 14px', fontSize:12, color:B.gray, textAlign:'center' }}>Nenhum parceiro encontrado</div>
            : filtered.map((p,i) => (
              <div key={p.id} onMouseDown={() => handleSelect(p)} onMouseEnter={() => setHi(i)}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', cursor:'pointer', background: i===hi?'#EEF0FD':B.white, borderBottom: i<filtered.length-1?'1px solid #F5F6FA':'none' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight: value===p.id?700:500, color:B.black }}>{p.name}</div>
                  <div style={{ fontSize:11, color:B.gray, marginTop:1 }}>{p.region}</div>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <TierBadge tier={p.tier}/>
                  {value===p.id && <span style={{ color:B.blue, fontSize:14, fontWeight:700 }}>✓</span>}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

export default function GeneratePage({ user, onGenerated }) {
  const [partners, setPartners] = useState([])
  const [partner, setPartner]   = useState('')
  const [quarter, setQuarter]   = useState('')
  const [status, setStatus]     = useState('idle')
  const [currentStep, setStep]  = useState(-1)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await fetchJson('/api/partners')
        const raw = Array.isArray(d) ? d : (d?.partners ?? [])
        const list = raw.map(normalizePartner).filter((p) => p.id)
        if (!cancelled) setPartners(list.length ? list : FALLBACK_PARTNERS.map(normalizePartner))
      } catch {
        if (!cancelled) setPartners(FALLBACK_PARTNERS.map(normalizePartner))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const sel = partners.find(p => p.id === partner)
  const can = partner && quarter && status !== 'loading'

  async function handleGenerate() {
    if (!can) return
    setStatus('loading'); setStep(0); setResult(null); setError('')

    const interval = setInterval(() => {
      setStep(s => { if (s >= STEPS.length - 2) { clearInterval(interval); return s } return s + 1 })
    }, 1800)

    try {
      const res = await fetch(apiPath('/api/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: sel.id,
          period: quarter,
          includePdf: true,
        }),
      })
      clearInterval(interval)
      const text = await res.text()
      let data
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        if (!res.ok) {
          throw new Error(
            text?.trim()?.slice(0, 180) || `Falha na API (${res.status}). Confirme VITE_API_URL e se o backend está no ar.`
          )
        }
        throw new Error('Resposta inválida do servidor')
      }
      if (!res.ok) {
        throw new Error(
          data?.error || `Erro ao gerar documento (${res.status}). Ver consola do backend.`
        )
      }

      let blob
      let filename = `Yuno_PartnerReport_${sel.name.replace(/\s/g, '_')}_${quarter.replace(/\s/g, '_')}.pdf`
      if (data.pdfBase64) {
        const bin = atob(data.pdfBase64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        blob = new Blob([bytes], { type: 'application/pdf' })
      } else {
        blob = new Blob([data.reportMarkdown || ''], { type: 'text/markdown;charset=utf-8' })
        filename = filename.replace(/\.pdf$/i, '.md')
      }
      const url = URL.createObjectURL(blob)
      const entry = {
        id: data.id || Date.now(),
        partner: data.partnerName || sel.name,
        region: sel.region,
        quarter: data.period || quarter,
        generated_by: user.name,
        generated_at: new Date().toLocaleString('pt-BR'),
        url,
        filename,
      }

      setStep(STEPS.length - 1)
      setTimeout(() => {
        setResult(entry)
        setStatus('done')
        onGenerated(entry)
      }, 600)
    } catch (err) {
      clearInterval(interval)
      setError(err.message || 'Erro inesperado')
      setStatus('error'); setStep(-1)
    }
  }

  function reset() { setStatus('idle'); setStep(-1); setResult(null); setError(''); setPartner(''); setQuarter('') }

  const labelStyle = { display:'block', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:1.5, color:B.grayDark, marginBottom:6 }
  const selectStyle = (v) => ({ width:'100%', padding:'9px 12px', marginBottom:16, background:'#F5F6FA', border:`1px solid ${v?B.blue:'#E8EAF5'}`, borderRadius:8, fontSize:13, color:B.black, fontFamily:'inherit', outline:'none' })

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:22, fontWeight:400, color:B.black, marginBottom:4 }}>
          Olá, <strong>{user.name.split(' ')[0]}</strong> 👋
        </div>
        <div style={{ fontSize:13, color:B.gray }}>Selecione um parceiro e quarter para gerar o Partner Performance Report.</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:24, alignItems:'start' }}>
        <div style={{ background:B.white, borderRadius:12, border:'1px solid #E8EAF5', overflow:'visible' }}>
          <div style={{ background:`linear-gradient(135deg,${B.blue},${B.blueDark})`, padding:'16px 20px', borderRadius:'12px 12px 0 0' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.6)', letterSpacing:2, textTransform:'uppercase', marginBottom:3 }}>Configurar</div>
            <div style={{ fontSize:17, fontWeight:400, color:B.white }}>Novo Documento</div>
          </div>
          <div style={{ padding:20, overflow:'visible' }}>
            <label style={labelStyle}>Parceiro</label>
            <PartnerAutocomplete
              value={partner}
              onChange={(v) => {
                setPartner(v)
                setStatus('idle')
                setStep(-1)
                setResult(null)
                setError('')
              }}
              disabled={status === 'loading'}
              partners={partners}
            />
            {sel && <div style={{ display:'flex', gap:6, marginBottom:14 }}><TierBadge tier={sel.tier}/><span style={{ fontSize:11, color:B.gray, padding:'3px 8px', background:'#F5F6FA', borderRadius:6 }}>{sel.region}</span></div>}

            <label style={labelStyle}>Quarter</label>
            <select value={quarter} onChange={e => { setQuarter(e.target.value); setStatus('idle'); setStep(-1); setResult(null) }} disabled={status==='loading'} style={selectStyle(quarter)}>
              <option value="">Selecionar quarter...</option>
              {QUARTERS.map(q => <option key={q}>{q}</option>)}
            </select>

            <button onClick={handleGenerate} disabled={!can} style={{ width:'100%', padding:11, borderRadius:8, border:'none', cursor:can?'pointer':'not-allowed', background:can?`linear-gradient(135deg,${B.blue},${B.blueDark})`:'#E8EAF5', color:can?B.white:B.gray, fontSize:13, fontWeight:700, fontFamily:'inherit', transition:'all .2s' }}>
              {status==='loading' ? '⏳ Gerando...' : '📋 Gerar Documento QBR'}
            </button>

            {status==='error' && <div style={{ marginTop:12, padding:'10px 12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, fontSize:12, color:'#dc2626' }}>❌ {error}</div>}
          </div>
        </div>

        <div>
          {status==='idle' && (
            <div style={{ background:B.white, borderRadius:12, border:'1px solid #E8EAF5', padding:40, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:16 }}>📋</div>
              <div style={{ fontSize:15, fontWeight:600, color:B.black, marginBottom:8 }}>Nenhum documento gerado ainda</div>
              <div style={{ fontSize:13, color:B.gray, lineHeight:1.7 }}>Selecione um parceiro e quarter ao lado<br/>para gerar o Partner Performance Report.</div>
              <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:24, flexWrap:'wrap' }}>
                {['Análise de Performance','Insights com IA','Oportunidades','Próximos Passos'].map(f => (
                  <span key={f} style={{ fontSize:11, padding:'4px 10px', background:'#E8EAF5', borderRadius:20, color:B.blue, fontWeight:600 }}>{f}</span>
                ))}
              </div>
            </div>
          )}

          {status==='loading' && (
            <div style={{ background:B.white, borderRadius:12, border:'1px solid #E8EAF5', padding:28 }}>
              <div style={{ fontSize:13, fontWeight:600, color:B.black, marginBottom:20 }}>🤖 Processando com IA...</div>
              {STEPS.map((s,i) => {
                const isDone=i<currentStep, isActive=i===currentStep, isPending=i>currentStep
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:i<STEPS.length-1?'1px solid #F5F6FA':'none', opacity:isPending?0.3:1, transition:'opacity .3s' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:isDone?13:16, background:isDone?'#f0fdf4':isActive?'#EEF0FD':'#F5F6FA', border:`2px solid ${isDone?'#16a34a':isActive?B.blue:'#E8EAF5'}` }}>
                      {isDone ? '✓' : s.icon}
                    </div>
                    <span style={{ fontSize:13, color:isActive?B.black:B.grayDark, fontWeight:isActive?600:400 }}>{s.label}</span>
                    {isActive && <div style={{ marginLeft:'auto' }}><Spinner/></div>}
                    {isDone && <div style={{ marginLeft:'auto', fontSize:11, color:'#16a34a', fontWeight:600 }}>✓ Concluído</div>}
                  </div>
                )
              })}
            </div>
          )}

          {status==='done' && result && (
            <div style={{ background:B.white, borderRadius:12, border:'1px solid #bbf7d0', overflow:'hidden' }}>
              <div style={{ background:'#f0fdf4', padding:'14px 20px', borderBottom:'1px solid #bbf7d0', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'#16a34a', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:16 }}>✓</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#15803d' }}>Documento gerado com sucesso!</div>
                  <div style={{ fontSize:11, color:'#16a34a' }}>{result.generated_at}</div>
                </div>
              </div>
              <div style={{ padding:20 }}>
                <div style={{ background:'#F5F6FA', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
                  {[['Parceiro',result.partner],['Quarter',result.quarter],['Região',result.region]].map(([k,v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                      <span style={{ color:B.gray }}>{k}</span>
                      <span style={{ fontWeight:600, color:B.black }}>{v}</span>
                    </div>
                  ))}
                </div>
                <a href={result.url} download={result.filename} style={{ display:'block', width:'100%', padding:11, background:`linear-gradient(135deg,${B.blue},${B.blueDark})`, color:B.white, borderRadius:8, textAlign:'center', fontSize:13, fontWeight:700, textDecoration:'none', marginBottom:10 }}>
                  📥 Baixar PDF
                </a>
                <button onClick={reset} style={{ width:'100%', padding:9, background:'transparent', border:'1px solid #E8EAF5', borderRadius:8, fontSize:12, fontWeight:600, color:B.gray, cursor:'pointer', fontFamily:'inherit' }}>
                  + Gerar novo documento
                </button>
              </div>
            </div>
          )}

          {status==='error' && (
            <div style={{ background:'#fef2f2', borderRadius:12, border:'1px solid #fecaca', padding:32, textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#991b1b', marginBottom:8 }}>Erro ao gerar o documento</div>
              <button onClick={reset} style={{ padding:'9px 20px', background:'#dc2626', color:'white', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Tentar novamente</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}