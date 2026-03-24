const B = {
  blue: '#3E4FE0', blueDark: '#1726A6',
  black: '#282A30', lilac: '#E8EAF5',
  gray: '#92959B', white: '#FFFFFF',
}

export default function HistoryPage({ history }) {
  if (!history.length) {
    return (
      <div style={{ background:B.white, borderRadius:12, border:'1px solid #E8EAF5', padding:48, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>🕓</div>
        <div style={{ fontSize:15, fontWeight:600, color:B.black, marginBottom:8 }}>Nenhum documento gerado ainda</div>
        <div style={{ fontSize:13, color:B.gray }}>Os documentos gerados aparecerão aqui.</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:400, color:B.black }}>Histórico de Documentos</div>
          <div style={{ fontSize:12, color:B.gray, marginTop:2 }}>{history.length} documento{history.length!==1?'s':''} gerado{history.length!==1?'s':''}</div>
        </div>
      </div>
      <div style={{ background:B.white, borderRadius:12, border:'1px solid #E8EAF5', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#F5F6FA' }}>
              {['Parceiro','Quarter','Região','Gerado por','Data','Ações'].map(h => (
                <th key={h} style={{ padding:'11px 16px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5, color:B.gray, textAlign:'left', borderBottom:'1px solid #E8EAF5' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((item,i) => (
              <tr key={item.id||i} style={{ borderBottom:'1px solid #F5F6FA' }}>
                <td style={{ padding:'13px 16px', fontSize:13 }}><span style={{ fontWeight:700, color:B.black }}>{item.partner}</span></td>
                <td style={{ padding:'13px 16px' }}><span style={{ background:B.lilac, color:B.blueDark, padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:700 }}>{item.quarter}</span></td>
                <td style={{ padding:'13px 16px', fontSize:13, color:B.gray }}>{item.region}</td>
                <td style={{ padding:'13px 16px', fontSize:13, color:B.gray }}>{item.generated_by}</td>
                <td style={{ padding:'13px 16px', fontSize:11, color:B.gray }}>{item.generated_at}</td>
                <td style={{ padding:'13px 16px' }}>
                  {item.url
                    ? <a href={item.url} download={item.filename} style={{ display:'inline-block', padding:'5px 12px', background:`linear-gradient(135deg,${B.blue},${B.blueDark})`, color:B.white, borderRadius:6, fontSize:11, fontWeight:700, textDecoration:'none' }}>📥 PDF</a>
                    : <span style={{ fontSize:11, color:B.gray }}>—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}