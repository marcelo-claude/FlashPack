import { useRef, useState } from 'react'
import { parseCircuitPDF } from '../utils/parseCircuit'
import { buildPackages } from '../utils/matchPackages'

export default function Upload({ onReady }) {
  const [circuit, setCircuit] = useState(null)
  const [circuitError, setCircuitError] = useState(null)
  const [loadingCircuit, setLoadingCircuit] = useState(false)
  const pdfRef = useRef()

  async function handlePDF(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setLoadingCircuit(true)
    setCircuitError(null)
    setCircuit(null)
    try {
      const stops = await parseCircuitPDF(file)
      if (!stops.some(s => s.spxTn)) {
        setCircuitError('Este PDF não contém os códigos SPX TN. No Circuit, ao exportar a rota, marque a opção "SPX TN" e gere o PDF novamente.')
        return
      }
      const pkgs = buildPackages(stops)
      setCircuit(pkgs)
      onReady(pkgs)
    } catch (err) {
      setCircuitError(err.message)
    } finally {
      setLoadingCircuit(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>⚡</div>
        <h1 style={s.title}>Flash Pack</h1>
        <p style={s.sub}>Escaneie pacotes pela rota do Circuit</p>
      </div>

      <div style={s.card}>
        <div style={s.cardHeader}>
          <span style={s.cardIcon}>📄</span>
          <div>
            <p style={s.cardTitle}>Rota do Circuit</p>
            <p style={s.cardDesc}>Exporte o PDF da rota com a coluna <strong>SPX TN</strong> marcada</p>
          </div>
          {circuit && <span style={s.ok}>✓ {circuit.length} paradas</span>}
        </div>
        <input ref={pdfRef} type="file" accept=".pdf" onChange={handlePDF} style={{ display: 'none' }} />
        <button style={{ ...s.btn, background: circuit ? '#e8f5e9' : '#1e88e5', color: circuit ? '#2e7d32' : '#fff' }}
          onClick={() => pdfRef.current.click()} disabled={loadingCircuit}>
          {loadingCircuit ? 'Lendo PDF...' : circuit ? '✓ PDF carregado — trocar' : 'Selecionar PDF'}
        </button>
        {circuitError && <p style={s.err}>⚠️ {circuitError}</p>}
      </div>

      {circuit ? (
        <div style={s.hint}>
          ✓ {circuit.length} paradas carregadas — vá para <strong>Pacotes</strong> ou <strong>Scanner</strong>
        </div>
      ) : (
        <div style={s.steps}>
          <p style={s.stepsTitle}>Como usar</p>
          <p style={s.step}>1. No Circuit, abra a rota do dia (já otimizada)</p>
          <p style={s.step}>2. Ao exportar o PDF, marque a opção <strong>SPX TN</strong></p>
          <p style={s.step}>3. Carregue o PDF aqui</p>
          <p style={s.step}>4. Vá para Scanner e leia o QR de cada pacote</p>
        </div>
      )}
    </div>
  )
}

const s = {
  page: { flex: 1, overflowY: 'auto', padding: '20px 16px 32px', background: '#f5f5f5' },
  header: { textAlign: 'center', marginBottom: 24 },
  logo: { fontSize: 48 },
  title: { fontSize: 30, fontWeight: 900, color: '#1565c0', margin: '4px 0 2px' },
  sub: { fontSize: 14, color: '#666' },
  card: {
    background: '#fff', borderRadius: 14, padding: 18,
    marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIcon: { fontSize: 28, flexShrink: 0 },
  cardTitle: { fontWeight: 700, fontSize: 16, margin: 0 },
  cardDesc: { fontSize: 13, color: '#888', margin: '2px 0 0' },
  ok: { marginLeft: 'auto', color: '#2e7d32', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  btn: {
    width: '100%', padding: '14px 0', borderRadius: 10,
    fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
  },
  err: {
    marginTop: 10, padding: '8px 12px', background: '#fff3f3',
    border: '1px solid #fcc', borderRadius: 8, color: '#c00', fontSize: 13, lineHeight: 1.5,
  },
  hint: {
    background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10,
    padding: '12px 16px', fontSize: 14, color: '#2e7d32', textAlign: 'center',
    marginBottom: 14,
  },
  steps: {
    background: '#fff', borderRadius: 14, padding: '16px 18px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  stepsTitle: { fontWeight: 700, fontSize: 14, color: '#444', marginBottom: 8 },
  step: { fontSize: 13, color: '#666', margin: '6px 0', lineHeight: 1.5 },
}
