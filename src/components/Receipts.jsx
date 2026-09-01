import { useEffect, useRef, useState } from 'react'
import {
  deleteObject, getDownloadURL, listAll, ref, uploadBytes,
} from 'firebase/storage'
import { storage } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useToast } from './Toast'
import { useApp } from '../context/AppContext'

// Comprovantes de uma transação.
//
// Antes só existia upload de avatar; não havia como guardar a nota fiscal ou o
// print do PIX junto do lançamento — que é justamente o que se procura meses
// depois, na hora de conferir uma cobrança.

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = 'image/*,application/pdf'

const prettySize = (bytes) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`

export default function Receipts({ transactionId }) {
  const { user } = useAuth()
  const toast = useToast()
  const { t } = useApp()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  const folder = transactionId ? `receipts/${user.uid}/${transactionId}` : null

  useEffect(() => {
    if (!folder) { setLoading(false); return }
    let cancelled = false

    listAll(ref(storage, folder))
      .then(async (res) => {
        const items = await Promise.all(res.items.map(async item => ({
          name: item.name,
          fullPath: item.fullPath,
          url: await getDownloadURL(item),
        })))
        if (!cancelled) setFiles(items)
      })
      .catch(err => {
        // Pasta inexistente não é erro: é uma transação ainda sem comprovante.
        if (err?.code !== 'storage/object-not-found') console.error('[receipts]', err)
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [folder])

  const handleUpload = async (e) => {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    if (!picked.length || !folder) return

    const tooBig = picked.filter(f => f.size > MAX_BYTES)
    if (tooBig.length) {
      toast.error(t('receipt.tooBig', { names: tooBig.map(f => f.name).join(', ') }))
      return
    }

    setUploading(true)
    try {
      const uploaded = []
      for (const file of picked) {
        // Prefixo de tempo evita que dois arquivos de mesmo nome se
        // sobrescrevam silenciosamente.
        const safeName = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
        const fileRef = ref(storage, `${folder}/${safeName}`)
        await uploadBytes(fileRef, file, { contentType: file.type })
        uploaded.push({
          name: safeName,
          fullPath: fileRef.fullPath,
          url: await getDownloadURL(fileRef),
        })
      }
      setFiles(prev => [...prev, ...uploaded])
      toast.success(uploaded.length > 1
        ? t('receipt.attachedMany', { count: uploaded.length })
        : t('receipt.attachedOne'))
    } catch (err) {
      console.error('[receipts:upload]', err)
      toast.error(t('receipt.attachFailed'))
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (file) => {
    try {
      await deleteObject(ref(storage, file.fullPath))
      setFiles(prev => prev.filter(f => f.fullPath !== file.fullPath))
      toast.success(t('receipt.removed'))
    } catch (err) {
      console.error('[receipts:delete]', err)
      toast.error(t('receipt.removeFailed'))
    }
  }

  if (!transactionId) {
    return (
      <div className="form-hint">
        {t('receipt.needsSave')}
      </div>
    )
  }

  return (
    <div className="receipts">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: 'none' }}
        onChange={handleUpload}
      />

      {loading ? (
        <div className="form-hint">{t('receipt.loading')}</div>
      ) : (
        <>
          {files.length > 0 && (
            <ul className="receipt-list">
              {files.map(file => {
                const isPdf = file.name.toLowerCase().endsWith('.pdf')
                return (
                  <li key={file.fullPath} className="receipt-item">
                    <a
                      className="receipt-link"
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {isPdf
                        ? <span className="receipt-thumb receipt-thumb--pdf"><i className="fi fi-rr-document" /></span>
                        : <img className="receipt-thumb" src={file.url} alt="" loading="lazy" />}
                      <span className="receipt-name">{file.name.replace(/^\d+-/, '')}</span>
                    </a>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => handleDelete(file)}
                      aria-label={`${t('action.delete')} ${file.name}`}
                    >
                      <i className="fi fi-rr-trash" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%' }}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <i className="fi fi-rr-clip" />
            {t(uploading ? 'receipt.uploading' : 'receipt.attach')}
          </button>
          <div className="form-hint">
            {t('receipt.hint', { size: prettySize(MAX_BYTES) })}
          </div>
        </>
      )}
    </div>
  )
}
