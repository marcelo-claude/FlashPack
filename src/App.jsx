import { useState } from 'react'
import Upload from './components/Upload'
import PackageList from './components/PackageList'
import Scanner from './components/Scanner'

const TABS = [
  { id: 'upload', label: 'Início', icon: '🏠' },
  { id: 'list', label: 'Pacotes', icon: '📋' },
  { id: 'scan', label: 'Scanner', icon: '📷' },
]

export default function App() {
  const [tab, setTab] = useState('upload')
  const [packages, setPackages] = useState([])

  function handleReady(matched) {
    setPackages(matched)
    setTab('scan')
  }

  return (
    <div style={s.app}>
      <div style={s.content}>
        {tab === 'upload' && <Upload onReady={handleReady} />}
        {tab === 'list' && <PackageList packages={packages} />}
        {tab === 'scan' && <Scanner packages={packages} />}
      </div>

      <nav style={s.nav}>
        {TABS.map(t => (
          <button key={t.id} style={{ ...s.btn, ...(tab === t.id ? s.btnActive : {}) }}
            onClick={() => setTab(t.id)}>
            <span style={s.navIcon}>{t.icon}</span>
            <span style={s.navLabel}>{t.label}</span>
            {t.id === 'list' && packages.length > 0 && (
              <span style={s.badge}>{packages.length}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}

const s = {
  app: { height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  nav: { display: 'flex', borderTop: '1px solid #e0e0e0', background: '#fff', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' },
  btn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 0', background: 'none', color: '#888', border: 'none', gap: 2, minHeight: 56, position: 'relative', cursor: 'pointer' },
  btnActive: { color: '#1e88e5' },
  navIcon: { fontSize: 22, lineHeight: 1 },
  navLabel: { fontSize: 10, fontWeight: 500 },
  badge: { position: 'absolute', top: 4, right: '18%', background: '#1e88e5', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 10, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' },
}
