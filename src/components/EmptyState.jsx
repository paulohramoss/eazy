/**
 * Estado vazio padronizado.
 *
 * O app tinha nove versões diferentes disso — algumas só com um `<p>` solto,
 * outras com ícone e botão, cada uma com espaçamento próprio. Pior: várias
 * diziam apenas o que NÃO existe ("Nenhum objetivo definido") sem dizer o que
 * fazer a respeito, que é a única coisa útil numa tela vazia.
 *
 * Três variantes:
 *   'screen' — a tela inteira está vazia; cabe explicação e ação
 *   'card'   — um cartão dentro de uma tela com conteúdo; compacto
 *   'filter' — há dados, mas o filtro atual não achou nada; oferece limpar
 */
export default function EmptyState({
  icon = 'fi-rr-inbox',
  title,
  description,
  action,          // { label, onClick, icon }
  secondary,       // { label, onClick }
  variant = 'card',
}) {
  return (
    <div className={`empty-state-box empty-state-box--${variant}`}>
      <div className="empty-state-icon">
        <i className={`fi ${icon}`} aria-hidden="true" />
      </div>

      {title && <h3 className="empty-state-title">{title}</h3>}
      {description && <p className="empty-state-desc">{description}</p>}

      {(action || secondary) && (
        <div className="empty-state-actions">
          {action && (
            <button className="btn btn-primary" onClick={action.onClick}>
              {action.icon && <i className={`fi ${action.icon}`} aria-hidden="true" />}
              {action.label}
            </button>
          )}
          {secondary && (
            <button className="btn btn-secondary" onClick={secondary.onClick}>
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
