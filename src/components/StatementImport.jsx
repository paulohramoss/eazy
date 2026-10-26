import { useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useToast } from './Toast'
import Modal from './Modal'
import Checkbox from './Checkbox'
import { norm } from '../utils/text'
import { isoDate } from '../utils/date'
import { ACCEPTED_FILES, PdfPasswordError, categorize, parseStatementFile } from '../utils/statement'

// Importação de extrato: o arquivo do banco entra (fatura ou extrato em PDF,
// OFX, CSV, comprovante de Pix) e sai uma lista de lançamentos já com
// categoria, para a pessoa conferir e lançar de uma vez.
//
// Nada é gravado antes da revisão: leitura de PDF é heurística, e um valor
// errado no saldo custa mais que um clique a mais.

const FORMAT_LABEL = { pdf: 'PDF', ofx: 'OFX', csv: 'CSV' }
const KIND_LABEL = { card: 'Fatura de cartão', account: 'Extrato de conta', pix: 'Comprovante de Pix' }
const SKIP_LABEL = { payment: 'Pagamento da fatura', refunded: 'Estornado', duplicate: 'Já lançado' }

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
// Os mesmos dois status do formulário de transação.
const STATUSES = ['completed', 'pending']
const STATUS_KEY = { completed: 'tx.completed', pending: 'tx.pending' }

const SORTERS = {
  date: (a, b) => a.date.localeCompare(b.date),
  name: (a, b) => collator.compare(a.name, b.name),
  category: (a, b) => collator.compare(a.category, b.category),
  // Valor absoluto: ordenar por valor é procurar o maior lançamento, seja
  // gasto ou entrada.
  amount: (a, b) => a.amount - b.amount,
  status: (a, b) => a.status.localeCompare(b.status),
}

const SORT_OPTIONS = [
  ['date:asc', 'Mais antigas'],
  ['date:desc', 'Mais recentes'],
  ['amount:desc', 'Maior valor'],
  ['amount:asc', 'Menor valor'],
  ['name:asc', 'Nome (A–Z)'],
  ['category:asc', 'Categoria'],
  ['status:asc', 'Status'],
]

const signature = (tx) =>
  [tx.date, tx.type, Number(tx.amount).toFixed(2), (tx.name || '').trim().toLowerCase()].join('|')

// O cartão ou a conta cujo nome lembra o banco do arquivo ("Sicoob" acha o
// cartão "Mastercard Sicoob"). Sem pista, o primeiro da lista.
const guessDestination = (list, bank) => {
  if (!list.length) return ''
  const b = norm(bank)
  return (b && list.find(item => norm(item.name).includes(b)))?.id || list[0].id
}

export default function StatementImport({ onClose }) {
  const { transactions, wallets, creditCards, categories, importTransactions, formatCurrency: fmt, formatDate, t } = useApp()
  const toast = useToast()
  const inputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [stage, setStage] = useState('pick') // pick | loading | password | review | saving
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState(null)
  const [rows, setRows] = useState([])
  const [dest, setDest] = useState({ type: 'wallet', id: '' })
  const [dragging, setDragging] = useState(false)
  // 'each': cada linha com a própria data (editável). 'single': tudo numa data
  // só — a fatura imprime a data da compra, e muita gente prefere lançar tudo
  // no vencimento ou no dia do pagamento.
  const [dateMode, setDateMode] = useState('each')
  const [singleDate, setSingleDate] = useState('')
  const [sort, setSort] = useState({ key: 'date', dir: 'asc' })
  // No celular as opções de lançamento começam recolhidas: abertas, ocupavam a
  // tela inteira e a lista, que é o que se confere, sobrava com uma linha.
  const [settingsOpen, setSettingsOpen] = useState(() => !window.matchMedia?.('(max-width: 640px)').matches)

  const read = async (f, pwd) => {
    setStage('loading')
    setError('')
    try {
      const parsed = await parseStatementFile(f, { password: pwd })

      // Mais recente primeiro: é o hábito atual que deve ganhar.
      const history = [...transactions].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      const existing = new Set(transactions.map(signature))

      setRows(parsed.entries.map(e => {
        const category = e.category && categories.includes(e.category)
          ? e.category
          : categorize(e, { categories, history }).category
        const skip = e.skip || (existing.has(signature(e)) ? 'duplicate' : null)
        return { ...e, category, skip, selected: !skip, status: 'completed' }
      }))

      const isCard = parsed.kind === 'card'
      setDest(isCard && creditCards.length
        ? { type: 'card', id: guessDestination(creditCards, parsed.bank) }
        : { type: 'wallet', id: guessDestination(wallets, parsed.bank) })
      setDateMode('each')
      setSingleDate(parsed.dueDate || isoDate())
      setResult(parsed)
      setStage('review')
    } catch (err) {
      if (err instanceof PdfPasswordError) {
        setStage('password')
        setError(err.wrong ? 'Senha incorreta. Tente de novo.' : '')
        return
      }
      setError(err.message || 'Não consegui ler o arquivo.')
      setStage('pick')
    }
  }

  const pick = (f) => {
    if (!f) return
    setFile(f)
    setPassword('')
    read(f)
  }

  const setRow = (id, patch) => setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))

  // Status comum a todas as linhas, ou null quando alguma foi trocada à mão —
  // aí nenhum botão do atalho aparece marcado.
  const bulkStatus = rows.length && rows.every(r => r.status === rows[0].status) ? rows[0].status : null
  const setAllStatus = (status) => setRows(rs => rs.map(r => ({ ...r, status })))

  const selected = rows.filter(r => r.selected)
  const totals = useMemo(() => selected.reduce((acc, r) => {
    acc[r.type] += r.amount
    return acc
  }, { expense: 0, income: 0 }), [selected])

  const allSelected = rows.length > 0 && rows.every(r => r.selected)
  const toggleAll = () => setRows(rs => rs.map(r => ({ ...r, selected: !allSelected })))

  const save = async () => {
    if (!selected.length) return
    setStage('saving')
    try {
      const list = selected.map(r => ({
        date: dateMode === 'single' ? singleDate : r.date,
        name: r.name,
        amount: r.amount,
        type: r.type,
        category: r.category,
        notes: r.notes,
        status: r.status,
        walletId: dest.type === 'wallet' ? dest.id : '',
        cardId: dest.type === 'card' ? dest.id : '',
      }))
      const count = await importTransactions(list)
      toast.success(`${count} lançamento${count > 1 ? 's' : ''} importado${count > 1 ? 's' : ''}.`)
      onClose()
    } catch (err) {
      setError(err.message || 'Falha ao gravar.')
      setStage('review')
    }
  }

  const destList = dest.type === 'card' ? creditCards : wallets
  // O que fica de fora (pagamento, estorno, repetido) vai para o fim: o topo da
  // lista é o que vai ser lançado.
  // A ordenação escolhida vale dentro de cada grupo; os ignorados continuam
  // no fim para não se misturarem ao que vai ser lançado.
  const sorted = useMemo(() => {
    const cmp = SORTERS[sort.key]
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) =>
      (a.skip ? 1 : 0) - (b.skip ? 1 : 0) || dir * cmp(a, b) || a.id - b.id)
  }, [rows, sort])

  const toggleSort = (key) => setSort(s => (s.key === key
    ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
    // Valor começa do maior: é o que se procura primeiro numa fatura.
    : { key, dir: key === 'amount' ? 'desc' : 'asc' }))

  const sortHeader = (key, label, className = '') => (
    <button
      type="button"
      className={`stmt-sort ${className}${sort.key === key ? ' active' : ''}`}
      onClick={() => toggleSort(key)}
      aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <i className={`fi ${sort.key === key ? (sort.dir === 'asc' ? 'fi-rr-angle-small-up' : 'fi-rr-angle-small-down') : 'fi-rr-sort'}`} aria-hidden="true" />
    </button>
  )
  // Resumo das opções que aparece com a seção recolhida.
  const destName = destList.find(item => item.id === dest.id)?.name || (dest.type === 'card' ? 'Sem cartão' : 'Sem conta')
  const settingsSummary = [
    destName,
    dateMode === 'single' ? formatDate(singleDate) : 'data de cada compra',
    bulkStatus ? t(STATUS_KEY[bulkStatus]) : 'status variados',
  ].join(' · ')

  // Clicar em qualquer ponto da linha marca/desmarca — no celular o checkbox
  // sozinho é um alvo pequeno. Campos editáveis continuam com o próprio clique.
  const toggleRowFromClick = (e, r) => {
    if (e.target.closest('input, select, label, button')) return
    setRow(r.id, { selected: !r.selected })
  }

  const totalOk = result?.total && Math.abs(result.total.expected - result.total.computed) < 0.01

  const footer = stage === 'review' || stage === 'saving' ? (
    <>
      <div className="stmt-totals">
        <span>{selected.length} de {rows.length} selecionados</span>
        <span className="expense">Gastos {fmt(totals.expense)}</span>
        {totals.income > 0 && <span className="income">Entradas {fmt(totals.income)}</span>}
      </div>
      <button className="btn btn-secondary" onClick={() => { setStage('pick'); setResult(null); setRows([]) }}>
        Outro arquivo
      </button>
      <button className="btn btn-primary" disabled={!selected.length || stage === 'saving'} onClick={save}>
        <i className="fi fi-rr-check" />
        {stage === 'saving' ? 'Lançando...' : `Lançar ${selected.length}`}
      </button>
    </>
  ) : null

  return (
    <Modal title="Importar extrato" onClose={onClose} footer={footer} size="xl">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILES}
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; pick(f) }}
      />

      {(stage === 'pick' || stage === 'loading') && (
        <>
          <button
            type="button"
            className={`stmt-drop${dragging ? ' dragging' : ''}`}
            disabled={stage === 'loading'}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]) }}
          >
            <i className={`fi ${stage === 'loading' ? 'fi-rr-spinner stmt-spin' : 'fi-rr-cloud-upload'}`} />
            <strong>{stage === 'loading' ? `Lendo ${file?.name}...` : 'Arraste o arquivo do banco ou clique para escolher'}</strong>
            <span>Fatura do cartão ou extrato em PDF, OFX, CSV e comprovante de Pix em PDF</span>
          </button>
          <p className="stmt-hint">
            Os gastos são lidos e categorizados automaticamente. Você confere tudo antes de lançar:
            pagamento da fatura, estornos e lançamentos repetidos já vêm desmarcados.
          </p>
        </>
      )}

      {stage === 'password' && (
        <form
          className="stmt-password"
          onSubmit={e => { e.preventDefault(); if (password) read(file, password) }}
        >
          <i className="fi fi-rr-lock" />
          <div>
            <strong>{file?.name} é protegido por senha</strong>
            <span>Bancos costumam usar os primeiros dígitos do CPF do titular.</span>
          </div>
          <input
            className="form-input"
            type="password"
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Senha do PDF"
            aria-label="Senha do PDF"
          />
          <button className="btn btn-primary" type="submit" disabled={!password}>Abrir</button>
        </form>
      )}

      {error && (
        <div className="stmt-alert stmt-alert-error">
          <i className="fi fi-rr-cross-circle" /> {error}
        </div>
      )}

      {(stage === 'review' || stage === 'saving') && result && (
        <>
          <div className="stmt-summary">
            <div>
              <span className="stmt-pill">{FORMAT_LABEL[result.format]}</span>
              <span className="stmt-pill">{KIND_LABEL[result.kind]}</span>
              {result.bank && <span className="stmt-pill">{result.bank}</span>}
              <span className="stmt-file">{file?.name}</span>
            </div>
            {result.total && (
              <div className={`stmt-alert ${totalOk ? 'stmt-alert-ok' : 'stmt-alert-warn'}`}>
                <i className={`fi ${totalOk ? 'fi-rr-check' : 'fi-rr-exclamation'}`} />
                {totalOk
                  ? `Conferido: a soma lida bate com o total da fatura (${fmt(result.total.expected)}).`
                  : `Atenção: total da fatura ${fmt(result.total.expected)}, soma lida ${fmt(result.total.computed)}. Confira as linhas antes de lançar.`}
              </div>
            )}
            {result.invalid > 0 && (
              <div className="stmt-alert stmt-alert-warn">
                <i className="fi fi-rr-exclamation" /> {result.invalid} linha(s) sem data ou valor foram ignoradas.
              </div>
            )}
          </div>

          <details
            className="stmt-settings"
            open={settingsOpen}
            onToggle={e => setSettingsOpen(e.currentTarget.open)}
          >
            <summary>
              <i className="fi fi-rr-settings-sliders" aria-hidden="true" />
              <span className="stmt-settings-text">
                <strong>Como lançar</strong>
                <span>{settingsSummary}</span>
              </span>
              <i className="fi fi-rr-angle-small-down stmt-settings-chevron" aria-hidden="true" />
            </summary>
            <div className="stmt-settings-body">
              <div className="stmt-dest">
                <div className="stmt-dest-toggle" role="radiogroup" aria-label="Destino">
                  {[['wallet', 'Conta'], ['card', 'Cartão de crédito']].map(([type, label]) => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={dest.type === type}
                      className={dest.type === type ? 'active' : ''}
                      onClick={() => setDest({ type, id: guessDestination(type === 'card' ? creditCards : wallets, result.bank) })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <select
                  className="form-select"
                  value={dest.id}
                  onChange={e => setDest(d => ({ ...d, id: e.target.value }))}
                  aria-label="Lançar em"
                >
                  {dest.type === 'wallet' && <option value="">Sem conta</option>}
                  {destList.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {dest.type === 'card' && !creditCards.length && (
                  <span className="stmt-hint">Nenhum cartão cadastrado — os gastos entram sem cartão.</span>
                )}
              </div>

              <div className="stmt-dest">
                <div className="stmt-dest-toggle" role="radiogroup" aria-label="Data dos lançamentos">
                  {[['each', 'Data de cada compra'], ['single', 'Uma data para todos']].map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={dateMode === mode}
                      className={dateMode === mode ? 'active' : ''}
                      onClick={() => setDateMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {dateMode === 'single' ? (
                  <input
                    type="date"
                    className="form-input stmt-single-date"
                    value={singleDate}
                    onChange={e => e.target.value && setSingleDate(e.target.value)}
                    aria-label="Data para todos os lançamentos"
                  />
                ) : (
                  <span className="stmt-hint">Clique na data de uma linha para alterar só ela.</span>
                )}
                {dateMode === 'single' && result.dueDate === singleDate && (
                  <span className="stmt-hint">Vencimento da fatura</span>
                )}
              </div>

              {/* Atalho para o caso comum: fatura ainda não paga entra toda como
                  pendente. Cada linha continua podendo ter o próprio status. */}
              <div className="stmt-dest">
                <span className="stmt-dest-label">{t('tx.status')}</span>
                <div className="stmt-dest-toggle" role="radiogroup" aria-label={t('tx.status')}>
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={bulkStatus === s}
                      className={bulkStatus === s ? 'active' : ''}
                      onClick={() => setAllStatus(s)}
                    >
                      {t(STATUS_KEY[s])}
                    </button>
                  ))}
                </div>
                <span className="stmt-hint">
                  {bulkStatus ? 'Vale para todos; dá para mudar linha a linha.' : 'Status diferentes por linha.'}
                </span>
              </div>
            </div>
          </details>

          <div className="stmt-table" role="table">
            <div className="stmt-row stmt-head" role="row">
              <Checkbox checked={allSelected} onChange={toggleAll} label="Selecionar todos" indeterminate={!allSelected && selected.length > 0} />
              {sortHeader('date', 'Data')}
              {sortHeader('name', 'Descrição')}
              {sortHeader('category', 'Categoria')}
              {sortHeader('status', t('tx.status'))}
              {sortHeader('amount', 'Valor', 'stmt-amount')}
              {/* No celular não há colunas: o cabeçalho vira "selecionar todos"
                  e um seletor de ordem. */}
              <div className="stmt-head-mobile">
                <span>{allSelected ? 'Desmarcar todos' : 'Selecionar todos'}</span>
                <select
                  className="stmt-cat stmt-sort-select"
                  value={`${sort.key}:${sort.dir}`}
                  onChange={e => { const [key, dir] = e.target.value.split(':'); setSort({ key, dir }) }}
                  aria-label="Ordenar por"
                >
                  {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
            {sorted.map(r => (
              <div key={r.id} className={`stmt-row${r.selected ? '' : ' off'}`} role="row" onClick={e => toggleRowFromClick(e, r)}>
                <Checkbox checked={r.selected} onChange={() => setRow(r.id, { selected: !r.selected })} label={`Importar ${r.name}`} />
                {dateMode === 'single' ? (
                  <span className="stmt-date">{formatDate(singleDate)}</span>
                ) : (
                  <input
                    type="date"
                    className="stmt-date-input"
                    value={r.date}
                    onChange={e => e.target.value && setRow(r.id, { date: e.target.value })}
                    aria-label={`Data de ${r.name}`}
                  />
                )}
                <span className="stmt-name">
                  <input
                    className="stmt-name-input"
                    value={r.name}
                    onChange={e => setRow(r.id, { name: e.target.value })}
                    aria-label="Descrição"
                  />
                  {(r.skip || r.notes) && (
                    <small>
                      {r.skip && <span className={`stmt-badge stmt-badge-${r.skip}`}>{SKIP_LABEL[r.skip]}</span>}
                      {r.notes}
                    </small>
                  )}
                </span>
                <select
                  className="stmt-cat"
                  value={r.category}
                  onChange={e => setRow(r.id, { category: e.target.value })}
                  aria-label="Categoria"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  className={`stmt-cat stmt-status stmt-status-${r.status}`}
                  value={r.status}
                  onChange={e => setRow(r.id, { status: e.target.value })}
                  aria-label={t('tx.status')}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{t(STATUS_KEY[s])}</option>)}
                </select>
                <span className={`stmt-amount ${r.type}`}>
                  {r.type === 'expense' ? '−' : '+'}{fmt(r.amount)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
