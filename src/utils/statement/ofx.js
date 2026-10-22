// ofx — leitura de extrato OFX (o "Money 2000" que todo banco brasileiro
// exporta, de conta e de cartão).
//
// Existem duas famílias: OFX 1.x, que é SGML e não fecha as tags de valor
// (<TRNAMT>-12.50 e a linha acaba), e OFX 2.x, que é XML de verdade. O parser
// abaixo não depende de nenhuma das duas formas: lê cada bloco <STMTTRN> e, lá
// dentro, pega o texto que vem depois de cada tag até o próximo "<".

// Bancos ainda exportam em Windows-1252 ("CHARSET:1252"); ler como UTF-8
// transformaria "PADARIA SÃO JOÃO" em "PADARIA S�O JO�O".
export function decodeOFX(buffer) {
  const bytes = new Uint8Array(buffer)
  const head = new TextDecoder('ascii').decode(bytes.slice(0, 600))
  const latin = /CHARSET:\s*(1252|ISO-8859-1|8859-1)/i.test(head)
    || (/ENCODING:\s*USASCII/i.test(head) && !/encoding="utf-8"/i.test(head))
  const text = new TextDecoder(latin ? 'windows-1252' : 'utf-8').decode(bytes)
  // Arquivo marcado como ASCII mas salvo em UTF-8 é comum; se a decodificação
  // latina gerou as sequências típicas de UTF-8 mal lido, refaz em UTF-8.
  return latin && /Ã[\u0080-¿]/.test(text) ? new TextDecoder('utf-8').decode(bytes) : text
}

const tagValue = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))
  return m ? m[1].trim() : ''
}

// 20260905120000[-3:BRT] → 2026-09-05. O fuso é ignorado de propósito: o dia
// impresso é o dia que o banco considera, e converter poderia empurrar para o
// dia anterior.
export function ofxDate(raw) {
  const m = String(raw || '').match(/^(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

// OFX manda ponto como decimal, mas há banco brasileiro que manda vírgula.
const ofxAmount = (raw) => {
  const s = String(raw || '').trim().replace(/\s/g, '')
  if (!s) return null
  const n = Number(s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

const decodeEntities = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")

/**
 * @returns {{kind:'card'|'account', bank:string, entries:Array<{date:string,
 *   description:string, amount:number, fitId:string, notes:string}>}}
 *   amount com sinal: negativo é saída de dinheiro, positivo é entrada.
 */
export function parseOFX(text) {
  if (!/<OFX>/i.test(text)) throw new Error('Arquivo não parece ser um OFX válido')

  const kind = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(text) ? 'card' : 'account'
  const bank = tagValue(text, 'ORG') || ''

  const entries = []
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) || []

  for (const block of blocks) {
    const date = ofxDate(tagValue(block, 'DTPOSTED'))
    const amount = ofxAmount(tagValue(block, 'TRNAMT'))
    if (!date || amount == null || amount === 0) continue

    const name = decodeEntities(tagValue(block, 'NAME'))
    const memo = decodeEntities(tagValue(block, 'MEMO'))
    // Cada banco põe a descrição útil num campo: uns no NAME, outros no MEMO,
    // vários repetem a mesma coisa nos dois.
    const description = name && memo && !memo.toLowerCase().includes(name.toLowerCase())
      ? (name.length >= memo.length ? name : memo)
      : (memo || name)
    const other = description === name ? memo : name
    const repeated = !other || description.toLowerCase().includes(other.toLowerCase())

    entries.push({
      date,
      description: description.replace(/\s+/g, ' ').trim() || 'Lançamento',
      amount,
      fitId: tagValue(block, 'FITID'),
      notes: repeated ? '' : other.replace(/\s+/g, ' ').trim(),
    })
  }

  return { kind, bank, entries }
}
