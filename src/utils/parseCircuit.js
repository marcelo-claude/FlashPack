import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

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
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - cur[0].y) <= tolerance) {
      cur.push(sorted[i])
    } else {
      lines.push(cur.sort((a, b) => a.x - b.x).map(i => i.text).join(' ').trim())
      cur = [sorted[i]]
    }
  }
  lines.push(cur.sort((a, b) => a.x - b.x).map(i => i.text).join(' ').trim())
  return lines.filter(l => l.length > 0)
}

export async function parseCircuitPDF(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const stops = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const items = content.items.map(item => ({
      text: item.str,
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
    }))
    const lines = groupByLine(items)

    for (const line of lines) {
      // Linha começa com número de parada seguido de endereço e hora HH:MM
      const m = line.match(/^(\d{1,3})\s+(.+?)\s+(\d{1,2}:\d{2})\s*$/)
      if (!m) continue
      const num = parseInt(m[1])
      const address = m[2].trim()
      // Evita duplicatas e linhas de cabeçalho
      if (num >= 1 && num <= 999 && !stops.find(s => s.stopNumber === num)) {
        stops.push({ stopNumber: num, address })
      }
    }
  }

  if (stops.length === 0) throw new Error('Nenhuma parada encontrada no PDF. Verifique se é um arquivo do Circuit.')
  return stops.sort((a, b) => a.stopNumber - b.stopNumber)
}
