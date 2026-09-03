import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import {
  ChartFrame, ChartTable, Tooltip, niceScale, shortNumber, useElementWidth,
} from './primitives'

/**
 * Linha com área — tendência ao longo dos meses.
 *
 * Problemas da versão anterior, todos corrigidos aqui:
 *   - preserveAspectRatio="none" esticava o desenho, então a espessura do traço
 *     mudava conforme a largura da tela;
 *   - os únicos valores legíveis vinham de <title> nativo, que é lento, sem
 *     estilo e inacessível por teclado;
 *   - não havia escala nenhuma: a curva subia e descia sem eixo para ler contra.
 *
 * Uma série só, então não leva legenda — o título já diz o que é.
 */

const H = 170
const PAD = { top: 10, right: 8, bottom: 24, left: 46 }

export default function TrendChart({ title, subtitle, data, color = 'var(--chart-1)', unit = 'currency' }) {
  const { formatCurrency: fmt, formatNumber, locale, t } = useApp()
  const wrapRef = useRef(null)
  const width = useElementWidth(wrapRef)
  const [hover, setHover] = useState(null)

  const plotW = Math.max(width - PAD.left - PAD.right, 40)
  const plotH = H - PAD.top - PAD.bottom

  const max = Math.max(...data.map(d => d.value), 0)
  const { top, values } = niceScale(max)

  const xOf = (i) => data.length === 1
    ? PAD.left + plotW / 2
    : PAD.left + (i / (data.length - 1)) * plotW
  const yOf = (v) => PAD.top + plotH - (v / top) * plotH

  const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.value), ...d }))

  // Curva suave por Bézier com pontos de controle no meio do intervalo: mantém
  // o traço passando exatamente por cada ponto, sem inventar picos entre eles.
  const curve = pts.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = pts[i - 1]
    const cx = (prev.x + p.x) / 2
    return `C ${cx} ${prev.y} ${cx} ${p.y} ${p.x} ${p.y}`
  }).join(' ')

  const area = pts.length
    ? `${curve} L ${pts[pts.length - 1].x} ${PAD.top + plotH} L ${pts[0].x} ${PAD.top + plotH} Z`
    : ''

  const gradId = `trend-grad-${title.replace(/\W/g, '')}`
  const show = (v) => (unit === 'percent' ? `${formatNumber(v)}%` : fmt(v))

  const table = (
    <ChartTable
      columns={[t('chart.month'), t('chart.value')]}
      rows={data.map(d => ({ key: d.key ?? d.label, cells: [d.label, show(d.value)] }))}
    />
  )

  return (
    <ChartFrame title={title} subtitle={subtitle} table={table}>
      <div className="chart-plot" ref={wrapRef} style={{ height: H }}>
        <svg width={width} height={H} role="img" aria-label={`${title}. ${t('chart.useTable')}`}
             onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {values.map(v => (
            <line key={v} x1={PAD.left} x2={width - PAD.right} y1={yOf(v)} y2={yOf(v)}
                  stroke="var(--chart-grid)" strokeWidth="1" shapeRendering="crispEdges" />
          ))}
          {values.map(v => (
            <text key={v} className="chart-axis-label" x={PAD.left - 8} y={yOf(v)}
                  textAnchor="end" dominantBaseline="middle">
              {unit === 'percent' ? `${v}%` : shortNumber(v, locale)}
            </text>
          ))}

          <path d={area} fill={`url(#${gradId})`} />
          <path d={curve} stroke={color} fill="none" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />

          {/* Crosshair: a linha vertical ancora a leitura no mês certo, coisa
              que um tooltip solto não faz. */}
          {hover !== null && (
            <line x1={pts[hover].x} x2={pts[hover].x} y1={PAD.top} y2={PAD.top + plotH}
                  stroke="var(--chart-axis)" strokeWidth="1" shapeRendering="crispEdges" />
          )}

          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 5.5 : 4}
                    fill={color} stroke="var(--chart-surface)" strokeWidth="2" />
          ))}

          {/* Faixas invisíveis de captura: uma por ponto, cobrindo a altura
              inteira, para o alvo nunca ser o diâmetro do marcador. */}
          {pts.map((p, i) => (
            <rect key={`hit-${i}`} className="chart-hit"
                  x={xOf(i) - plotW / Math.max(data.length - 1, 1) / 2}
                  y={0}
                  width={plotW / Math.max(data.length - 1, 1)}
                  height={H}
                  onMouseEnter={() => setHover(i)} />
          ))}

          {data.map((d, i) => (
            <text key={d.key ?? d.label} className="chart-axis-label" x={xOf(i)} y={H - 7}
                  textAnchor="middle" style={{ textTransform: 'capitalize' }}
                  fill={hover === i ? 'var(--text-primary)' : undefined}>
              {d.label}
            </text>
          ))}
        </svg>

        {hover !== null && width > 0 && (
          <Tooltip
            x={(pts[hover].x / width) * 100}
            y={Math.max((pts[hover].y / H) * 100 - 6, 4)}
            title={data[hover].label}
            rows={[{ label: title, value: show(data[hover].value), color }]}
          />
        )}
      </div>
    </ChartFrame>
  )
}
