/**
 * Página de conferência visual dos gráficos, skeletons e estados vazios.
 *
 * Só existe em desenvolvimento (`npm run dev` → /preview.html): o build de
 * produção tem uma entrada só, index.html, então este arquivo não vai junto.
 *
 * O motivo de existir: gráfico é a única parte do app que build e teste não
 * conseguem julgar. Escala, colisão de rótulo e contraste precisam ser olhados,
 * e olhar isso dentro do app exigiria login, dados semeados e navegar até cada
 * tela. Aqui tudo aparece de uma vez, nos dois temas.
 */
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@flaticon/flaticon-uicons/css/regular/rounded.css'
import './App.css'

import { AppContext } from './context/AppContext'
import { createFormatters, createTranslator } from './i18n'
import BarChart from './components/charts/BarChart'
import TrendChart from './components/charts/TrendChart'
import DonutChart from './components/charts/DonutChart'
import EmptyState from './components/EmptyState'
import ScreenSkeleton from './components/Skeleton'
import QuickAdd from './components/QuickAdd'
import SplitEditor from './components/SplitEditor'
import StreakBadge from './components/StreakBadge'
import { ToastProvider } from './components/Toast'
import { CATEGORIES } from './utils/categories'
import { buildEqualSplit } from './utils/split'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun']

const monthly = MONTHS.map((label, i) => ({
  key: `2026-0${i + 1}`,
  label,
  income: [5200, 5200, 6100, 5200, 8400, 5200][i],
  expenses: [3900, 4700, 3100, 5600, 4200, 4837][i],
}))

const categories = [
  { name: 'Moradia', value: 2100 },
  { name: 'Alimentação', value: 1240 },
  { name: 'Transporte', value: 620 },
  { name: 'Lazer', value: 410 },
  { name: 'Saúde', value: 290 },
  { name: 'Educação', value: 180 },
  { name: 'Vestuário', value: 95 },
  { name: 'Tecnologia', value: 60 },
]

// Casos-limite que já quebraram algo antes.
const singleMonth = [{ key: 'a', label: 'jun', income: 4837, expenses: 1200 }]
const allZero = MONTHS.map(label => ({ key: label, label, income: 0, expenses: 0 }))
const oneCategory = [{ name: 'Moradia', value: 2100 }]
const tinySlice = [{ name: 'Moradia', value: 10000 }, { name: 'Lazer', value: 3 }]
const bigNumbers = [
  { name: 'Imóvel', value: 1234567.89 },
  { name: 'Ações', value: 456789.12 },
  { name: 'Reserva', value: 98765.43 },
]

// Histórico fake com hábito embutido (Ifood 3×, Uber 2×) e dias seguidos, para
// os chips de "De novo" e o streak terem o que mostrar.
const today = new Date()
const daysAgo = (n) => {
  const d = new Date(today)
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

const fakeTransactions = [
  { id: '1', name: 'Ifood',  amount: 32, category: 'Alimentação', type: 'expense', date: daysAgo(0), status: 'completed', tags: ['role'] },
  { id: '2', name: 'Uber',   amount: 14, category: 'Transporte',  type: 'expense', date: daysAgo(1), status: 'completed', tags: [] },
  { id: '3', name: 'Ifood',  amount: 28, category: 'Alimentação', type: 'expense', date: daysAgo(2), status: 'completed', tags: [] },
  { id: '4', name: 'Uber',   amount: 12, category: 'Transporte',  type: 'expense', date: daysAgo(3), status: 'completed', tags: [] },
  { id: '5', name: 'Ifood',  amount: 35, category: 'Alimentação', type: 'expense', date: daysAgo(4), status: 'completed', tags: ['viagem-floripa'] },
]

function makeCtx(language = 'pt-BR') {
  const fmt = createFormatters(language, 'BRL')
  return {
    ...fmt,
    t: createTranslator(language),
    settings: { language, currency: 'BRL' },
    // Campos que as peças novas leem. Valores fixos: aqui se confere o visual,
    // não a conta — a conta tem teste próprio em utils/.
    transactions: fakeTransactions,
    categories: CATEGORIES,
    wallets: [{ id: 'w1', name: 'Nubank' }],
    daysLeft: 11,
    addTransaction: async () => {},
  }
}

function Section({ title, children, cols = 2 }) {
  return (
    <section style={{ marginBottom: 34 }}>
      <h2 style={{
        fontSize: 12, textTransform: 'uppercase', letterSpacing: '.8px',
        color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700,
      }}>{title}</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 16,
      }}>{children}</div>
    </section>
  )
}

const Card = ({ children }) => <div className="card">{children}</div>

function Gallery() {
  return (
    <>
      <Section title="Barras agrupadas — receita × despesa">
        <Card><BarChart title="Receitas vs Despesas" subtitle="Últimos 6 meses" data={monthly} /></Card>
        <Card><BarChart title="Um mês só" subtitle="caso-limite" data={singleMonth} /></Card>
      </Section>

      <Section title="Barras — casos degenerados">
        <Card><BarChart title="Tudo zero" subtitle="carteira nova" data={allZero} /></Card>
        <Card>
          <BarChart title="Ordens de grandeza" subtitle="escala forçada"
            data={MONTHS.map((label, i) => ({ key: label, label, income: 10 ** i, expenses: 10 ** i / 2 }))} />
        </Card>
      </Section>

      <Section title="Tendência">
        <Card>
          <TrendChart title="Tendência de Receitas" subtitle="Últimos 6 meses"
            data={monthly.map(d => ({ key: d.key, label: d.label, value: d.income }))}
            color="var(--chart-income)" />
        </Card>
        <Card>
          <TrendChart title="Tendência de Despesas" subtitle="Últimos 6 meses"
            data={monthly.map(d => ({ key: d.key, label: d.label, value: d.expenses }))}
            color="var(--chart-expense)" />
        </Card>
      </Section>

      <Section title="Donut">
        <Card>
          <DonutChart title="Categorias" subtitle="oito categorias, dobra em Outros"
            items={categories} centerLabel="Total" />
        </Card>
        <Card>
          <DonutChart title="Uma categoria só" subtitle="caso-limite"
            items={oneCategory} centerLabel="Total" />
        </Card>
      </Section>

      <Section title="Donut — fatia minúscula">
        <Card>
          <DonutChart title="Fatia de 0,03%" subtitle="a folga não pode inverter a fatia"
            items={tinySlice} centerLabel="Total" />
        </Card>
        <Card>
          <DonutChart title="Valores grandes" subtitle="pior caso do texto central"
            items={bigNumbers} centerLabel="Total" />
        </Card>
      </Section>

      <Section title="Estados vazios" cols={3}>
        <Card>
          <EmptyState icon="fi-rr-chart-histogram" title="Sem dados para o período"
            description="Assim que houver movimentação, o gráfico aparece aqui." />
        </Card>
        <Card>
          <EmptyState variant="filter" icon="fi-rr-search" title="Nenhum resultado com esses filtros"
            description="Você tem transações cadastradas, mas nenhuma se encaixa na busca ou no período."
            action={{ label: 'Limpar filtros', icon: 'fi-rr-cross-small', onClick: () => {} }} />
        </Card>
        <Card>
          <EmptyState variant="screen" icon="fi-rr-receipt" title="Nenhuma transação ainda"
            description="Lance sua primeira receita ou despesa para o resto do app começar a fazer sentido."
            action={{ label: 'Nova transação', icon: 'fi-rr-plus', onClick: () => {} }} />
        </Card>
      </Section>

      <Section title="Skeleton — Visão Geral" cols={1}>
        <ScreenSkeleton screen="overview" label="Carregando" />
      </Section>

      <Section title="Skeleton — Transações" cols={1}>
        <ScreenSkeleton screen="transactions" label="Carregando" />
      </Section>

      {/* As peças do lançamento rápido, dos insights e da divisão de conta.
          Estreite a janela (ou abra no celular) para conferir o mobile: é a
          única forma de julgar alvo de toque e quebra de linha. */}
      <Section title="Insights — faixa do topo" cols={1}>
        <div className="insight-strip">
          <div className="insight insight--good">
            <i className="fi fi-rr-check-circle" />
            <span>Sobram R$ 180,00 para os 11 dias que faltam — R$ 16,36 por dia.</span>
          </div>
          <div className="insight insight--warn">
            <i className="fi fi-rr-triangle-warning" />
            <span>Alimentação está 40% acima da sua média: R$ 420,00 até agora.</span>
          </div>
          <div className="insight insight--bad">
            <i className="fi fi-rr-exclamation" />
            <span>Você já gastou R$ 200,00 a mais do que entrou, e ainda faltam 11 dias no mês.</span>
          </div>
        </div>
      </Section>

      <Section title="Streak — indicador do header" cols={1}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <StreakBadge />
          <span className="streak-badge at-risk">
            <i className="fi fi-rr-flame" /><span className="streak-count">5</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            ativo · em risco (hoje ainda em branco)
          </span>
        </div>
      </Section>

      <Section title="Tags — faixa de filtro" cols={1}>
        <div className="tag-filter-bar">
          <span className="tag-filter-label">Tags</span>
          <div className="tag-filter-chips">
            <button className="tag-filter-chip active">#role<span className="tag-filter-count">4</span></button>
            <button className="tag-filter-chip">#viagem-floripa<span className="tag-filter-count">12</span></button>
            <button className="tag-filter-chip">#vaquinha<span className="tag-filter-count">2</span></button>
            <button className="tag-filter-chip">#faculdade<span className="tag-filter-count">7</span></button>
          </div>
        </div>
      </Section>

      <Section title="Primeiro uso — Visão Geral vazia" cols={1}>
        <div className="card overview-first-run">
          <div className="overview-first-run-icon"><i className="fi fi-rr-plus" /></div>
          <h2 className="overview-first-run-title">Comece lançando um gasto</h2>
          <p className="overview-first-run-text">
            Assim que houver o primeiro lançamento, esta tela mostra seu saldo, para
            onde o dinheiro está indo e quanto ainda dá para gastar no mês.
          </p>
          <button className="btn btn-primary overview-first-run-cta">
            <i className="fi fi-rr-plus" /> Lançar meu primeiro gasto
          </button>
          <p className="overview-first-run-hint">
            Dica: o botão + abre o lançamento rápido — digite “almoço 32” e pronto.
          </p>
        </div>
      </Section>

      <Section title="Divisão de conta" cols={1}>
        <Card><SplitDemo /></Card>
      </Section>

      <Section title="Lançamento rápido" cols={1}>
        <QuickAddDemo />
      </Section>
    </>
  )
}

// Estado próprio: o editor é controlado, e sem alguém segurando o valor não dá
// para ver o que acontece ao adicionar ou remover gente.
function SplitDemo() {
  const [split, setSplit] = useState(() => buildEqualSplit(120, ['Ana', 'Bia', 'Caio']))
  return <SplitEditor amount={120} split={split} onChange={setSplit} onSettle={() => {}} />
}

function QuickAddDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <i className="fi fi-rr-plus" /> Abrir lançamento rápido
      </button>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
        Tente “almoço 32”, “uber 12,50 ontem”, “freela 800”, “2 cafés R$ 18”.
        Salvar não grava nada aqui.
      </p>
      {open && <QuickAdd onClose={() => setOpen(false)} onExpand={() => setOpen(false)} />}
    </>
  )
}

function Preview() {
  // Tema e idioma vêm da URL para o screenshot headless conseguir capturar as
  // variantes sem clicar em nada: ?theme=dark&lang=en-US
  const params = new URLSearchParams(window.location.search)
  const [theme, setTheme] = useState(params.get('theme') === 'dark' ? 'dark' : 'light')
  const [lang, setLang] = useState(params.get('lang') || 'pt-BR')
  document.documentElement.setAttribute('data-theme', theme)

  return (
    <ToastProvider>
    <AppContext.Provider value={makeCtx(lang)}>
      <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15 }}>Preview de gráficos</strong>
          <button className="btn btn-secondary btn-sm" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
            tema: {theme}
          </button>
          <select className="form-select" style={{ width: 150 }} value={lang} onChange={e => setLang(e.target.value)}>
            <option value="pt-BR">pt-BR</option>
            <option value="en-US">en-US</option>
            <option value="es">es</option>
          </select>
        </div>
        <Gallery />
      </div>
    </AppContext.Provider>
    </ToastProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode><Preview /></StrictMode>
)
