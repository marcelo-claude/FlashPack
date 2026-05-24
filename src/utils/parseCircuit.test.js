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

test('parseStopLine rejeita parada 0 (ex: linha de depósito/cabeçalho)', () => {
  expect(parseStopLine('0 Depósito Central 10:00')).toBeNull()
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
