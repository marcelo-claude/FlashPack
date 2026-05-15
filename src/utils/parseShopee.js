import * as XLSX from 'xlsx'

const COL = {
  spxTn: ['SPX TN', 'spx tn', 'Tracking Number'],
  address: ['Destination Address', 'destination address', 'Address'],
  bairro: ['Bairro', 'bairro', 'District'],
  city: ['City', 'city', 'Cidade'],
}

function findCol(headers, options) {
  for (const opt of options) {
    const idx = headers.findIndex(h => String(h).trim() === opt)
    if (idx >= 0) return idx
  }
  return -1
}

export async function parseShopeeXLSX(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  if (rows.length < 2) throw new Error('Planilha vazia ou sem dados.')

  const headers = rows[0].map(h => String(h).trim())
  const iSpx = findCol(headers, COL.spxTn)
  const iAddr = findCol(headers, COL.address)
  const iBairro = findCol(headers, COL.bairro)
  const iCity = findCol(headers, COL.city)

  if (iSpx < 0 || iAddr < 0) throw new Error('Colunas SPX TN ou Destination Address não encontradas.')

  const packages = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const spxTn = String(row[iSpx] || '').trim()
    const address = String(row[iAddr] || '').trim()
    if (!spxTn || !address) continue
    const bairro = iBairro >= 0 ? String(row[iBairro] || '').trim() : ''
    const city = iCity >= 0 ? String(row[iCity] || '').trim() : ''
    packages.push({ spxTn, address, bairro, city })
  }

  if (packages.length === 0) throw new Error('Nenhum pacote encontrado na planilha.')
  return packages
}
