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

/** Logos de time e fotos de lojas: recorte quadrado, até este lado (em pixels) e este tamanho (em caracteres do base64). */
export const LOGO_LADO = 192
export const LOGO_MAX_CARACTERES = 60000

/** Lado (em pixels da imagem original) da janela quadrada recortada. Com zoom 1 cabe a imagem inteira. */
function ladoDaJanela(img: ImagemCarregada, zoom: number) {
  return Math.max(img.largura, img.altura) / zoom
}

/** Mantém a janela quadrada dentro da imagem; num eixo em que a imagem é menor que a janela, fica centralizada. */
export function limitarCentroQuadrado(img: ImagemCarregada, c: Centro, zoom: number): Centro {
  const lado = ladoDaJanela(img, zoom)
  const limitar = (v: number, dim: number) => (lado >= dim ? dim / 2 : Math.min(Math.max(v, lado / 2), dim - lado / 2))
  return { x: limitar(c.x, img.largura), y: limitar(c.y, img.altura) }
}

/** Quantos pixels da imagem original equivalem a 1 pixel de tela, para o arrasto. */
export function pixelsPorToqueQuadrado(img: ImagemCarregada, zoom: number, ladoTela: number) {
  return ladoDaJanela(img, zoom) / ladoTela
}

/** Desenha o recorte quadrado (as sobras ficam transparentes, ou com o `fundo` dado). */
export function desenharRecorteQuadrado(canvas: HTMLCanvasElement, img: ImagemCarregada, centro: Centro, zoom: number, fundo: string | null) {
  const lado = ladoDaJanela(img, zoom)
  const c = limitarCentroQuadrado(img, centro, zoom)
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (fundo) {
    ctx.fillStyle = fundo
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  const x0 = c.x - lado / 2
  const y0 = c.y - lado / 2
  // só a parte da janela que tem imagem
  const sx = Math.max(0, x0)
  const sy = Math.max(0, y0)
  const ex = Math.min(img.largura, x0 + lado)
  const ey = Math.min(img.altura, y0 + lado)
  const esc = canvas.width / lado
  ctx.drawImage(img.fonte, sx, sy, ex - sx, ey - sy, (sx - x0) * esc, (sy - y0) * esc, (ex - sx) * esc, (ey - sy) * esc)
}

/**
 * Gera a imagem final do recorte: PNG (mantém a transparência) e, se não couber no limite do banco, vai diminuindo o
 * lado e tenta JPEG sobre fundo branco.
 */
export function exportarLogo(img: ImagemCarregada, centro: Centro, zoom: number): string {
  for (const lado of [LOGO_LADO, 160, 128, 96]) {
    const canvas = document.createElement('canvas')
    canvas.width = lado
    canvas.height = lado
    desenharRecorteQuadrado(canvas, img, centro, zoom, null)
    const png = canvas.toDataURL('image/png')
    if (png.length <= LOGO_MAX_CARACTERES) return png
    const branco = document.createElement('canvas')
    branco.width = lado
    branco.height = lado
    desenharRecorteQuadrado(branco, img, centro, zoom, '#ffffff')
    const jpg = branco.toDataURL('image/jpeg', 0.8)
    if (jpg.length <= LOGO_MAX_CARACTERES) return jpg
  }
  throw new Error('Não foi possível reduzir a imagem o bastante. Tente uma imagem mais simples.')
}
