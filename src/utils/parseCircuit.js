import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

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
