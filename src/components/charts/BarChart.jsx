import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import {
  ChartFrame, ChartTable, Tooltip, niceScale, shortNumber, useElementWidth,
} from './primitives'

/**
 * Barras agrupadas — receita × despesa por mês.
 *
 * A versão anterior tinha só as barras, sem escala nenhuma: duas barras de
 * alturas parecidas não diziam se a diferença era de cem reais ou de cem mil,
 * porque não havia eixo para ler contra. Agora há grade com ticks redondos,
 * tooltip por mês e a tabela equivalente.
 *
 * Verde e vermelho ficam a ΔE 9,2 sob deuteranopia — acima do alvo — mas o par
 * ainda é o mais delicado do app, então a legenda é fixa e cada par tem folga
 * de superfície entre as barras, para a identidade não depender só da cor.
 */

const H = 180
const PAD = { top: 8, right: 6, bottom: 24, left: 46 }

export default function BarChart({ title, subtitle, data }) {
  const { formatCurrency: fmt, locale, t } = useApp()
  const wrapRef = useRef(null)
  const width = useElementWidth(wrapRef)
  const [hover, setHover] = useState(null)

  const plotW = Math.max(width - PAD.left - PAD.right, 40)
  const plotH = H - PAD.top - PAD.bottom

  const max = Math.max(...data.flatMap(d => [d.income, d.expenses]), 0)
  const { top, values } = niceScale(max)

  const slot = plotW / Math.max(data.length, 1)
  const GAP = 2                                   // folga de superfície do par
  const barW = Math.max(Math.min((slot - GAP) / 2 - 6, 18), 4)

  const yOf = (v) => PAD.top + plotH - (v / top) * plotH
  const cxOf = (i) => PAD.left + slot * (i + 0.5)

  const series = [
    { name: t('overview.income'), color: 'var(--chart-income)' },
    { name: t('overview.expenses'), color: 'var(--chart-expense)' },
  ]

  const table = (
    <ChartTable
      columns={[t('chart.month'), t('overview.income'), t('overview.expenses'), t('chart.balance')]}
      rows={data.map(d => ({
        key: d.key,
        cells: [d.label, fmt(d.income), fmt(d.expenses), fmt(d.income - d.expenses)],
      }))}
    />
  )

  return (
    <ChartFrame title={title} subtitle={subtitle} legend={series} table={table}>
      <div className="chart-plot" ref={wrapRef} style={{ height: H }}>
        <svg width={width} height={H} role="img" aria-label={`${title}. ${t('chart.useTable')}`}>
          {/* Grade sólida e recessiva. Tracejado leria como meta ou projeção. */}
          {values.map(v => (
            <line key={v} x1={PAD.left} x2={width - PAD.right} y1={yOf(v)} y2={yOf(v)}
                  stroke="var(--chart-grid)" strokeWidth="1" shapeRendering="crispEdges" />
          ))}

          {values.map(v => (
            <text key={v} className="chart-axis-label" x={PAD.left - 8} y={yOf(v)}
                  textAnchor="end" dominantBaseline="middle">
              {shortNumber(v, locale)}
            </text>
          ))}

          {data.map((d, i) => {
            const cx = cxOf(i)
            const dim = hover !== null && hover !== i
            return (
              <g key={d.key}>
                {/* O alvo de mouse é o slot inteiro: mirar numa barra de 12px
                    seria um alvo puntiforme. */}
                <rect className="chart-hit"
                      x={PAD.left + slot * i} y={0} width={slot} height={H}
                      onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                <rect x={cx - barW - GAP / 2} y={yOf(d.income)}
                      width={barW} height={Math.max(plotH + PAD.top - yOf(d.income), 0)}
                      rx="4" fill="var(--chart-income)" opacity={dim ? 0.4 : 1} />
                <rect x={cx + GAP / 2} y={yOf(d.expenses)}
                      width={barW} height={Math.max(plotH + PAD.top - yOf(d.expenses), 0)}
                      rx="4" fill="var(--chart-expense)" opacity={dim ? 0.4 : 1} />
              </g>
            )
          })}

          {/* Linha de base sólida, um tom acima da grade. */}
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH}
                stroke="var(--chart-axis)" strokeWidth="1" shapeRendering="crispEdges" />

          {data.map((d, i) => (
            <text key={d.key} className="chart-axis-label" x={cxOf(i)} y={H - 7}
                  textAnchor="middle" style={{ textTransform: 'capitalize' }}
                  fill={hover === i ? 'var(--text-primary)' : undefined}>
              {d.label}
            </text>
          ))}
        </svg>

        {hover !== null && width > 0 && (
          <Tooltip
            x={(cxOf(hover) / width) * 100}
            y={0}
            title={data[hover].label}
            rows={[
              { label: t('overview.income'), value: fmt(data[hover].income), color: 'var(--chart-income)' },
              { label: t('overview.expenses'), value: fmt(data[hover].expenses), color: 'var(--chart-expense)' },
              { label: t('chart.balance'), value: fmt(data[hover].income - data[hover].expenses) },
            ]}
          />
        )}
      </div>
    </ChartFrame>
  )
}
