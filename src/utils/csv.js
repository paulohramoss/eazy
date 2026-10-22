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

/**
 * Extrato em CSV → lançamentos no mesmo formato dos outros leitores (valor com
 * sinal, negativo é saída). Aceita o CSV exportado pelo próprio app e os
 * cabeçalhos mais comuns de banco.
 */
export function parseCSVStatement(text) {
  const rows = parseCSV(text.replace(/^\uFEFF/, ''))
  if (rows.length < 2) throw new Error('CSV vazio ou sem linhas de dados')

  const header = rows[0].map(h => h.trim().toLowerCase())
  const findCol = (...names) => header.findIndex(h => names.some(n => h.includes(n)))

  const iDate   = findCol('data', 'date')
  const iName   = findCol('descri', 'histór', 'histor', 'name', 'lançamento', 'lancamento', 'estabelecimento', 'title')
  const iAmount = findCol('valor', 'amount', 'quantia')
  const iType   = findCol('tipo', 'type')
  const iCat    = findCol('categoria', 'category')
  const iNotes  = findCol('observ', 'notes', 'memo')

  if (iDate < 0 || iAmount < 0) {
    throw new Error('Não encontrei as colunas de data e valor. Cabeçalhos esperados: Data, Descrição, Valor.')
  }

  const entries = []
  let invalid = 0
  for (const row of rows.slice(1)) {
    const date = normalizeDate(row[iDate])
    const amount = parseAmount(row[iAmount])
    if (!date || amount == null || amount === 0) { invalid++; continue }

    // Sem coluna de tipo, o sinal do valor decide — é a convenção de extrato.
    const typeCell = iType >= 0 ? (row[iType] || '').toLowerCase() : ''
    const income = typeCell
      ? /receit|entrada|credit|income/.test(typeCell)
      : amount > 0

    entries.push({
      date,
      description: (iName >= 0 ? row[iName] : '').trim() || 'Importado',
      amount: income ? Math.abs(amount) : -Math.abs(amount),
      category: (iCat >= 0 ? row[iCat] : '').trim(),
      notes: (iNotes >= 0 ? row[iNotes] : '').trim(),
    })
  }

  return { kind: 'account', bank: '', entries, invalid }
}
