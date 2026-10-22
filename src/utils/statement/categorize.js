// categorize — palpite de categoria para cada linha de um extrato importado.
//
// Descrição de banco não é texto de gente: vem "EBN*PLAYSTATI CURITIBA",
// "DL*GOOGLE Crunch", "MP *VIVO". As palavras-chave do lançamento rápido
// procuram palavras inteiras e não reconhecem nada disso, então aqui fica uma
// lista de estabelecimentos casados por trecho, antes de cair na tabela geral.

import { suggestCategory } from '../quickParse'
import { norm } from '../text'

// [padrão, categoria]. Casado contra a descrição normalizada e sem espaços nem
// pontuação ("amazonprimebr", "dl google crunch" → "dlgooglecrunch"), por isso
// os padrões também vêm compactados. Ordem importa: o primeiro que casar vence,
// então os mais específicos ficam em cima ("amazonprime" antes de "amazon").
const MERCHANTS = [
  // Lazer / streaming
  [/netflix|spotify|disney|hbomax|\bmax\b|primevideo|amazonprime|amazonadfree|paramount|globoplay|crunchyroll|crunch|deezer|youtubepremium|playstati|playstation|psn|xbox|nintendo|steam|twitch|ingresso|cinemark|cinepolis|sympla/, 'Lazer'],
  // Transporte
  [/uber(?!eats)|99app|99pop|99tecnologia|cabify|petrobras|ipiranga|shellbox|\bshell|postoipiranga|\bposto|autoposto|combustivel|semparar|conectcar|veloe|estapar|zulpark|pedagio|latam|gol linhas|azul linhas|buser|clickbus/, 'Transporte'],
  // Alimentação
  [/ifood|rappi|ubereats|zedelivery|mcdonald|burgerking|bobs|subway|habibs|outback|starbucks|padaria|panificadora|supermerc|atacadao|assai|carrefour|paodeacucar|extra hiper|savegnago|mercadinho|hortifruti|acougue|restaurante|lanchonete|pizzaria/, 'Alimentação'],
  // Saúde
  [/drogasil|drogaraia|raiadrogasil|pague menos|paguemenos|panvel|drogaria|farmacia|unimed|hapvida|\bamil\b|bradescosaude|sulamerica|odonto|laboratorio|clinica|smartfit|bluefit|academia|totalpass|gympass|wellhub/, 'Saúde'],
  // Educação
  [/uninter|estrategia|alura|udemy|coursera|hotmart|kiwify|eduzz|faculdade|universidade|unopar|anhanguera|estacio|cruzeirodosul|descomplica|duolingo|livraria|escola|colegio/, 'Educação'],
  // Moradia (contas da casa, inclusive telefonia)
  [/claro|vivo|\btim\b|timbrasil|\boi\b|oifibra|nettv|skybrasil|\bsky\b|copel|cemig|\benel\b|\blight\b|sabesp|sanepar|cedae|comgas|condominio|aluguel|quintoandar|leroy|telhanorte|tokstok|madeiramadeira/, 'Moradia'],
  // Tecnologia (software, nuvem, apps)
  [/anthropic|openai|chatgpt|claude|apple|icloud|google|microsoft|office365|adobe|github|notion|canva|dropbox|kabum|pichau|terabyte|samsung|\bdell\b/, 'Tecnologia'],
  // Vestuário
  [/modas|renner|riachuelo|\bcea\b|cea modas|zara|shein|hering|centauro|netshoes|nike|adidas|calcados|marisa|youcom/, 'Vestuário'],
  // Marketplaces e tarifas: sem pista do que foi comprado, mas casar aqui
  // impede a tabela geral de ler "MERCADO*MERCADOLIVRE" como supermercado.
  [/mercadolivre|mercadopago|shopee|amazon|aliexpress|magalu|magazineluiza|americanas|casasbahia|temu/, 'Outros'],
  [/\biof\b|anuidade|tarifa|protecao perda|seguro|encargo|juros|multa/, 'Outros'],
]

// Entradas típicas de extrato de conta. Só valem quando a linha já é crédito.
const INCOME_MERCHANTS = [
  [/salario|folha|pagto salario|proventos|remuneracao/, 'Salário'],
  [/rendimento|dividendo|juros sobre capital|resgate|cdb|tesouro/, 'Investimentos'],
]

const compact = (s) => norm(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

function matchMerchant(name, table) {
  const spaced = compact(name)
  const glued = spaced.replace(/ /g, '')
  for (const [re, category] of table) {
    if (re.test(spaced) || re.test(glued)) return category
  }
  return null
}

/**
 * @param {{name:string, type:'income'|'expense'}} entry
 * @param {{categories:string[], history:object[]}} opts
 * @returns {{category:string, source:'history'|'merchant'|'keyword'|'default'}}
 */
export function categorize(entry, { categories, history = [] }) {
  const fallback = entry.type === 'income' && categories.includes('Outros Rendimentos')
    ? 'Outros Rendimentos'
    : (categories.includes('Outros') ? 'Outros' : categories[0])

  // Histórico só conta se for do mesmo tipo: um estorno da Netflix não deve
  // herdar a categoria do gasto e virar "receita de Lazer" sem ninguém notar.
  const sameType = history.filter(tx => tx.type === entry.type)
  const viaHistory = suggestCategory(entry.name, { categories, history: sameType })
  if (viaHistory?.source === 'history') return { category: viaHistory.category, source: 'history' }

  const table = entry.type === 'income' ? INCOME_MERCHANTS : MERCHANTS
  const merchant = matchMerchant(entry.name, table)
  if (merchant && categories.includes(merchant)) return { category: merchant, source: 'merchant' }

  if (viaHistory?.source === 'keyword') return { category: viaHistory.category, source: 'keyword' }

  return { category: fallback, source: 'default' }
}
