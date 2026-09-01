import { useState } from 'react'
import Modal from './Modal'
import { useApp } from '../context/AppContext'

// Escolha do destino das transações ao excluir uma carteira ou cartão.
//
// Antes a exclusão apenas apagava o registro e deixava as transações apontando
// para um id inexistente: elas continuavam somando no total do mês e nas
// categorias, mas desapareciam do saldo por carteira — e os números pararam de
// bater sem nenhum aviso.
export default function DeleteWithTransactionsModal({
  title,
  entityLabel,       // 'carteira' | 'cartão'
  names,             // nomes do que será excluído
  affectedCount,     // transações vinculadas
  targets,           // [{ id, name }] destinos possíveis para 'move'
  onConfirm,         // (mode, targetId) => void
  onClose,
}) {
  const { t } = useApp()
  const [mode, setMode] = useState(affectedCount > 0 && targets.length ? 'move' : 'orphan')
  const [targetId, setTargetId] = useState(targets[0]?.id || '')

  const plural = names.length > 1

  const options = [
    targets.length > 0 && {
      value: 'move',
      icon: 'fi-rr-exchange',
      label: t('del.move', { suffix: entityLabel }),
      desc: t('del.moveDesc'),
    },
    {
      value: 'delete',
      icon: 'fi-rr-trash',
      label: t('del.deleteToo', { count: affectedCount }),
      desc: t('del.deleteTooDesc'),
    },
    {
      value: 'orphan',
      icon: 'fi-rr-unlink',
      label: t('del.orphan'),
      desc: t('del.orphanDesc', { entity: entityLabel }),
    },
  ].filter(Boolean)

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('action.cancel')}</button>
          <button
            className="btn btn-danger"
            disabled={mode === 'move' && !targetId}
            onClick={() => { onConfirm(mode, targetId); onClose() }}
          >
            {t('action.delete')}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.55 }}>
        {plural
          ? t('del.confirmMany', { count: names.length, entity: entityLabel })
          : t('del.confirmOne', { name: names[0] })}
      </p>

      {affectedCount > 0 ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '16px 0 10px', lineHeight: 1.5 }}>
            {t('del.linkedCount', { count: affectedCount })}
          </p>

          <div className="delete-choice-list">
            {options.map(opt => (
              <label key={opt.value} className={`delete-choice${mode === opt.value ? ' is-active' : ''}`}>
                <input
                  type="radio"
                  name="delete-mode"
                  value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => setMode(opt.value)}
                />
                <i className={`fi ${opt.icon}`} />
                <span className="delete-choice-body">
                  <span className="delete-choice-label">{opt.label}</span>
                  <span className="delete-choice-desc">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>

          {mode === 'move' && (
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label" htmlFor="delete-target">{t('del.target')}</label>
              <select
                id="delete-target"
                className="form-select"
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
              >
                {targets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}
              </select>
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
          {t('del.noneLinked')}
        </p>
      )}
    </Modal>
  )
}
