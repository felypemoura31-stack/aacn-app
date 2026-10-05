const LARGURA = 240
const ALTURA = 320
export const FOTO_MAX_CARACTERES = 70000

/** Recorta no formato 3x4 (centralizado, puxando para o rosto) e reduz para JPEG pequeno, em base64. */
export async function reduzirFoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const escala = Math.max(LARGURA / bmp.width, ALTURA / bmp.height)
  const sw = LARGURA / escala
  const sh = ALTURA / escala
  const sx = (bmp.width - sw) / 2
  const sy = (bmp.height - sh) * 0.3

  const canvas = document.createElement('canvas')
  canvas.width = LARGURA
  canvas.height = ALTURA
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, LARGURA, ALTURA)
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, LARGURA, ALTURA)
  bmp.close()

  for (const qualidade of [0.8, 0.7, 0.6, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', qualidade)
    if (url.length <= FOTO_MAX_CARACTERES) return url
  }
  throw new Error('Não foi possível reduzir a foto o bastante. Tente outra imagem.')
}
