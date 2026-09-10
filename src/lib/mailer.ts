import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Grava um documento na coleção `mail`, consumido pela extensão oficial do
 * Firebase "Trigger Email" (firestore-send-email). Ver README para configurar.
 */
export async function enviarEmail(params: {
  to: string
  subject: string
  html: string
}) {
  await addDoc(collection(db, 'mail'), {
    to: [params.to],
    message: {
      subject: params.subject,
      html: params.html,
    },
    criadoEm: serverTimestamp(),
  })
}
