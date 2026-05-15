import { useRef, useState } from 'react'
import { parseCircuitPDF } from '../utils/parseCircuit'
import { parseShopeeXLSX } from '../utils/parseShopee'
import { matchPackages } from '../utils/matchPackages'

export default function Upload({ onReady }) {
  const [circuit, setCircuit] = useState(null)
  const [shopee, setShopee] = useState(null)
  const [circuitError, setCircuitError] = useState(null)
  const [shopeeError, setShopeeError] = useState(null)
  const [loadingCircuit, setLoadingCircuit] = useState(false)
  const [loadingShopee, setLoadingShopee] = useState(false)
  const pdfRef = useRef()
  const xlsxRef = useRef()

  async function handlePDF(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setLoadingCircuit(true)
    setCircuitError(null)
    try {
      const stops = await parseCircuitPDF(file)
      setCircuit(stops)
      if (shopee) cruzar(stops, shopee)
    } catch (err) {
      setCircuitError(err.message)
    } finally {
      setLoadingCircuit(false)
    }
  }

  async function handleXLSX(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setLoadingShopee(true)
    setShopeeError(null)
    try {
      const pkgs = await parseShopeeXLSX(file)
      setShopee(pkgs)
      if (circuit) cruzar(circuit, pkgs)
    } catch (err) {
      setShopeeError(err.message)
    } finally {
      setLoadingShopee(false)
    }
  }

  function cruzar(stops, pkgs) {
    const matched = matchPackages(stops, pkgs)
    onReady(matched)
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>⚡</div>
        <h1 style={s.title}>Flash Pack</h1>
        <p style={s.sub}>Escaneie pacotes pela rota do Circuit</p>
      </div>

      {/* PDF do Circuit */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <span style={s.cardIcon}>📄</span>
          <div>
            <p style={s.cardTitle}>Rota do Circuit</p>
            <p style={s.cardDesc}>Exporte o PDF da rota no app Circuit</p>
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

      {/* XLSX da Shopee */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <span style={s.cardIcon}>📦</span>
          <div>
            <p style={s.cardTitle}>Planilha da Shopee</p>
            <p style={s.cardDesc}>Arquivo .xlsx exportado do app da Shopee</p>
          </div>
          {shopee && <span style={s.ok}>✓ {shopee.length} pacotes</span>}
        </div>
        <input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={handleXLSX} style={{ display: 'none' }} />
        <button style={{ ...s.btn, background: shopee ? '#e8f5e9' : '#FF6B2B', color: shopee ? '#2e7d32' : '#fff' }}
          onClick={() => xlsxRef.current.click()} disabled={loadingShopee}>
          {loadingShopee ? 'Lendo planilha...' : shopee ? '✓ Planilha carregada — trocar' : 'Selecionar planilha'}
        </button>
        {shopeeError && <p style={s.err}>⚠️ {shopeeError}</p>}
      </div>

      {circuit && shopee && (
        <div style={s.hint}>
          ✓ Dados cruzados automaticamente — vá para <strong>Pacotes</strong> ou <strong>Scanner</strong>
        </div>
      )}

      {(!circuit || !shopee) && (
        <div style={s.steps}>
          <p style={s.stepsTitle}>Como usar</p>
          <p style={s.step}>1. No Circuit, abra a rota do dia e exporte o PDF</p>
          <p style={s.step}>2. No app da Shopee, baixe o arquivo .xlsx</p>
          <p style={s.step}>3. Carregue os dois arquivos aqui</p>
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
    border: '1px solid #fcc', borderRadius: 8, color: '#c00', fontSize: 13,
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
