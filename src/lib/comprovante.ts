import { deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { abrirImagem } from './foto'

export const COMPROVANTE_MAX_CARACTERES = 280000
const LADO_MAX = 1200

/**
 * Reduz a imagem do comprovante (print do app do banco ou foto) para caber no banco: JPEG com até 1200 px no
 * maior lado, baixando a qualidade e o tamanho até passar do limite. Texto pequeno do comprovante continua legível.
 */
export async function reduzirComprovante(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Envie uma imagem (print ou foto do comprovante). PDF não é aceito.')
  const img = await abrirImagem(file)
  try {
    for (const lado of [LADO_MAX, 1000, 800, 640]) {
      const escala = Math.min(1, lado / Math.max(img.largura, img.altura))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.largura * escala))
      canvas.height = Math.max(1, Math.round(img.altura * escala))
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img.fonte, 0, 0, canvas.width, canvas.height)
      for (const q of [0.78, 0.65, 0.5]) {
        const url = canvas.toDataURL('image/jpeg', q)
        if (url.length <= COMPROVANTE_MAX_CARACTERES) return url
      }
    }
    throw new Error('Não consegui reduzir essa imagem o bastante. Tente um print em vez de uma foto.')
  } finally {
    img.fechar()
  }
}

/** ID da transação Pix (E2E): 32 letras e números, começando com E ou D. Vazio é aceito (o campo é opcional). */
export function idTransacaoValido(v: string) {
  return v === '' || /^[ED][A-Za-z0-9]{31}$/.test(v)
}

/** Tira espaços e quebras (colar do app do banco costuma trazer sobras). */
export function limparIdTransacao(v: string) {
  return v.replace(/\s+/g, '')
}

/** O jogador anexa (ou troca) o comprovante da própria cobrança pendente. A imagem e o aviso vão no mesmo lote. */
export async function enviarComprovante(paymentId: string, uid: string, imagem: string, idTransacao: string) {
  const lote = writeBatch(db)
  lote.set(doc(db, 'comprovantes', paymentId), { uid, imagem, criadoEm: serverTimestamp() })
  lote.update(doc(db, 'payments', paymentId), { comprovanteEm: serverTimestamp(), idTransacao })
  await lote.commit()
}

/** O jogador cancela a cobrança pendente; o comprovante (se houver) vai junto, no mesmo lote. */
export async function cancelarCobrancaComComprovante(paymentId: string, temComprovante: boolean) {
  if (!temComprovante) return deleteDoc(doc(db, 'payments', paymentId))
  const lote = writeBatch(db)
  lote.delete(doc(db, 'comprovantes', paymentId))
  lote.delete(doc(db, 'payments', paymentId))
  await lote.commit()
}
