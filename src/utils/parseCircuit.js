// x mínimo da coluna Notes (Time fica em ~433; Notes em ~517)
const NOTES_X_MIN = 480

// "1 Rua Abrolhos, 53, Casa, Santo André 23:36" -> { stopNumber, address }
export function parseStopLine(text) {
  const m = text.match(/^(\d{1,3})\s+(.+?)\s+(\d{1,2}:\d{2})\s*$/)
  if (!m) return null
  const num = parseInt(m[1])
  if (num < 1 || num > 999) return null
  return { stopNumber: num, address: m[2].trim() }
}

// Associa os fragmentos da coluna Notes à parada mais próxima por y
// e remonta o SPX TN (15 chars, ex: BR261103844377S).
// stops: [{ stopNumber, address, y }] | noteItems: [{ text, x, y }]
export function attachSpxTn(stops, noteItems) {
  const buckets = stops.map(() => [])
  for (const it of noteItems) {
    if (it.x < NOTES_X_MIN) continue
    let best = -1
    let bestDy = Infinity
    for (let i = 0; i < stops.length; i++) {
      const dy = Math.abs(it.y - stops[i].y)
      if (dy < bestDy) { bestDy = dy; best = i }
    }
    if (best >= 0 && bestDy <= 15) buckets[best].push(it)
  }
  return stops.map((stop, i) => {
    const joined = buckets[i]
      .sort((a, b) => b.y - a.y)
      .map(f => f.text)
      .join('')
      .replace(/[^0-9A-Za-z]/g, '')
    const m = joined.match(/BR[0-9A-Z]+/)
    return { stopNumber: stop.stopNumber, address: stop.address, spxTn: m ? m[0] : '' }
  })
}

function groupByLine(items, tolerance = 4) {
  if (!items.length) return []
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  let cur = [sorted[0]]
  const push = (group) => lines.push({
    text: group.sort((a, b) => a.x - b.x).map(i => i.text).join(' ').trim(),
    y: group[0].y,
  })
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - cur[0].y) <= tolerance) {
      cur.push(sorted[i])
    } else {
      push(cur)
      cur = [sorted[i]]
    }
  }
  push(cur)
  return lines.filter(l => l.text.length > 0)
}

export async function parseCircuitPDF(file) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const stops = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const items = content.items
      .filter(item => item.str.trim())
      .map(item => ({
        text: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      }))

    // Separa a coluna Notes (SPX) das colunas da esquerda (nº/endereço/hora).
    // Sem isso, o fragmento do SPX pode cair na tolerância vertical da linha
    // da parada e se fundir ao texto, fazendo parseStopLine rejeitar a linha.
    const leftItems = items.filter(it => it.x < NOTES_X_MIN)
    const noteItems = items.filter(it => it.x >= NOTES_X_MIN)
    const lines = groupByLine(leftItems)

    // Paradas desta página (com y, para casar com a coluna Notes)
    const pageStops = []
    for (const line of lines) {
      const parsed = parseStopLine(line.text)
      if (parsed && !stops.find(s => s.stopNumber === parsed.stopNumber)) {
        pageStops.push({ ...parsed, y: line.y })
      }
    }

    const withSpx = attachSpxTn(pageStops, noteItems)
    stops.push(...withSpx)
  }

  if (stops.length === 0) throw new Error('Nenhuma parada encontrada no PDF. Verifique se é um arquivo do Circuit.')
  return stops.sort((a, b) => a.stopNumber - b.stopNumber)
}
