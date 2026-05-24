# Importação de arquivo único (PDF do Circuit com SPX TN) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o FlashPack funcionar com **um único arquivo** — o PDF do Circuit exportado com a coluna SPX TN — eliminando a planilha da Shopee e o cruzamento por similaridade de endereço.

**Architecture:** O `parseCircuit` passa a extrair o SPX TN da coluna Notes do PDF (associando cada fragmento à parada mais próxima por posição vertical). Um novo builder `buildPackages` transforma as paradas em pacotes, mantendo só o agrupamento por rua+número (recurso `01/02/03`). `Upload` vira fluxo de um arquivo, com aviso quando o PDF não tem os códigos. A planilha Shopee é removida.

**Tech Stack:** React 19, Vite 8, pdfjs-dist 5, vitest (novo, só para testes de lógica pura).

Spec de referência: `docs/superpowers/specs/2026-05-23-circuit-arquivo-unico-design.md`

---

### Task 1: Adicionar vitest para testes de lógica pura

**Files:**
- Modify: `package.json` (scripts + devDependencies)

- [ ] **Step 1: Instalar vitest**

Run: `npm install -D vitest@^3`
Expected: vitest adicionado em devDependencies, sem erros.

- [ ] **Step 2: Adicionar script de teste**

Em `package.json`, no bloco `"scripts"`, adicionar a linha do `test` (manter as demais):

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Verificar que o runner sobe**

Run: `npx vitest run`
Expected: termina sem erro, mensagem "No test files found" (ainda não há testes).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adiciona vitest para testes de lógica pura"
```

---

### Task 2: Função pura de associação do SPX TN às paradas

A coluna Notes do PDF fica em x≈517. Para cada parada (no `y` da sua linha), o fragmento `BR...` fica ~5 acima e o sufixo `77S;` ~5 abaixo. Esta função associa cada fragmento da coluna Notes à parada mais próxima por `y` e remonta o código.

**Files:**
- Modify: `src/utils/parseCircuit.js` (adicionar exports `parseStopLine`, `attachSpxTn`)
- Test: `src/utils/parseCircuit.test.js` (criar)

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/utils/parseCircuit.test.js`:

```js
import { test, expect } from 'vitest'
import { parseStopLine, attachSpxTn } from './parseCircuit'

test('parseStopLine extrai número e endereço de uma linha de parada', () => {
  const r = parseStopLine('1 Rua Abrolhos, 53, Casa, Santo André 23:36')
  expect(r).toEqual({ stopNumber: 1, address: 'Rua Abrolhos, 53, Casa, Santo André' })
})

test('parseStopLine ignora linhas sem padrão de parada', () => {
  expect(parseStopLine('Address Notes Time')).toBeNull()
  expect(parseStopLine('Tempo total: 8h52min')).toBeNull()
})

test('attachSpxTn remonta o código da coluna Notes na parada mais próxima', () => {
  // Geometria real da página 1 (x=517 = coluna Notes; parada em y=722)
  const stops = [{ stopNumber: 1, address: 'Rua Abrolhos, 53', y: 722 }]
  const noteItems = [
    { text: 'BR2611038443', x: 517, y: 727 },
    { text: '77S;', x: 517, y: 717 },
    { text: 'Notes', x: 536, y: 754 }, // cabeçalho, longe da parada -> ignorado
    { text: '23:36', x: 433, y: 722 }, // coluna Time (x<480) -> ignorado
  ]
  const r = attachSpxTn(stops, noteItems)
  expect(r[0].spxTn).toBe('BR261103844377S')
})

test('attachSpxTn devolve spxTn vazio quando não há nota na faixa da parada', () => {
  const stops = [{ stopNumber: 1, address: 'Rua X, 1', y: 722 }]
  const r = attachSpxTn(stops, [{ text: 'Notes', x: 536, y: 754 }])
  expect(r[0].spxTn).toBe('')
})
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `npx vitest run src/utils/parseCircuit.test.js`
Expected: FAIL — `parseStopLine`/`attachSpxTn` não exportados.

- [ ] **Step 3: Implementar as funções puras**

Em `src/utils/parseCircuit.js`, adicionar (após os imports, antes de `parseCircuitPDF`):

```js
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
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

Run: `npx vitest run src/utils/parseCircuit.test.js`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/utils/parseCircuit.js src/utils/parseCircuit.test.js
git commit -m "feat: funções puras parseStopLine e attachSpxTn"
```

---

### Task 3: Integrar a extração do SPX TN no parseCircuitPDF

Refatora `parseCircuitPDF` para guardar o `y` de cada parada e os itens da coluna Notes, usando `parseStopLine` e `attachSpxTn`.

**Files:**
- Modify: `src/utils/parseCircuit.js` (`groupByLine` e `parseCircuitPDF`)

- [ ] **Step 1: Fazer `groupByLine` devolver o y de cada linha**

Substituir a função `groupByLine` inteira por:

```js
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
```

- [ ] **Step 2: Reescrever o corpo de `parseCircuitPDF` para extrair paradas com y + SPX TN**

Substituir o `for (let p = 1; ...)` ... até o `return` final por:

```js
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
    const lines = groupByLine(items)

    // Paradas desta página (com y, para casar com a coluna Notes)
    const pageStops = []
    for (const line of lines) {
      const parsed = parseStopLine(line.text)
      if (parsed && !stops.find(s => s.stopNumber === parsed.stopNumber)) {
        pageStops.push({ ...parsed, y: line.y })
      }
    }

    // Itens da coluna Notes (códigos SPX), associados por proximidade vertical
    const noteItems = items.filter(it => it.x >= 480)
    const withSpx = attachSpxTn(pageStops, noteItems)
    stops.push(...withSpx)
  }

  if (stops.length === 0) throw new Error('Nenhuma parada encontrada no PDF. Verifique se é um arquivo do Circuit.')
  return stops.sort((a, b) => a.stopNumber - b.stopNumber)
```

Observação: `attachSpxTn` devolve `{ stopNumber, address, spxTn }` (sem `y`), que é o formato final desejado.

- [ ] **Step 3: Verificação de ponta a ponta contra o PDF real (script Node)**

Criar `/tmp/verify-circuit.mjs`:

```js
import { readFileSync } from 'fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parseStopLine, attachSpxTn } from '/home/marcelo/FlashPack/src/utils/parseCircuit.js'

// Reproduz o miolo de parseCircuitPDF em Node usando o build legacy do pdfjs.
function groupByLine(items, tol = 4) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  let cur = [sorted[0]]
  const push = g => lines.push({ text: g.sort((a, b) => a.x - b.x).map(i => i.text).join(' ').trim(), y: g[0].y })
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - cur[0].y) <= tol) cur.push(sorted[i])
    else { push(cur); cur = [sorted[i]] }
  }
  push(cur)
  return lines.filter(l => l.text)
}

const data = new Uint8Array(readFileSync('/home/marcelo/Downloads/Circuit.pdf'))
const pdf = await pdfjsLib.getDocument({ data }).promise
const stops = []
for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p)
  const items = (await page.getTextContent()).items
    .filter(i => i.str.trim())
    .map(i => ({ text: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) }))
  const lines = groupByLine(items)
  const pageStops = []
  for (const l of lines) {
    const parsed = parseStopLine(l.text)
    if (parsed && !stops.find(s => s.stopNumber === parsed.stopNumber)) pageStops.push({ ...parsed, y: l.y })
  }
  stops.push(...attachSpxTn(pageStops, items.filter(it => it.x >= 480)))
}
stops.sort((a, b) => a.stopNumber - b.stopNumber)
const comSpx = stops.filter(s => /^BR[0-9A-Z]{13}$/.test(s.spxTn)).length
console.log('paradas:', stops.length, '| com SPX (15 chars):', comSpx)
console.log('amostra:', stops.slice(0, 3))
```

Importante: o app importa `pdfjs-dist` (build do navegador) e este script usa `pdfjs-dist/legacy/build/pdf.mjs` (build Node). A diferença é só o ambiente do pdfjs; `parseStopLine`/`attachSpxTn` são as mesmas do app.

Run (a partir da raiz do projeto, para resolver node_modules): `cp /tmp/verify-circuit.mjs ./verify-circuit.mjs && node ./verify-circuit.mjs; rm -f ./verify-circuit.mjs`
Expected: `paradas: 170 | com SPX (15 chars): 170` e amostra com `spxTn` tipo `BR261103844377S`.

- [ ] **Step 4: Rodar a suíte de testes (não deve quebrar)**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/parseCircuit.js
git commit -m "feat: parseCircuitPDF extrai SPX TN da coluna Notes"
```

---

### Task 4: Builder buildPackages (substitui matchPackages)

Transforma as paradas do Circuit em pacotes, mantendo o agrupamento por rua+número.

**Files:**
- Modify: `src/utils/matchPackages.js` (remover lógica Shopee, adicionar `buildPackages`)
- Test: `src/utils/matchPackages.test.js` (criar)

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/utils/matchPackages.test.js`:

```js
import { test, expect } from 'vitest'
import { buildPackages } from './matchPackages'

test('buildPackages agrupa paradas do mesmo endereço (rua+número)', () => {
  const stops = [
    { stopNumber: 1, address: 'Rua das Flores, 100, Santo André', spxTn: 'BR1' },
    { stopNumber: 2, address: 'R das Flores, 100, Casa 2, Santo André', spxTn: 'BR2' },
    { stopNumber: 3, address: 'Rua Sol, 5, Santo André', spxTn: 'BR3' },
  ]
  const pkgs = buildPackages(stops)
  expect(pkgs.find(p => p.stopNumber === 1).groupStops).toEqual([1, 2])
  expect(pkgs.find(p => p.stopNumber === 2).groupStops).toEqual([1, 2])
  expect(pkgs.find(p => p.stopNumber === 3).groupStops).toEqual([3])
})

test('buildPackages preserva spxTn e marca tudo como matched, ordenado por parada', () => {
  const stops = [
    { stopNumber: 3, address: 'Rua Sol, 5', spxTn: 'BR3' },
    { stopNumber: 1, address: 'Rua Lua, 9', spxTn: 'BR1' },
  ]
  const pkgs = buildPackages(stops)
  expect(pkgs.map(p => p.stopNumber)).toEqual([1, 3])
  expect(pkgs[0]).toMatchObject({ spxTn: 'BR1', stopNumber: 1, matched: true })
})
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run src/utils/matchPackages.test.js`
Expected: FAIL — `buildPackages` não existe.

- [ ] **Step 3: Reescrever `matchPackages.js`**

Substituir o conteúdo inteiro de `src/utils/matchPackages.js` por (mantém os helpers de agrupamento, remove a busca por similaridade Shopee):

```js
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
```

- [ ] **Step 4: Rodar para confirmar que passa**

Run: `npx vitest run src/utils/matchPackages.test.js`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/utils/matchPackages.js src/utils/matchPackages.test.js
git commit -m "feat: buildPackages substitui o cruzamento por similaridade"
```

---

### Task 5: Upload com um arquivo só, aviso e orientação

**Files:**
- Modify: `src/components/Upload.jsx` (substituição completa)

- [ ] **Step 1: Substituir `src/components/Upload.jsx` inteiro**

```jsx
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
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK (sem erro de import de `parseShopee`/`matchPackages`).

- [ ] **Step 3: Commit**

```bash
git add src/components/Upload.jsx
git commit -m "feat: tela de importação com um arquivo só (PDF do Circuit)"
```

---

### Task 6: Remover parseShopee.js e a dependência xlsx

`parseShopee.js` não é mais importado por ninguém após a Task 5.

**Files:**
- Delete: `src/utils/parseShopee.js`
- Modify: `package.json` (remover `xlsx` das dependencies)

- [ ] **Step 1: Confirmar que não há mais imports de parseShopee nem xlsx**

Run: `grep -rn "parseShopee\|from 'xlsx'\|require('xlsx')" src/`
Expected: nenhum resultado.

- [ ] **Step 2: Remover o arquivo e a dependência**

Run: `git rm src/utils/parseShopee.js && npm uninstall xlsx`
Expected: arquivo removido; `xlsx` sai de package.json.

- [ ] **Step 3: Verificar build e testes**

Run: `npm run build && npx vitest run`
Expected: build OK; testes PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove parseShopee e dependência xlsx (não usados)"
```

---

### Task 7: Atualizar README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Ler o README atual**

Run: `cat README.md`

- [ ] **Step 2: Atualizar as instruções de uso**

Ajustar qualquer trecho que mencione "dois arquivos" / "planilha da Shopee" para o fluxo de um arquivo. O passo-a-passo deve ficar:

```
1. No Circuit, abra a rota do dia (já otimizada).
2. Ao exportar o PDF da rota, marque a opção **SPX TN**.
3. No FlashPack, carregue o PDF na aba Início.
4. Vá para Scanner e leia o QR Code de cada pacote — a parada aparece em letras grandes.
```

Se o README não mencionar os dois arquivos em lugar nenhum, registrar isso e seguir sem mudanças.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README reflete fluxo de arquivo único"
```

---

### Task 8: Verificação manual ponta a ponta

**Files:** nenhum (validação)

- [ ] **Step 1: Suíte completa + lint + build**

Run: `npx vitest run && npm run lint && npm run build`
Expected: testes PASS; lint sem erros novos; build OK.

- [ ] **Step 2: Teste manual no navegador**

Run: `npm run dev` e abrir a URL local (HTTPS via basic-ssl).
Roteiro:
1. Aba Início → "Selecionar PDF" → escolher `~/Downloads/Circuit.pdf`.
2. Confirmar "✓ 170 paradas" e redirecionamento para Scanner.
3. Aba Pacotes → conferir que as paradas aparecem com `#número` e que endereços repetidos mostram "📦 N pacotes aqui: 01/02/...".
4. Aba Scanner → Buscar → digitar um SPX TN conhecido do PDF (ex: `BR261103844377S`) → confirmar `#1` e endereço corretos.
5. Buscar um código inexistente → confirmar tela "Não encontrado".

Expected: todos os passos OK. (A bipagem por câmera pode ser validada apontando para um QR real de pacote.)

- [ ] **Step 3: Teste do aviso de PDF sem SPX TN (opcional, se houver um PDF antigo à mão)**

Carregar um PDF do Circuit exportado **sem** a coluna SPX TN.
Expected: mensagem "Este PDF não contém os códigos SPX TN..." e o app não avança.

---

## Notas finais

- **Privacidade:** não commitar `Circuit.pdf` (contém nomes/endereços reais de clientes). É usado só como fixture local de verificação.
- **Branch:** trabalho no branch `feature/circuit-arquivo-unico` (já criado, com o spec e a melhoria do `01/02/03`).
- **Deploy:** após aprovação, merge em `master` + `npx vercel --prod` (conforme memória do projeto).
