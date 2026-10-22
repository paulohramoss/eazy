// pdfRows — extrai o texto de um PDF agrupado em linhas, com a posição de cada
// pedaço. É a única parte da importação que precisa do pdf.js; ele é carregado
// sob demanda porque pesa mais que o resto do app e só serve aqui.

// Itens com y a menos disto (em pontos) são a mesma linha. A meia linha das
// descrições quebradas em fatura fica em ~5pt, então precisa ser bem menor.
const SAME_ROW = 2

export class PdfPasswordError extends Error {
  constructor(wrong) {
    super(wrong ? 'Senha incorreta.' : 'Este PDF é protegido por senha.')
    this.name = 'PdfPasswordError'
    this.wrong = wrong
  }
}

async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

export function groupRows(items) {
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x))
  const rows = []
  for (const item of sorted) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(row.y - item.y) <= SAME_ROW) row.cells.push(item)
    else rows.push({ y: item.y, cells: [item] })
  }
  rows.forEach(r => r.cells.sort((a, b) => a.x - b.x))
  return rows
}

/** @returns {Promise<Array<{rows:Array<{y:number, cells:Array<{x,w,str}>}>}>>} */
export async function extractPdfRows(buffer, { password } = {}) {
  const pdfjs = await loadPdfjs()
  let doc
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), password: password || undefined }).promise
  } catch (err) {
    // code 1 = precisa de senha, 2 = senha errada.
    if (err?.name === 'PasswordException') throw new PdfPasswordError(err.code === 2)
    throw new Error('Não consegui abrir o PDF.')
  }

  const pages = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const items = content.items
      .filter(it => it.str && it.str.trim())
      .map(it => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, str: it.str.trim() }))
    pages.push({ rows: groupRows(items) })
  }
  await doc.destroy()
  return pages
}
