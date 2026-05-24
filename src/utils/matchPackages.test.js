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
