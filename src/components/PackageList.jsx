export default function PackageList({ packages }) {
  if (!packages.length) {
    return (
      <div style={s.empty}>
        <p style={{ fontSize: 40 }}>📋</p>
        <p>Carregue o PDF do Circuit e a planilha da Shopee na aba <strong>Início</strong></p>
      </div>
    )
  }

  const matched = packages.filter(p => p.matched).length
  const total = packages.length

  return (
    <div style={s.page}>
      <div style={s.summary}>
        <div style={s.summaryBox}>
          <span style={s.summaryNum}>{matched}</span>
          <span style={s.summaryLabel}>cruzados</span>
        </div>
        <div style={{ ...s.summaryBox, borderColor: '#ffd6c0' }}>
          <span style={{ ...s.summaryNum, color: total - matched > 0 ? '#c62828' : '#bbb' }}>
            {total - matched}
          </span>
          <span style={s.summaryLabel}>sem parada</span>
        </div>
        <div style={s.summaryBox}>
          <span style={s.summaryNum}>{total}</span>
          <span style={s.summaryLabel}>total</span>
        </div>
      </div>

      <div style={s.list}>
        {packages.map((pkg, i) => (
          <div key={i} style={{ ...s.item, ...(pkg.matched ? {} : s.itemUnmatched) }}>
            <div style={{ ...s.stopBadge, background: pkg.matched ? '#1e88e5' : '#bbb' }}>
              {pkg.matched ? `#${pkg.stopNumber}` : '?'}
            </div>
            <div style={s.body}>
              <p style={s.addr}>{pkg.address}</p>
              {pkg.matched && pkg.groupStops?.length > 1 && (
                <p style={s.groupHint}>
                  📦 {pkg.groupStops.length} pacotes aqui: {pkg.groupStops.map(n => String(n).padStart(2, '0')).join(' - ')}
                </p>
              )}
              {pkg.matched && pkg.circuitAddress !== pkg.address && (
                <p style={s.circuitAddr}>Circuit: {pkg.circuitAddress}</p>
              )}
              <p style={s.code}>{pkg.spxTn}</p>
            </div>
            {pkg.matched && <span style={s.score}>{pkg.score}%</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  empty: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: 32, textAlign: 'center', color: '#888', fontSize: 15, lineHeight: 1.5,
  },
  summary: { display: 'flex', gap: 10, padding: '12px 14px', background: '#fff', borderBottom: '1px solid #eee', flexShrink: 0 },
  summaryBox: {
    flex: 1, border: '1px solid #e0f0ff', borderRadius: 10, padding: '8px 0',
    textAlign: 'center',
  },
  summaryNum: { display: 'block', fontSize: 24, fontWeight: 700, color: '#1e88e5' },
  summaryLabel: { fontSize: 11, color: '#888' },
  list: { flex: 1, overflowY: 'auto' },
  item: {
    display: 'flex', alignItems: 'center', padding: '10px 14px',
    borderBottom: '1px solid #f0f0f0', gap: 10, background: '#fff',
  },
  itemUnmatched: { background: '#fff9f9' },
  stopBadge: {
    flexShrink: 0, width: 48, height: 48, borderRadius: 10,
    color: '#fff', fontWeight: 700, fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  addr: { fontSize: 13, color: '#222', margin: 0, lineHeight: 1.3 },
  groupHint: { fontSize: 11, color: '#ef6c00', fontWeight: 700, margin: '2px 0 0' },
  circuitAddr: { fontSize: 11, color: '#1e88e5', margin: '2px 0 0', fontStyle: 'italic' },
  code: { fontSize: 11, color: '#999', fontFamily: 'monospace', margin: '3px 0 0' },
  score: { fontSize: 11, color: '#aaa', flexShrink: 0 },
}
