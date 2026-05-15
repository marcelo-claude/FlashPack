function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extrai apenas rua + número (antes de qualquer vírgula com texto não-numérico)
function extractStreetNum(addr) {
  const norm = normalize(addr)
  // Pega as primeiras palavras até um número de rua (ex: "rua das flores 123")
  const m = norm.match(/^(.{5,60}?\d+)/)
  return m ? m[1].trim() : norm.substring(0, 40)
}

function wordOverlap(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 2))
  const wb = new Set(b.split(' ').filter(w => w.length > 2))
  if (!wa.size || !wb.size) return 0
  let hits = 0
  for (const w of wa) if (wb.has(w)) hits++
  return hits / Math.max(wa.size, wb.size)
}

export function matchPackages(circuitStops, shopeePackages) {
  // Para cada pacote Shopee, achar o stop do Circuit com maior similaridade
  const results = shopeePackages.map(pkg => {
    const shopeeAddr = normalize(pkg.address + ' ' + pkg.city)
    const shopeeShort = extractStreetNum(pkg.address)

    let bestStop = null
    let bestScore = 0

    for (const stop of circuitStops) {
      const circuitAddr = normalize(stop.address)
      const circuitShort = extractStreetNum(stop.address)

      // Verifica se o endereço curto da Shopee está contido no Circuit
      let score = 0
      if (circuitAddr.includes(shopeeShort) || shopeeAddr.includes(circuitShort)) {
        score = 0.9
      } else {
        score = wordOverlap(shopeeAddr, circuitAddr)
      }

      if (score > bestScore) {
        bestScore = score
        bestStop = stop
      }
    }

    const matched = bestScore >= 0.55
    return {
      spxTn: pkg.spxTn,
      address: pkg.address,
      bairro: pkg.bairro,
      city: pkg.city,
      stopNumber: matched ? bestStop.stopNumber : null,
      circuitAddress: matched ? bestStop.address : null,
      score: Math.round(bestScore * 100),
      matched,
    }
  })

  return results.sort((a, b) => (a.stopNumber ?? 9999) - (b.stopNumber ?? 9999))
}
