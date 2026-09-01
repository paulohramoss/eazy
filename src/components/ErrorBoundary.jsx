import { Component } from 'react'

// Sem isto qualquer erro de render numa tela (inclusive nas carregadas por
// lazy) desmontava a árvore inteira e deixava a página em branco, sem nenhuma
// pista para o usuário nem caminho de volta.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  // A tela é trocada pelo roteador sem remontar o boundary; sem este reset o
  // erro de uma tela deixaria todas as outras inacessíveis.
  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
        <i className="fi fi-rr-triangle-warning"
           style={{ fontSize: 44, color: 'var(--accent-red)', display: 'block', marginBottom: 16 }} />
        <h3 style={{ marginBottom: 8 }}>{this.props.t?.('error.screenTitle') ?? 'Algo deu errado nesta tela'}</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
          {this.props.t?.('error.screenBody') ?? 'Seus dados estão salvos. Tente abrir a tela de novo ou recarregar o app.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => this.setState({ error: null })}>
            {this.props.t?.('action.retry') ?? 'Tentar de novo'}
          </button>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            {this.props.t?.('action.reload') ?? 'Recarregar'}
          </button>
        </div>
        {import.meta.env.DEV && (
          <pre style={{
            marginTop: 24, textAlign: 'left', fontSize: 12, color: 'var(--text-muted)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{String(this.state.error?.stack || this.state.error)}</pre>
        )}
      </div>
    )
  }
}
