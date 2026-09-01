import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import Modal from './Modal'
import CurrencyInput from './CurrencyInput'
import { apiFetch } from '../utils/api'

const fmtN = (n, d = 2, locale = 'pt-BR') =>
  (Number(n) || 0).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d })

const TYPES = ['Ação', 'Cripto', 'FII/ETF', 'Renda F.', 'Outro']
const COLORS = ['#0053EF', '#CFF330', '#0A0A0A', '#E8382A', '#18A058', '#BBBBBB', '#555555', '#3370F5']

const EMPTY_FORM = { name: '', ticker: '', type: 'Ação', quantity: '', avgPrice: '', currentPrice: '', color: '#0053EF' }

// ─── Market data ──────────────────────────────────────────────────────────────

const MARKET_ASSETS = {
  'Ação':   ['PETR4','VALE3','ITUB4','BBDC4','ABEV3','WEGE3','BBAS3','RADL3','RENT3','EGIE3','SUZB3','EMBR3'],
  'FII':    ['MXRF11','KNRI11','HGLG11','XPML11','VISC11','BCFF11','IRDM11','RECR11'],
  'ETF':    ['BOVA11','IVVB11','SMAL11','DIVO11'],
  'Cripto': ['BTC','ETH','SOL','BNB','ADA','AVAX','LINK','DOT'],
}

const TICKER_NAMES = {
  PETR4:'Petrobras', VALE3:'Vale', ITUB4:'Itaú Unibanco', BBDC4:'Bradesco',
  ABEV3:'Ambev', WEGE3:'WEG', BBAS3:'Banco do Brasil', RADL3:'Raia Drogasil',
  RENT3:'Localiza', EGIE3:'Engie Brasil', SUZB3:'Suzano', EMBR3:'Embraer',
  MXRF11:'Maxi Renda FII', KNRI11:'Kinea Renda Imob.', HGLG11:'CSHG Logística',
  XPML11:'XP Malls', VISC11:'Vinci Shopping Centers', BCFF11:'BTG Pactual CRI',
  IRDM11:'Iridium Recebíveis', RECR11:'REC Recebíveis Imob.',
  BOVA11:'iShares Ibovespa', IVVB11:'iShares S&P 500', SMAL11:'iShares Small Cap',
  DIVO11:'Trend Dividendos',
  BTC:'Bitcoin', ETH:'Ethereum', SOL:'Solana', BNB:'BNB',
  ADA:'Cardano', AVAX:'Avalanche', LINK:'Chainlink', DOT:'Polkadot',
}

const CRYPTO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  ADA: 'cardano', AVAX: 'avalanche-2', LINK: 'chainlink', DOT: 'polkadot',
}

const TYPE_MAP  = { 'Ação': 'Ação', 'FII': 'FII/ETF', 'ETF': 'FII/ETF', 'Cripto': 'Cripto' }
// Renda F. e Outro não têm cotação de mercado — ficam de fora da reprecificação.
const PRICEABLE = ['Ação', 'FII/ETF', 'Cripto']
const BOLSAI_BASE = '/api/bolsai'
const CACHE_TTL = 5 * 60 * 1000
const marketCache = {}

async function fetchCryptoQuotes(tickers) {
  const ids = tickers.map(tx => CRYPTO_IDS[tx]).filter(Boolean).join(',')
  const res  = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=brl&include_24hr_change=true`)
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
  const json = await res.json()
  return tickers.reduce((acc, ticker) => {
    const data = json[CRYPTO_IDS[ticker]]
    if (data) acc[ticker] = { ticker, name: TICKER_NAMES[ticker] || ticker, price: data.brl, change: data.brl_24h_change ?? null }
    return acc
  }, {})
}

async function fetchOneTicker(ticker, tab) {
  // ETFs (BOVA11, IVVB11...) também vivem em /stocks — só FII usa /fiis.
  const path = tab === 'FII' ? `/fiis/${ticker}` : `/stocks/${ticker}/stats`
  const res  = await apiFetch(`${BOLSAI_BASE}${path}`)
  if (!res.ok) throw new Error(`${ticker}: HTTP ${res.status}`)
  const json = await res.json()

  if (tab === 'FII') {
    if (!json.close_price) return null
    return { ticker: json.ticker, name: json.name || TICKER_NAMES[ticker] || ticker, price: json.close_price, change: null }
  }
  if (!json.close) return null
  return { ticker: json.ticker, name: TICKER_NAMES[ticker] || ticker, price: json.close, change: json.daily_change_pct ?? null }
}

// Cotação de um ativo da carteira. /stocks/{t}/stats cobre ação, ETF e também
// FII (HGLG11 responde ali com o mesmo close do /fiis), então um endpoint só
// resolve tudo que não é cripto.
async function fetchQuoteFor(inv) {
  const ticker = (inv.ticker || '').trim().toUpperCase()
  if (!ticker || !PRICEABLE.includes(inv.type)) return null

  if (inv.type === 'Cripto') {
    const quotes = await fetchCryptoQuotes([ticker])
    return quotes[ticker]?.price ?? null
  }

  const res = await apiFetch(`${BOLSAI_BASE}/stocks/${ticker}/stats`)
  if (!res.ok) throw new Error(`${ticker}: HTTP ${res.status}`)
  const json = await res.json()
  return json.close ?? null
}

// ─── Market Explorer ──────────────────────────────────────────────────────────

function MarketExplorer({ onAdd }) {
  const { formatCurrency: fmt, t } = useApp()
  const [tab, setTab] = useState('Ação')
  const [quotes, setQuotes] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = async (assetTab, force = false) => {
    const now = Date.now()
    if (!force && marketCache[assetTab] && now - marketCache[assetTab].ts < CACHE_TTL) {
      setQuotes(marketCache[assetTab].data)
      return
    }
    if (force) delete marketCache[assetTab]

    setLoading(true)
    setError(null)
    setQuotes({})

    const tickers = MARKET_ASSETS[assetTab]
    const result = {}

    try {
      if (assetTab === 'Cripto') {
        const cryptos = await fetchCryptoQuotes(tickers)
        Object.assign(result, cryptos)
        setQuotes(cryptos)
      } else {
        // Em paralelo e tolerante a falha: um ticker fora do ar não derruba a aba.
        await Promise.allSettled(tickers.map(async ticker => {
          const q = await fetchOneTicker(ticker, assetTab)
          if (q) {
            result[ticker] = q
            setQuotes(prev => ({ ...prev, [ticker]: q }))
          }
        }))
      }

      if (!Object.keys(result).length) throw new Error('nenhuma cotação retornada')
      marketCache[assetTab] = { data: result, ts: Date.now() }
    } catch {
      setError('Falha ao buscar dados de mercado.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(tab) }, [tab])

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{t('inv.explore')}</span>
        <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          {Object.keys(MARKET_ASSETS).map(name => (
            <button
              key={name}
              onClick={() => setTab(name)}
              style={{
                padding: '4px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                background: tab === name ? 'var(--accent)' : 'var(--bg-hover)',
                color: tab === name ? 'white' : 'var(--text-secondary)',
              }}
            >{name}</button>
          ))}
        </div>
        <button
          onClick={() => load(tab, true)}
          title={t('inv.refresh')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}
        >↺</button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="empty-state"><p>{t('inv.loadingQuotes')}</p></div>
      ) : error ? (
        <div className="empty-state">
          <p style={{ color: 'var(--accent-red)', marginBottom: 8 }}>{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => load(tab, true)}>{t('inv.retry')}</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 1, background: 'var(--border)' }}>
          {MARKET_ASSETS[tab].map(ticker => {
            const q = quotes[ticker]
            const pos = (q?.change ?? 0) >= 0
            return (
              <div key={ticker} style={{ background: 'var(--bg-card)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{ticker}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                      {q?.name || '—'}
                    </div>
                  </div>
                  <button
                    onClick={() => q && onAdd({ ticker, name: q.name || ticker, type: TYPE_MAP[tab], currentPrice: q.price })}
                    disabled={!q}
                    title={t('inv.addToPortfolio', { ticker })}
                    style={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: 6, border: 'none',
                      background: q ? 'var(--accent)' : 'var(--bg-hover)',
                      color: 'white', fontSize: 18, fontWeight: 700,
                      cursor: q ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >+</button>
                </div>
                {q ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{fmt(q.price)}</span>
                    {q.change != null ? (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: pos ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                        color: pos ? 'var(--accent-green)' : 'var(--accent-red)',
                      }}>
                        {pos ? '+' : ''}{fmtN(q.change, 2)}%
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        {tab === 'Cripto' ? 'Fonte: CoinGecko · Dados em tempo real · Valores em BRL' : 'Fonte: Bolsai · Dados com até 15 min de defasagem · Valores em BRL'}
      </div>
    </div>
  )
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

function AllocationDonut({ data, t }) {
  const r = 70, cx = 85, cy = 85
  const circumference = 2 * Math.PI * r
  const total = data.reduce((s, d) => s + d.value, 0) || 1

  const segments = data.reduce((acc, seg) => {
    const pct = seg.value / total
    const dash = pct * circumference
    const off = acc.length > 0 ? acc[acc.length - 1].nextOff : 0
    acc.push({ ...seg, dash, gap: circumference - dash, off, nextOff: off + dash })
    return acc
  }, [])

  return (
    <div className="donut-wrap" style={{ gap: 24 }}>
      <div className="donut-chart" style={{ width: 170, height: 170 }}>
        <svg className="donut-svg" width="170" height="170" viewBox="0 0 170 170">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2d3e" strokeWidth="20" />
          {segments.map((seg, i) => (
            <circle key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke={seg.color} strokeWidth="20"
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={-seg.off} strokeLinecap="round"
            >
              <title>{seg.name}: {((seg.value / total) * 100).toFixed(1)}%</title>
            </circle>
          ))}
        </svg>
        <div className="donut-center">
          <span className="donut-center-value">{data.length}</span>
          <span className="donut-center-label">{t('inv.assets')}</span>
        </div>
      </div>
      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div key={i} className="donut-legend-item">
            <div className="donut-legend-dot" style={{ background: seg.color }} />
            <div className="donut-legend-info">
              <span className="donut-legend-name">{seg.name}</span>
              <span className="donut-legend-pct">{((seg.value / total) * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Investment Modal ─────────────────────────────────────────────────────────

function InvModal({ initial, onSave, onClose }) {
  const { currencySymbol, t } = useApp()
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY_FORM
    return {
      ...EMPTY_FORM,
      ...initial,
      quantity: initial.quantity != null ? String(initial.quantity) : '',
      avgPrice: initial.avgPrice != null ? String(initial.avgPrice) : String(initial.currentPrice || ''),
      currentPrice: initial.currentPrice != null ? String(initial.currentPrice) : '',
    }
  })
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = () => {
    if (!form.name.trim() || !form.ticker.trim() || !form.quantity || !form.avgPrice) return
    onSave({
      ...form,
      quantity: Number(form.quantity),
      avgPrice: Number(form.avgPrice),
      currentPrice: Number(form.currentPrice) || Number(form.avgPrice),
    })
    onClose()
  }

  return (
    <Modal
      title={t(initial?.id ? 'inv.editTitle' : 'inv.newTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave}>{t('action.save')}</button>
        </>
      }
    >
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('inv.name')}</label>
          <input className="form-input" placeholder={t('inv.namePlaceholder')} value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('inv.ticker')}</label>
          <input className="form-input" placeholder={t('inv.tickerPlaceholder')} value={form.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('inv.type')}</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            {TYPES.map(tx => <option key={tx} value={tx}>{tx}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('inv.quantity')}</label>
          <input className="form-input" type="number" min="0" step="any" placeholder="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('inv.avgPrice', { symbol: currencySymbol })}</label>
          <CurrencyInput className="form-input" value={form.avgPrice} onChange={v => set('avgPrice', v)} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('inv.currentPrice', { symbol: currencySymbol })}</label>
          <CurrencyInput className="form-input" value={form.currentPrice} onChange={v => set('currentPrice', v)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">{t('inv.color')}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {COLORS.map(color => (
            <button key={color} type="button" onClick={() => set('color', color)}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: color, cursor: 'pointer',
                border: form.color === color ? '3px solid white' : '3px solid transparent',
                outline: form.color === color ? `2px solid ${color}` : 'none',
              }}
            />
          ))}
          <label title={t('inv.customColor')} style={{ position: 'relative', width: 28, height: 28, cursor: 'pointer' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
              border: !COLORS.includes(form.color) ? '3px solid white' : '3px solid transparent',
              outline: !COLORS.includes(form.color) ? `2px solid ${form.color}` : 'none',
            }} />
            <input
              type="color"
              value={form.color}
              onChange={e => set('color', e.target.value)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, top: 0, left: 0 }}
            />
          </label>
        </div>
      </div>
    </Modal>
  )
}

function ConfirmModal({ name, onConfirm, onClose }) {
  const { t } = useApp()
  return (
    <Modal title={t('inv.removeTitle')} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
        <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>{t('inv.remove')}</button>
      </>}
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
        {t('inv.removeConfirm', { name })}
      </p>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Investments() {
  const { investments, addInvestment, updateInvestment, deleteInvestment, formatCurrency: fmt, locale, t } = useApp()
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [delItem, setDelItem] = useState(null)
  const [presetItem, setPresetItem] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState(null)

  const priceable = investments.filter(i => i.ticker && PRICEABLE.includes(i.type))

  // currentPrice era só um campo digitado à mão: depois do cadastro a carteira
  // congelava e o retorno virava ficção. Aqui ela é reprecificada de verdade.
  const refreshPrices = async () => {
    if (!priceable.length) {
      setRefreshMsg({ error: true, text: 'Nenhum ativo com cotação de mercado na carteira.' })
      return
    }
    setRefreshing(true)
    setRefreshMsg(null)

    const failed = []
    let updated = 0
    // Em paralelo e tolerante a falha: um ticker fora do ar não impede os outros.
    await Promise.allSettled(priceable.map(async inv => {
      try {
        const price = await fetchQuoteFor(inv)
        if (price == null) { failed.push(inv.ticker); return }
        await updateInvestment(inv.id, { currentPrice: price, priceUpdatedAt: new Date().toISOString() })
        updated++
      } catch {
        failed.push(inv.ticker)
      }
    }))

    setRefreshing(false)
    setRefreshMsg(
      updated === 0
        ? { error: true, text: `Não foi possível atualizar: ${failed.join(', ')}` }
        : {
            error: false,
            text: t('inv.updatedCount', { count: updated })
              + (failed.length ? ` · falhou: ${failed.join(', ')}` : ''),
          }
    )
  }

  // Cotação mais recente da carteira — serve de "atualizado em".
  const lastPricedAt = investments
    .map(i => i.priceUpdatedAt)
    .filter(Boolean)
    .sort()
    .pop()

  const enriched = investments.map(inv => {
    const totalInvested = inv.quantity * inv.avgPrice
    const currentValue = inv.quantity * inv.currentPrice
    const returnVal = currentValue - totalInvested
    const returnPct = totalInvested > 0 ? (returnVal / totalInvested) * 100 : 0
    return { ...inv, totalInvested, currentValue, returnVal, returnPct }
  })

  const totalInvested = enriched.reduce((s, i) => s + i.totalInvested, 0)
  const totalValue = enriched.reduce((s, i) => s + i.currentValue, 0)
  const totalReturn = totalValue - totalInvested
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0

  const donutData = enriched.map(inv => ({ name: inv.ticker, value: inv.currentValue, color: inv.color }))

  const typeMap = enriched.reduce((acc, inv) => {
    acc[inv.type] = (acc[inv.type] || 0) + inv.currentValue
    return acc
  }, {})

  return (
    <div className="screen">
      {/* Summary */}
      <div className="summary-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="summary-stat">
          <div className="summary-stat-label">{t('inv.totalValue')}</div>
          <div className="summary-stat-value">{fmt(totalValue)}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">{t('inv.totalInvested')}</div>
          <div className="summary-stat-value">{fmt(totalInvested)}</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">{t('inv.totalReturn')}</div>
          <div className={`summary-stat-value ${totalReturn >= 0 ? 'positive-text' : 'negative-text'}`}>
            {totalReturn >= 0 ? '+' : ''}{fmt(totalReturn)}
          </div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat-label">{t('inv.yield')}</div>
          <div className={`summary-stat-value ${totalReturnPct >= 0 ? 'positive-text' : 'negative-text'}`}>
            {totalReturnPct >= 0 ? '+' : ''}{fmtN(totalReturnPct, 2)}%
          </div>
        </div>
      </div>

      {/* Market explorer */}
      <MarketExplorer onAdd={preset => setPresetItem(preset)} />

      <div className="charts-row">
        {/* Allocation chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{t('inv.allocationByType')}</div>
              <div className="card-subtitle">{t('inv.portfolioSplit')}</div>
            </div>
          </div>
          {donutData.length > 0 ? (
            <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
              <AllocationDonut t={t} data={donutData} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(typeMap).sort((a, b) => b[1] - a[1]).map(([type, val], i) => (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{type}</span>
                      <span style={{ fontWeight: 600 }}>{((val / totalValue) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="progress-bar" style={{ height: 6 }}>
                      <div className="progress-fill" style={{ width: `${(val / totalValue) * 100}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state"><p>{t('inv.noAssets')}</p></div>
          )}
        </div>

        {/* Stats */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div className="card-title">{t('inv.summary')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Ativos na carteira', value: investments.length },
              { label: 'Maior valorização', value: enriched.length > 0 ? `${[...enriched].sort((a, b) => b.returnPct - a.returnPct)[0]?.ticker} (+${fmtN(Math.max(...enriched.map(i => i.returnPct)), 1)}%)` : '—' },
              { label: 'Maior alocação', value: enriched.length > 0 ? `${[...enriched].sort((a, b) => b.currentValue - a.currentValue)[0]?.ticker} (${(([...enriched].sort((a, b) => b.currentValue - a.currentValue)[0]?.currentValue / totalValue) * 100).toFixed(1)}%)` : '—' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{t('inv.myPortfolio', { count: investments.length })}</span>
            {refreshMsg ? (
              <span style={{ fontSize: 11, color: refreshMsg.error ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                {refreshMsg.text}
              </span>
            ) : lastPricedAt && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {t('inv.quotesFrom', { date: new Date(lastPricedAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) })}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={refreshPrices}
              disabled={refreshing || !priceable.length}
              title={t(priceable.length ? 'inv.refreshTitle' : 'inv.refreshNone')}
            >
              <i className={`fi fi-rr-refresh${refreshing ? ' spinning' : ''}`} style={{ marginRight: 6 }} />
              {t(refreshing ? 'inv.refreshing' : 'inv.refreshQuotes')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setAddModal(true)}>{t('inv.newAsset')}</button>
          </div>
        </div>
        {enriched.length === 0 ? (
          <div className="empty-state">
            <i className="fi fi-rr-chart-line-up" style={{ fontSize: 34, color: 'var(--text-muted)' }} />
            <p>{t('inv.emptyPortfolio')}</p>
            <button className="btn btn-primary" onClick={() => setAddModal(true)}>{t('inv.addFirst')}</button>
          </div>
        ) : (<>
          {/* ── Desktop table ── */}
          <table className="investments-table transactions-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 20px 12px' }}>{t('inv.asset')}</th>
                <th>{t('inv.type')}</th>
                <th style={{ textAlign: 'right' }}>{t('inv.qty')}</th>
                <th style={{ textAlign: 'right' }}>{t('inv.avgPriceShort')}</th>
                <th style={{ textAlign: 'right' }}>{t('inv.currentPriceShort')}</th>
                <th style={{ textAlign: 'right' }}>{t('inv.totalValue')}</th>
                <th style={{ textAlign: 'right' }}>{t('inv.return')}</th>
                <th style={{ textAlign: 'right' }}>{t('inv.allocation')}</th>
                <th style={{ textAlign: 'right', paddingRight: 20 }}>{t('tx.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {[...enriched].sort((a, b) => b.currentValue - a.currentValue).map(inv => (
                <tr key={inv.id}>
                  <td style={{ paddingLeft: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: inv.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.ticker}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.name}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="category-tag">{inv.type}</span></td>
                  <td style={{ textAlign: 'right', fontSize: 13 }}>{fmtN(inv.quantity, inv.quantity % 1 === 0 ? 0 : 4)}</td>
                  <td style={{ textAlign: 'right', fontSize: 13 }}>{fmt(inv.avgPrice)}</td>
                  <td style={{ textAlign: 'right', fontSize: 13 }}>{fmt(inv.currentPrice)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{fmt(inv.currentValue)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: inv.returnPct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {inv.returnPct >= 0 ? '+' : ''}{fmtN(inv.returnPct, 2)}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {inv.returnVal >= 0 ? '+' : ''}{fmt(inv.returnVal)}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 13 }}>
                    {((inv.currentValue / totalValue) * 100).toFixed(1)}%
                  </td>
                  <td style={{ paddingRight: 20 }}>
                    <div className="table-actions">
                      <button className="btn-icon" title={t('action.edit')} onClick={() => setEditItem(inv)}><i className="fi fi-rr-pencil" /></button>
                      <button className="btn-icon danger" title={t('inv.remove')} onClick={() => setDelItem(inv)}><i className="fi fi-rr-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Mobile card-list ── */}
          <ul className="inv-card-list">
            {[...enriched].sort((a, b) => b.currentValue - a.currentValue).map(inv => (
              <li key={inv.id} className="inv-card">
                <div className="inv-card-dot" style={{ background: inv.color }} />
                <div className="inv-card-body">
                  <div className="inv-card-top">
                    <div>
                      <span className="inv-card-ticker">{inv.ticker}</span>
                      <span className="inv-card-fullname">{inv.name}</span>
                    </div>
                    <span className="inv-card-value">{fmt(inv.currentValue)}</span>
                  </div>
                  <div className="inv-card-meta">
                    <span className="category-tag">{inv.type}</span>
                    <span className={inv.returnPct >= 0 ? 'positive-text' : 'negative-text'} style={{ fontSize: 12, fontWeight: 600 }}>
                      {inv.returnPct >= 0 ? '+' : ''}{fmtN(inv.returnPct, 2)}%
                    </span>
                    <span className="spacer" />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {fmtN(inv.quantity, inv.quantity % 1 === 0 ? 0 : 4)} un
                    </span>
                  </div>
                </div>
                <div className="table-actions">
                  <button className="btn-icon" onClick={() => setEditItem(inv)}><i className="fi fi-rr-pencil" /></button>
                  <button className="btn-icon danger" onClick={() => setDelItem(inv)}><i className="fi fi-rr-trash" /></button>
                </div>
              </li>
            ))}
          </ul>
        </>)}
      </div>

      {/* Modals */}
      {(addModal || presetItem) && (
        <InvModal
          initial={presetItem || undefined}
          onSave={addInvestment}
          onClose={() => { setAddModal(false); setPresetItem(null) }}
        />
      )}
      {editItem && (
        <InvModal
          initial={editItem}
          onSave={data => updateInvestment(editItem.id, data)}
          onClose={() => setEditItem(null)}
        />
      )}
      {delItem && (
        <ConfirmModal
          name={delItem.name}
          onConfirm={() => deleteInvestment(delItem.id)}
          onClose={() => setDelItem(null)}
        />
      )}
    </div>
  )
}
