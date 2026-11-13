// Prepara uma foto (cupom, comprovante, print) para mandar à IA.
//
// Foto de celular sai com 3-8 MB; o corpo da função na Vercel aceita 4,5 MB e
// o modelo não lê melhor acima de ~1600 px. Redimensionar aqui deixa o envio
// em ~200-400 KB, rápido até no 4G do interior.

export const MAX_SIDE = 1600

export async function compressImage(file, { maxSide = MAX_SIDE, quality = 0.82 } = {}) {
  if (!file?.type?.startsWith('image/')) throw new Error('not-an-image')

  // createImageBitmap respeita a orientação EXIF com esta opção — sem ela a
  // foto de pé do iPhone chegava deitada.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    // Fundo branco: PNG com transparência viraria preto no JPEG.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)

    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    return { mediaType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) }
  } finally {
    bitmap.close?.()
  }
}
