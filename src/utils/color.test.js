import { describe, expect, it } from 'vitest'
import { COLOR_PALETTE, normalizeHex, sameColor } from './color.js'

describe('normalizeHex', () => {
  it('aceita com e sem #, maiúscula e minúscula', () => {
    expect(normalizeHex('#1e45fc')).toBe('#1E45FC')
    expect(normalizeHex('1E45FC')).toBe('#1E45FC')
    expect(normalizeHex('  #1e45fc  ')).toBe('#1E45FC')
  })

  it('expande a forma curta', () => {
    expect(normalizeHex('#fff')).toBe('#FFFFFF')
    expect(normalizeHex('0af')).toBe('#00AAFF')
  })

  it('recusa o que não é hexadecimal de cor', () => {
    for (const bad of ['', '#', '#12', '#1234', '#12345', '#GGGGGG', 'azul', null, undefined, '#1E45FC0']) {
      expect(normalizeHex(bad)).toBeNull()
    }
  })
})

describe('sameColor', () => {
  it('ignora caixa e forma curta', () => {
    expect(sameColor('#ffffff', '#FFF')).toBe(true)
    expect(sameColor('#0053EF', '#0053ef')).toBe(true)
    expect(sameColor('#0053EF', '#0053EE')).toBe(false)
  })

  it('valor inválido nunca casa', () => {
    expect(sameColor('', '')).toBe(false)
  })
})

describe('COLOR_PALETTE', () => {
  it('só tem hexadecimais válidos e sem repetição', () => {
    expect(COLOR_PALETTE.every(c => normalizeHex(c) === c)).toBe(true)
    expect(new Set(COLOR_PALETTE).size).toBe(COLOR_PALETTE.length)
  })
})
