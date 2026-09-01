// Internacionalização.
//
// O seletor de idioma existia desabilitado, e o `pt-BR` estava fixo em ~16
// pontos do código. Isso produzia saída errada de verdade para quem trocava a
// moeda: com USD selecionado, os valores saíam como "US$ 1.234,56" — símbolo
// americano com agrupamento brasileiro.
//
// `language` é a fonte da verdade do locale; `currency` continua separada,
// porque morar no Brasil e acompanhar uma carteira em dólar é legítimo.

import { en } from './en.js'
import { es } from './es.js'
import { pt } from './pt.js'

export const LANGUAGES = [
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es',    label: 'Español' },
]

const DICTS = { 'pt-BR': pt, 'en-US': en, es }
export const DEFAULT_LANGUAGE = 'pt-BR'

export const isSupported = (lang) => Object.prototype.hasOwnProperty.call(DICTS, lang)

export const resolveLanguage = (lang) => (isSupported(lang) ? lang : DEFAULT_LANGUAGE)

/**
 * Tradutor para um idioma.
 *
 * Chave ausente cai no português e, se nem lá existir, devolve a própria chave
 * — texto errado é um bug visível; tela em branco não é.
 */
export function createTranslator(language) {
  const lang = resolveLanguage(language)
  const dict = DICTS[lang]

  return function t(key, vars) {
    let value = dict[key] ?? pt[key] ?? key
    if (vars) {
      // Interpolação simples: 'Olá, {name}' + { name: 'Ana' }
      value = value.replace(/\{(\w+)\}/g, (match, name) =>
        (Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match))
    }
    return value
  }
}

// ─── Formatação sensível ao locale ────────────────────────────────────────────

export function createFormatters(language, currency = 'BRL') {
  const locale = resolveLanguage(language)

  // Intl.NumberFormat é caro de instanciar; como formatCurrency é chamado
  // centenas de vezes por render de lista, o formatador é criado uma vez por
  // combinação locale+moeda.
  const currencyFmt = new Intl.NumberFormat(locale, { style: 'currency', currency })
  const numberFmt = new Intl.NumberFormat(locale)
  const dateFmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const longDateFmt = new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const monthShortFmt = new Intl.DateTimeFormat(locale, { month: 'short' })

  const symbol = currencyFmt.formatToParts(0).find(p => p.type === 'currency')?.value || currency

  // Meio-dia evita que o fuso empurre a data para o dia anterior na exibição.
  const toDate = (iso) => new Date(`${iso}T12:00:00`)

  return {
    locale,
    currencySymbol: symbol,
    formatCurrency: (n) => currencyFmt.format(Number(n) || 0),
    formatNumber: (n) => numberFmt.format(Number(n) || 0),
    formatDate: (iso) => (iso ? dateFmt.format(toDate(iso)) : ''),
    formatLongDate: (date = new Date()) => longDateFmt.format(date),
    formatMonthShort: (date) => monthShortFmt.format(date),
  }
}

// ─── Idioma fora do AppProvider ──────────────────────────────────────────────
// A tela de login roda antes de haver usuário — e portanto antes das prefs do
// Firestore existirem. Aqui o idioma vem do cache local (gravado pelo app a
// cada troca) e, na primeira visita, do próprio navegador.

export const LANGUAGE_CACHE_KEY = 'eazy_language'

export function detectLanguage() {
  try {
    const cached = localStorage.getItem(LANGUAGE_CACHE_KEY)
    if (isSupported(cached)) return cached
  } catch { /* modo privado */ }

  const nav = typeof navigator !== 'undefined' ? (navigator.language || '') : ''
  if (isSupported(nav)) return nav
  // 'pt', 'pt-PT', 'en-GB', 'es-AR' → casa pelo prefixo do idioma.
  const prefix = nav.split('-')[0]
  const match = LANGUAGES.find(l => l.value.split('-')[0] === prefix)
  return match ? match.value : DEFAULT_LANGUAGE
}

export function cacheLanguage(language) {
  try {
    if (isSupported(language)) localStorage.setItem(LANGUAGE_CACHE_KEY, language)
  } catch { /* modo privado */ }
}
