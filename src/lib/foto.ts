export const LARGURA = 240
export const ALTURA = 320
export const FOTO_MAX_CARACTERES = 70000
export const ZOOM_MAX = 5

export interface ImagemCarregada {
  fonte: CanvasImageSource
  largura: number
  altura: number
  fechar: () => void
}

export interface Centro {
  x: number
  y: number
}

export async function abrirImagem(file: File): Promise<ImagemCarregada> {
  try {
    const bmp = await createImageBitmap(file)
    return { fonte: bmp, largura: bmp.width, altura: bmp.height, fechar: () => bmp.close() }
  } catch {
    // Alguns navegadores/celulares não decodificam certos formatos via createImageBitmap,
    // mas a tag <img> consegue (e já respeita a orientação da câmera).
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((ok, falha) => {
        const i = new Image()
        i.onload = () => ok(i)
        i.onerror = () => falha(new Error('Não consegui abrir essa imagem. Tente outra foto (JPG ou PNG).'))
        i.src = url
      })
      return { fonte: img, largura: img.naturalWidth, altura: img.naturalHeight, fechar: () => URL.revokeObjectURL(url) }
    } catch (e) {
      URL.revokeObjectURL(url)
      throw e
    }
  }
}

/** Tamanho (em pixels da imagem original) da janela 3x4 que está sendo recortada. */
function janela(img: ImagemCarregada, zoom: number) {
  const base = Math.max(LARGURA / img.largura, ALTURA / img.altura)
  const escala = base * zoom
  return { sw: LARGURA / escala, sh: ALTURA / escala }
}

/** Mantém a janela de recorte inteira dentro da imagem. */
export function limitarCentro(img: ImagemCarregada, c: Centro, zoom: number): Centro {
  const { sw, sh } = janela(img, zoom)
  return {
    x: Math.min(Math.max(c.x, sw / 2), img.largura - sw / 2),
    y: Math.min(Math.max(c.y, sh / 2), img.altura - sh / 2),
  }
}

/** Quantos pixels da imagem original equivalem a 1 pixel de tela, para o arrasto. */
export function pixelsPorToque(img: ImagemCarregada, zoom: number, larguraTela: number) {
  return janela(img, zoom).sw / larguraTela
}

/** Desenha o recorte no canvas (qualquer tamanho 3:4). */
export function desenharRecorte(canvas: HTMLCanvasElement, img: ImagemCarregada, centro: Centro, zoom: number) {
  const { sw, sh } = janela(img, zoom)
  const c = limitarCentro(img, centro, zoom)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img.fonte, c.x - sw / 2, c.y - sh / 2, sw, sh, 0, 0, canvas.width, canvas.height)
}

/** Gera o JPEG final (240x320, base64), baixando a qualidade até caber no limite. */
export function exportarFoto(img: ImagemCarregada, centro: Centro, zoom: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = LARGURA
  canvas.height = ALTURA
  desenharRecorte(canvas, img, centro, zoom)
  for (const qualidade of [0.8, 0.7, 0.6, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', qualidade)
    if (url.length <= FOTO_MAX_CARACTERES) return url
  }
  throw new Error('Não foi possível reduzir a foto o bastante. Tente outra imagem.')
}

const LOGO_MAX_LADO = 192
export const LOGO_MAX_CARACTERES = 60000

/** Reduz a logo do time (mantém proporção e transparência) para caber no banco. */
export async function reduzirLogo(file: File): Promise<string> {
  const img = await abrirImagem(file)
  try {
    for (const lado of [LOGO_MAX_LADO, 160, 128, 96]) {
      const escala = Math.min(1, lado / Math.max(img.largura, img.altura))
      const w = Math.max(1, Math.round(img.largura * escala))
      const h = Math.max(1, Math.round(img.altura * escala))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img.fonte, 0, 0, w, h)
      const png = canvas.toDataURL('image/png')
      if (png.length <= LOGO_MAX_CARACTERES) return png
      // logo "de foto" (muitos detalhes): JPEG sobre fundo branco costuma caber
      const fundo = document.createElement('canvas')
      fundo.width = w
      fundo.height = h
      const c2 = fundo.getContext('2d')!
      c2.fillStyle = '#ffffff'
      c2.fillRect(0, 0, w, h)
      c2.drawImage(canvas, 0, 0)
      const jpg = fundo.toDataURL('image/jpeg', 0.8)
      if (jpg.length <= LOGO_MAX_CARACTERES) return jpg
    }
    throw new Error('Não foi possível reduzir a logo o bastante. Tente uma imagem mais simples.')
  } finally {
    img.fechar()
  }
}
