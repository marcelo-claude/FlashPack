function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extrai apenas rua + número (antes de qualquer complemento)
function extractStreetNum(addr) {
  const norm = normalize(addr)
  const m = norm.match(/^(.{5,60}?\d+)/)
  return m ? m[1].trim() : norm.substring(0, 40)
}

// Tipos de logradouro que não devem influenciar o agrupamento por endereço
const STREET_TYPES = new Set([
  'rua', 'r', 'av', 'ave', 'avenida', 'travessa', 'tv', 'tr', 'alameda', 'al',
  'praca', 'estrada', 'estr', 'rod', 'rodovia', 'viela', 'vl', 'largo', 'via', 'viaduto',
])

// Chave de agrupamento: só rua (sem tipo de logradouro) + número.
function groupKey(addr) {
  const short = extractStreetNum(addr)
  const m = short.match(/^(.*?)(\d+)\s*$/)
  if (!m) return short
  const name = m[1].trim().split(' ').filter(w => w && !STREET_TYPES.has(w))
  return name.join(' ') + '|' + m[2]
}

// Transforma as paradas do Circuit (já com spxTn) em pacotes.
// Cada parada é um pacote; agrupa paradas no mesmo endereço (rua+número)
// para alimentar o recurso de múltiplos pacotes no mesmo local (01/02/03).
export function buildPackages(stops) {
  const groups = new Map()
  for (const s of stops) {
    const key = groupKey(s.address)
    if (!groups.has(key)) groups.set(key, new Set())
    groups.get(key).add(s.stopNumber)
  }

  return stops
    .map(s => ({
      spxTn: s.spxTn,
      address: s.address,
      bairro: '',
      city: '',
      stopNumber: s.stopNumber,
      circuitAddress: s.address,
      groupStops: [...(groups.get(groupKey(s.address)) || [s.stopNumber])].sort((a, b) => a - b),
      score: 100,
      matched: true,
    }))
    .sort((a, b) => a.stopNumber - b.stopNumber)
}
