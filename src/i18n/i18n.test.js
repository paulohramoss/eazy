import { describe, expect, it } from 'vitest'
import { createFormatters, createTranslator, DEFAULT_LANGUAGE, isSupported, LANGUAGES, resolveLanguage } from './index.js'
import { en } from './en.js'
import { es } from './es.js'
import { pt } from './pt.js'

describe('dicionários', () => {
  it('todo idioma da lista tem dicionário', () => {
    for (const { value } of LANGUAGES) expect(isSupported(value)).toBe(true)
  })

  it('en e es cobrem todas as chaves do português', () => {
    // pt é a referência: uma chave só em pt cairia no fallback e apareceria em
    // português no meio de uma interface em inglês.
    const missingEn = Object.keys(pt).filter(k => !(k in en))
    const missingEs = Object.keys(pt).filter(k => !(k in es))
    expect(missingEn).toEqual([])
    expect(missingEs).toEqual([])
  })

  it('não há chave sobrando fora do português', () => {
    for (const dict of [en, es]) {
      expect(Object.keys(dict).filter(k => !(k in pt))).toEqual([])
    }
  })
})

describe('createTranslator', () => {
  it('traduz para o idioma pedido', () => {
    expect(createTranslator('en-US')('nav.overview')).toBe('Overview')
    expect(createTranslator('es')('nav.overview')).toBe('Resumen')
    expect(createTranslator('pt-BR')('nav.overview')).toBe('Visão Geral')
  })

  it('idioma desconhecido cai no padrão', () => {
    expect(createTranslator('klingon')('nav.overview')).toBe(pt['nav.overview'])
  })

  it('chave inexistente devolve a própria chave', () => {
    // Texto errado é um bug visível; undefined na tela não é.
    expect(createTranslator('en-US')('chave.que.nao.existe')).toBe('chave.que.nao.existe')
  })

  it('interpola variáveis', () => {
    expect(createTranslator('pt-BR')('verify.text', { email: 'a@b.com' })).toContain('a@b.com')
  })

  it('deixa intacto o placeholder sem valor', () => {
    expect(createTranslator('pt-BR')('verify.text', {})).toContain('{email}')
  })
})

describe('resolveLanguage', () => {
  it('devolve o padrão para entradas inválidas', () => {
    expect(resolveLanguage(undefined)).toBe(DEFAULT_LANGUAGE)
    expect(resolveLanguage('xx')).toBe(DEFAULT_LANGUAGE)
    expect(resolveLanguage('en-US')).toBe('en-US')
  })
})

describe('createFormatters', () => {
  it('formata a moeda no padrão do idioma escolhido', () => {
    // O bug que motivou o i18n: com USD selecionado, o locale fixo em pt-BR
    // produzia símbolo americano com agrupamento brasileiro.
    const ptUsd = createFormatters('pt-BR', 'USD').formatCurrency(1234.56)
    const enUsd = createFormatters('en-US', 'USD').formatCurrency(1234.56)

    expect(enUsd).toBe('$1,234.56')
    expect(ptUsd).not.toBe(enUsd)
  })

  it('separa idioma de moeda', () => {
    // Morar no Brasil e acompanhar uma carteira em dólar é legítimo.
    const f = createFormatters('pt-BR', 'USD')
    expect(f.locale).toBe('pt-BR')
    expect(f.currencySymbol).toBeTruthy()
  })

  it('formata datas no padrão do idioma', () => {
    expect(createFormatters('pt-BR', 'BRL').formatDate('2026-03-10')).toBe('10/03/2026')
    expect(createFormatters('en-US', 'USD').formatDate('2026-03-10')).toBe('03/10/2026')
  })

  it('não desloca a data por fuso', () => {
    // Meio-dia na construção evita cair no dia anterior.
    expect(createFormatters('pt-BR', 'BRL').formatDate('2026-01-01')).toBe('01/01/2026')
  })

  it('data vazia devolve string vazia em vez de "Invalid Date"', () => {
    expect(createFormatters('pt-BR', 'BRL').formatDate('')).toBe('')
    expect(createFormatters('pt-BR', 'BRL').formatDate(undefined)).toBe('')
  })

  it('valores inválidos viram zero em vez de NaN', () => {
    const f = createFormatters('en-US', 'USD')
    expect(f.formatCurrency(undefined)).toBe('$0.00')
    expect(f.formatNumber('abc')).toBe('0')
  })
})
