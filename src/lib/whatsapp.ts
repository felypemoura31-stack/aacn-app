import { soDigitos } from './cadastro'

/** Link do WhatsApp (wa.me) para um celular brasileiro, com mensagem pronta. */
export function linkWhatsapp(celular: string, mensagem: string): string | null {
  const d = soDigitos(celular)
  if (d.length < 10 || d.length > 13) return null
  const numero = d.length <= 11 ? `55${d}` : d
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}

/** Se o link do WhatsApp do time for um wa.me, acrescenta a mensagem pronta; grupo/convite abre como está. */
export function comMensagem(link: string, mensagem: string): string {
  try {
    const u = new URL(link)
    if (u.hostname === 'wa.me') {
      u.searchParams.set('text', mensagem)
      return u.toString()
    }
  } catch {
    // mantém o link original
  }
  return link
}
