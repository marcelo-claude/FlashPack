import { useEffect, useRef, useState } from 'react'

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 1000; osc.type = 'sine'
    gain.gain.setValueAtTime(0.6, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.25)
  } catch {}
}

// "01 - 02 - 03" — números com 2 dígitos, em ordem crescente
const formatStops = (nums) => nums.map(n => String(n).padStart(2, '0')).join(' - ')

const isHttps = () =>
  typeof window !== 'undefined' &&
  (window.location.protocol === 'https:' || window.location.hostname === 'localhost')

export default function Scanner({ packages }) {
  const [tab, setTab] = useState('camera')
  const [shouldStart, setShouldStart] = useState(false)
  const [overlay, setOverlay] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState(null)

  const scannerRef = useRef(null)
  const pkgsRef = useRef(packages)
  const dismissTimer = useRef(null)
  const lastScanned = useRef({ code: null, time: 0 })

  useEffect(() => { pkgsRef.current = packages }, [packages])
  useEffect(() => () => clearTimeout(dismissTimer.current), [])

  useEffect(() => {
    if (tab !== 'camera') { setShouldStart(false); setOverlay(null) }
  }, [tab])

  function showOverlay(res) {
    playBeep()
    setOverlay(res)
    clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => setOverlay(null), 3000)
  }

  useEffect(() => {
    if (!shouldStart) return
    if (!isHttps()) { setError('Câmera só funciona em HTTPS.'); return }

    let cancelled = false
    let scanner = null

    async function init() {
      try {
        setError(null)
        const mod = await import('html5-qrcode')
        const Html5Qrcode = mod.Html5Qrcode
        if (cancelled) return

        scanner = new Html5Qrcode('fp-qr-box', { verbose: false })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (code) => {
            if (cancelled) return
            const clean = code.trim()
            const now = Date.now()
            if (lastScanned.current.code === clean && now - lastScanned.current.time < 3000) return
            lastScanned.current = { code: clean, time: now }

            const pkg = pkgsRef.current.find(p => p.spxTn === clean)
            if (pkg) {
              showOverlay({ found: true, ...pkg })
            } else {
              showOverlay({ found: false, spxTn: clean })
            }
          },
          () => {}
        )
        if (!cancelled) setScanning(true)
      } catch (err) {
        if (cancelled) return
        const msg = err?.message || String(err)
        if (/Permission|NotAllowed|denied/i.test(msg))
          setError('Permissão de câmera negada. Toque no cadeado e permita.')
        else
          setError('Não foi possível acessar a câmera: ' + msg)
        setScanning(false)
      }
    }

    init()
    return () => {
      cancelled = true
      scannerRef.current?.stop().catch(() => {}).finally(() => {
        try { scannerRef.current?.clear() } catch {}
      })
      scannerRef.current = null
      setScanning(false)
    }
  }, [shouldStart])

  function handleSearch(q) {
    setSearch(q)
    const uq = q.trim().toUpperCase()
    if (!uq || uq.length < 2) { setSearchResults(null); return }
    const res = packages.filter(p =>
      (p.spxTn || '').toUpperCase().includes(uq) ||
      (p.address || '').toUpperCase().includes(uq)
    )
    setSearchResults(res.slice(0, 6))
  }

  const TabBar = (
    <div style={s.tabBar}>
      {['camera', 'search'].map(t => (
        <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
          {t === 'camera' ? '📷 Câmera' : '🔍 Buscar'}
        </button>
      ))}
    </div>
  )

  if (tab === 'search') {
    return (
      <div style={s.page}>
        {TabBar}
        <div style={s.searchWrap}>
          <input style={s.searchInput} type="text" placeholder="Código SPX ou endereço..."
            value={search} onChange={e => handleSearch(e.target.value)}
            autoComplete="off" autoCorrect="off" spellCheck={false} />
          {packages.length === 0 && <p style={s.warn}>⚠️ Carregue os arquivos na aba Início primeiro.</p>}
          {searchResults?.length === 0 && <div style={s.notFound}><p style={{ color: '#ff5252', fontSize: 20, fontWeight: 700 }}>Não encontrado</p></div>}
          {searchResults?.map((pkg, i) => (
            <div key={i} style={s.resultCard}>
              {pkg.matched
                ? (pkg.groupStops?.length > 1
                    ? <p style={s.bigMulti}>{formatStops(pkg.groupStops)}</p>
                    : <p style={s.bigNum}>#{pkg.stopNumber}</p>)
                : <p style={{ ...s.bigNum, color: '#bbb' }}>?</p>
              }
              {pkg.matched && pkg.groupStops?.length > 1 &&
                <p style={{ color: '#ffb300', fontSize: 13, fontWeight: 700 }}>⚠️ {pkg.groupStops.length} pacotes neste endereço</p>}
              <p style={s.resultAddr}>{pkg.address}</p>
              <p style={s.resultCode}>{pkg.spxTn}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!shouldStart) {
    return (
      <div style={s.page}>
        {TabBar}
        <div style={s.startScreen}>
          <p style={{ fontSize: 64 }}>📷</p>
          <p style={s.startTitle}>Scanner de Pacotes</p>
          <p style={s.startDesc}>Aponte para o QR Code do pacote. O número da parada aparece em letras gigantes.</p>
          {packages.length === 0 && <p style={s.warn}>⚠️ Carregue os arquivos na aba Início primeiro.</p>}
          <button style={s.startBtn} onClick={() => setShouldStart(true)}>Ativar câmera</button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      {TabBar}
      <div style={s.scanArea}>
        {overlay && (
          <div style={s.overlay} onClick={() => { clearTimeout(dismissTimer.current); setOverlay(null) }}>
            {overlay.found ? (
              <>
                <p style={s.overlayLabel}>{overlay.matched && overlay.groupStops?.length > 1 ? 'PARADAS' : 'PARADA'}</p>
                {overlay.matched ? (
                  overlay.groupStops?.length > 1
                    ? <p style={s.overlayMulti}>{formatStops(overlay.groupStops)}</p>
                    : <p style={s.overlayNum}>#{overlay.stopNumber}</p>
                ) : (
                  <p style={{ ...s.overlayNum, color: '#bbb' }}>?</p>
                )}
                {overlay.matched && overlay.groupStops?.length > 1 &&
                  <p style={{ color: '#ffb300', fontSize: 15, fontWeight: 700 }}>⚠️ {overlay.groupStops.length} pacotes neste endereço</p>}
                {!overlay.matched && <p style={{ color: '#ff9800', fontSize: 14 }}>Pacote encontrado mas sem parada no Circuit</p>}
                <p style={s.overlayAddr}>{overlay.address}</p>
                <p style={s.overlayCode}>{overlay.spxTn}</p>
              </>
            ) : (
              <>
                <p style={{ color: '#ff5252', fontSize: 26, fontWeight: 700 }}>Não encontrado</p>
                <p style={s.overlayCode}>{overlay.spxTn}</p>
                <p style={{ color: '#666', fontSize: 13, textAlign: 'center' }}>
                  {packages.length === 0 ? 'Carregue os arquivos primeiro' : 'QR Code não está na planilha'}
                </p>
              </>
            )}
            <p style={{ color: '#555', fontSize: 13, marginTop: 12 }}>Toque para continuar</p>
          </div>
        )}
        <div id="fp-qr-box" style={s.videoBox} />
        {error
          ? <div style={s.errorBox}><p style={{ color: '#c00', fontSize: 14, textAlign: 'center' }}>⚠️ {error}</p>
              <button style={s.retryBtn} onClick={() => { setError(null); setShouldStart(false); setTimeout(() => setShouldStart(true), 100) }}>Tentar novamente</button>
            </div>
          : <p style={s.hint}>{scanning ? '📷 Aponte para o QR Code' : 'Iniciando câmera...'}</p>
        }
      </div>
    </div>
  )
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  tabBar: { display: 'flex', background: '#1a1a2e', borderBottom: '2px solid #333', flexShrink: 0 },
  tab: { flex: 1, padding: '13px 8px', background: 'transparent', border: 'none', borderBottom: '3px solid transparent', color: '#888', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  tabActive: { color: '#1e88e5', borderBottom: '3px solid #1e88e5' },
  startScreen: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, background: '#fff', textAlign: 'center' },
  startTitle: { fontSize: 22, fontWeight: 700, color: '#1a1a2e' },
  startDesc: { fontSize: 15, color: '#666', lineHeight: 1.5, maxWidth: 300 },
  warn: { background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '10px 16px', fontSize: 14, color: '#795548', lineHeight: 1.5, maxWidth: 320 },
  startBtn: { marginTop: 8, padding: '16px 40px', background: '#1e88e5', color: '#fff', borderRadius: 12, fontSize: 17, fontWeight: 700, border: 'none', cursor: 'pointer' },
  scanArea: { flex: 1, display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden', position: 'relative' },
  overlay: { position: 'absolute', inset: 0, background: 'rgba(10,10,30,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'pointer', gap: 8, zIndex: 10 },
  overlayLabel: { color: '#555', fontSize: 13, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' },
  overlayNum: { color: '#1e88e5', fontSize: 110, fontWeight: 900, lineHeight: 1 },
  overlayMulti: { color: '#1e88e5', fontSize: 64, fontWeight: 900, lineHeight: 1.1, textAlign: 'center', wordBreak: 'break-word' },
  overlayAddr: { color: '#eee', fontSize: 18, textAlign: 'center', lineHeight: 1.4, fontWeight: 500 },
  overlayCode: { color: '#444', fontSize: 13, fontFamily: 'monospace' },
  videoBox: { flex: 1, width: '100%', minHeight: 280, overflow: 'hidden' },
  hint: { color: '#aaa', fontSize: 14, textAlign: 'center', padding: '14px 16px', flexShrink: 0 },
  errorBox: { padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0, background: '#fff' },
  retryBtn: { padding: '12px 28px', background: '#1e88e5', color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' },
  searchWrap: { flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 12, background: '#f5f5f5', overflowY: 'auto' },
  searchInput: { width: '100%', padding: '14px 16px', fontSize: 17, borderRadius: 10, border: '2px solid #ddd', background: '#fff', boxSizing: 'border-box' },
  notFound: { background: '#1a0000', borderRadius: 12, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  resultCard: { background: '#0f0f1a', borderRadius: 12, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  bigNum: { color: '#1e88e5', fontSize: 72, fontWeight: 900, lineHeight: 1, margin: 0 },
  bigMulti: { color: '#1e88e5', fontSize: 44, fontWeight: 900, lineHeight: 1.1, margin: 0, textAlign: 'center', wordBreak: 'break-word' },
  resultAddr: { color: '#eee', fontSize: 16, textAlign: 'center' },
  resultCode: { color: '#555', fontSize: 13, fontFamily: 'monospace' },
}
