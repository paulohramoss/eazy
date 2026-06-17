import { useState } from 'react'
import { useApp } from '../context/AppContext'
import CurrencyInput from './CurrencyInput'
import { DEFAULT_WALLET_ICON, WALLET_ICON_OPTIONS, resolveWalletIcon } from '../utils/walletIcons'

const WALLET_TYPES = [
  { value: 'checking',   label: 'Conta Corrente',  icon: 'fi-rr-bank' },
  { value: 'savings',    label: 'Poupança',         icon: 'fi-rr-piggy-bank' },
  { value: 'investment', label: 'Investimentos',    icon: 'fi-rr-chart-line-up' },
  { value: 'cash',       label: 'Dinheiro Físico',  icon: 'fi-rr-money-bill-wave' },
]

const COLORS = ['#0053EF', '#CFF330', '#18A058', '#E8382A', '#F59E0B', '#0A0A0A']

export default function Onboarding() {
  const { addWallet, addTransaction, categories, currencySymbol } = useApp()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [skipTx, setSkipTx] = useState(false)

  const [wallet, setWallet] = useState({
    name: '', type: 'checking', balance: 0, color: '#0053EF', icon: DEFAULT_WALLET_ICON,
  })
  const [tx, setTx] = useState({
    name: '', type: 'income', category: 'Salário', amount: 0,
  })

  const setW = (k, v) => setWallet(w => ({ ...w, [k]: v }))
  const setT = (k, v) => setTx(t => ({ ...t, [k]: v }))

  const handleFinish = async () => {
    setLoading(true)
    const ref = await addWallet({ ...wallet, icon: resolveWalletIcon(wallet.icon, wallet.type) })
    if (!skipTx && tx.name.trim() && Number(tx.amount) > 0) {
      await addTransaction({
        ...tx,
        amount: Number(tx.amount),
        walletId: ref.id,
        date: new Date().toISOString().split('T')[0],
        status: 'completed',
        notes: '', tags: [], cardId: '',
      })
    }
    setLoading(false)
    // wallets.length > 0 now — Dashboard unmounts this automatically
  }

  const bar = (n) => (
    <div style={{ height: 4, flex: 1, borderRadius: 2,
      background: n <= step ? 'var(--accent)' : 'var(--border)', transition: 'background .3s' }} />
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
          {[1, 2, 3].map(bar)}
        </div>

        {/* ── Step 1: Wallet type + name + color ─────────────────────────────── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Bem-vindo ao Eazy</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
                Vamos criar sua primeira carteira em 3 passos rápidos.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Nome da carteira</label>
              <input
                className="form-input" autoFocus
                placeholder="Ex: Nubank, Itaú, Carteira..."
                value={wallet.name}
                onChange={e => setW('name', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && wallet.name.trim() && setStep(2)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tipo</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {WALLET_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setW('type', t.value)} style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 500, fontSize: 14,
                    display: 'flex', alignItems: 'center', gap: 10, transition: 'all .15s',
                    border: wallet.type === t.value ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                    background: wallet.type === t.value ? 'rgba(var(--accent-rgb),.08)' : 'var(--bg-card)',
                    color: wallet.type === t.value ? 'var(--accent)' : 'var(--text-primary)',
                  }}>
                    <i className={`fi ${t.icon}`} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Cor</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setW('color', c)} style={{
                    width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: wallet.color === c ? '3px solid white' : '3px solid transparent',
                    outline: wallet.color === c ? `2px solid ${c}` : 'none',
                  }} />
                ))}
              </div>
            </div>

            <button className="btn btn-primary" style={{ padding: 16, fontSize: 16 }}
              disabled={!wallet.name.trim()} onClick={() => setStep(2)}>
              Próximo →
            </button>
          </div>
        )}

        {/* ── Step 2: Initial balance ─────────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Qual é o saldo atual?</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
                Informe quanto há em <strong>{wallet.name}</strong> agora. Pode ser zero.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Saldo inicial ({currencySymbol})</label>
              <CurrencyInput
                className="form-input" autoFocus
                style={{ fontSize: 32, fontWeight: 800, textAlign: 'center', height: 72 }}
                value={wallet.balance}
                onChange={v => setW('balance', v)}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1, padding: 14 }} onClick={() => setStep(1)}>
                ← Voltar
              </button>
              <button className="btn btn-primary" style={{ flex: 2, padding: 14, fontSize: 16 }} onClick={() => setStep(3)}>
                Próximo →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Optional first transaction ─────────────────────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Primeira transação</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
                Registre uma movimentação agora ou pule — você pode lançar depois.
              </p>
            </div>

            {!skipTx ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Tipo</label>
                    <select className="form-select" value={tx.type} onChange={e => setT('type', e.target.value)}>
                      <option value="income">Receita</option>
                      <option value="expense">Despesa</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Categoria</label>
                    <select className="form-select" value={tx.category} onChange={e => setT('category', e.target.value)}>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Descrição</label>
                  <input className="form-input" autoFocus
                    placeholder="Ex: Salário de junho, Conta de luz..."
                    value={tx.name} onChange={e => setT('name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Valor ({currencySymbol})</label>
                  <CurrencyInput className="form-input" value={tx.amount} onChange={v => setT('amount', v)} />
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                <i className="fi fi-rr-check-circle" style={{
                  fontSize: 52, color: 'var(--accent-green)', display: 'block', marginBottom: 12,
                }} />
                Tudo certo. Você pode lançar transações a qualquer momento.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" style={{ flex: 1, padding: 14, minWidth: 100 }} onClick={() => setStep(2)}>
                ← Voltar
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, padding: 14, minWidth: 100 }}
                onClick={() => setSkipTx(s => !s)}>
                {skipTx ? '+ Adicionar' : 'Pular'}
              </button>
              <button className="btn btn-primary"
                style={{ flex: 2, padding: 14, fontSize: 16, minWidth: 140 }}
                disabled={loading || (!skipTx && (!tx.name.trim() || !Number(tx.amount)))}
                onClick={handleFinish}>
                {loading ? 'Salvando...' : 'Concluir ✓'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
