/**
 * Placeholders de carregamento.
 *
 * Antes, trocar de tela mostrava um "Carregando..." centralizado enquanto o
 * chunk baixava — a página piscava do vazio para o conteúdo e a altura pulava.
 * Um esqueleto com a forma aproximada da tela alvo elimina os dois problemas: o
 * layout já nasce no tamanho certo e a espera parece mais curta porque há o que
 * olhar.
 */

// `aria-hidden` porque um leitor de tela não tem nada a ganhar descrevendo
// caixas cinzas; quem anuncia a espera é o `aria-busy` da região.
export function Skeleton({ w = '100%', h = 14, radius = 7, style }) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{ width: w, height: h, borderRadius: radius, ...style }}
    />
  )
}

export function SkeletonText({ lines = 3, width = ['100%', '92%', '64%'] }) {
  return (
    <span className="skeleton-text">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} w={width[i % width.length]} h={12} />
      ))}
    </span>
  )
}

function Card({ children, style }) {
  return <div className="card skeleton-card" style={style}>{children}</div>
}

// Faixa de 4 métricas — Visão Geral e Análise abrem com ela.
function MetricsRow({ count = 4 }) {
  return (
    <div className="metrics-grid">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <div className="skeleton-row">
            <Skeleton w={84} h={11} />
            <Skeleton w={34} h={34} radius={9} />
          </div>
          <Skeleton w="62%" h={26} style={{ marginTop: 14 }} />
          <Skeleton w="44%" h={11} style={{ marginTop: 12 }} />
        </Card>
      ))}
    </div>
  )
}

function ChartCard({ height = 150 }) {
  return (
    <Card>
      <Skeleton w={140} h={13} />
      <Skeleton w={92} h={11} style={{ marginTop: 7 }} />
      <Skeleton w="100%" h={height} radius={10} style={{ marginTop: 18 }} />
    </Card>
  )
}

function TableCard({ rows = 6 }) {
  return (
    <Card>
      <Skeleton w={150} h={13} />
      <div className="skeleton-table">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton-table-row">
            <Skeleton w={30} h={30} radius={9} />
            <span className="skeleton-table-cell">
              <Skeleton w="58%" h={12} />
              <Skeleton w="34%" h={10} style={{ marginTop: 6 }} />
            </span>
            <Skeleton w={74} h={13} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function CardGrid({ count = 4, height = 128 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} w="100%" h={height} radius={14} />
      ))}
    </div>
  )
}

// Cada tela tem um esqueleto com a própria silhueta. Um esqueleto genérico
// causaria justamente o salto de layout que ele deveria evitar.
const LAYOUTS = {
  overview: () => <><MetricsRow /><div className="charts-row"><ChartCard /><ChartCard /></div></>,
  analysis: () => <><MetricsRow /><div className="charts-row"><ChartCard /><ChartCard /></div><TableCard rows={5} /></>,
  transactions: () => <><MetricsRow count={3} /><TableCard rows={8} /></>,
  wallets: () => <><Skeleton w={220} h={34} /><CardGrid count={4} height={150} /></>,
  creditcards: () => <><CardGrid count={3} height={170} /><TableCard rows={4} /></>,
  budget: () => <><MetricsRow count={4} /><CardGrid count={4} height={110} /></>,
  goals: () => <CardGrid count={4} height={190} />,
  investments: () => <><MetricsRow /><div className="charts-row"><ChartCard /><ChartCard /></div><TableCard rows={5} /></>,
  calendar: () => <><MetricsRow count={4} /><Skeleton w="100%" h={380} radius={14} /></>,
  recurrences: () => <><Skeleton w="100%" h={86} radius={14} /><CardGrid count={4} height={86} /></>,
  alerts: () => <><Skeleton w="100%" h={84} radius={14} /><CardGrid count={2} height={230} /></>,
  profile: () => <CardGrid count={2} height={300} />,
  settings: () => <CardGrid count={4} height={200} />,
}

export default function ScreenSkeleton({ screen, label }) {
  const Layout = LAYOUTS[screen] || LAYOUTS.overview
  return (
    // role=status + aria-busy: o leitor de tela anuncia "carregando" uma vez,
    // em vez de tentar ler a moldura toda.
    <div className="screen skeleton-screen" role="status" aria-busy="true" aria-label={label}>
      <Layout />
    </div>
  )
}
