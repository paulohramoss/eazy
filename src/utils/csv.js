// Leitura de CSV para importar extratos.
//
// Nada de split(','): descrição de banco vem cheia de vírgula dentro de aspas
// ("SUPERMERCADO XYZ, LTDA"), e um split ingênuo desloca todas as colunas
// seguintes da linha.

// Detecta o separador pela primeira linha. Bancos brasileiros costumam exportar
// com ponto e vírgula, porque a vírgula já é o separador decimal.
function detectDelimiter(text) {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'))
  const counts = [',', ';', '\t'].map(d => [d, firstLine.split(d).length])
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 1 ? counts[0][0] : ','
}

// Parser de estado, campo a campo: trata aspas, aspas escapadas ("") e quebra
// de linha dentro do campo.
export function parseCSV(text) {
  const delimiter = detectDelimiter(text)
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') { inQuotes = true; continue }
    if (char === delimiter) { row.push(field); field = ''; continue }
    if (char === '\r') continue
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += char
  }

  // Última linha sem quebra no fim do arquivo.
  if (field !== '' || row.length) { row.push(field); rows.push(row) }

  return rows.filter(r => r.length && !r.every(c => c.trim() === ''))
}

// Aceita 'YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY' e 'DD/MM/YY'.
// Formato americano (MM/DD) é ambíguo com o brasileiro e não dá para adivinhar
// sem contexto — assumimos dia primeiro, que é o padrão local.
export function normalizeDate(raw) {
  const value = String(raw || '').trim()
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const m = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (!m) return null

  const day = Number(m[1])
  const month = Number(m[2])
  let year = Number(m[3])
  if (year < 100) year += year < 70 ? 2000 : 1900

  if (day < 1 || day > 31 || month < 1 || month > 12) return null

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Aceita '1.234,56' (pt-BR), '1,234.56' (en-US), 'R$ 1.234,56' e negativos por
// sinal ou por parênteses — a convenção contábil de vários extratos.
export function parseAmount(raw) {
  let value = String(raw ?? '').trim()
  if (!value) return null

  const parenthesized = /^\(.*\)$/.test(value)
  if (parenthesized) value = value.slice(1, -1)

  const negative = parenthesized || value.includes('-')

  // Fora dígitos e separadores, o resto é símbolo de moeda e ruído.
  value = value.replace(/[^\d.,]/g, '')
  if (!value) return null

  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')

  if (lastComma > lastDot) {
    // Vírgula é o decimal: tira os pontos de milhar.
    value = value.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    value = value.replace(/,/g, '')
  } else {
    // Nenhum separador decimal — só dígitos.
    value = value.replace(/[.,]/g, '')
  }

  const n = Number(value)
  if (!Number.isFinite(n)) return null

  return negative ? -n : n
}
