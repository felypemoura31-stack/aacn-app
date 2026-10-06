import type { RedeSocial } from '../types'

export interface RedeInfo {
  id: RedeSocial
  label: string
  placeholder: string
}

export const REDES: RedeInfo[] = [
  { id: 'instagram', label: 'Instagram', placeholder: '@usuario ou link do perfil' },
  { id: 'facebook', label: 'Facebook', placeholder: 'nome da página ou link' },
  { id: 'youtube', label: 'YouTube', placeholder: '@canal ou link do canal' },
  { id: 'tiktok', label: 'TikTok', placeholder: '@usuario ou link' },
  { id: 'whatsapp', label: 'WhatsApp', placeholder: 'número com DDD ou link do grupo' },
  { id: 'x', label: 'X (Twitter)', placeholder: '@usuario ou link' },
  { id: 'discord', label: 'Discord', placeholder: 'link do convite' },
  { id: 'site', label: 'Site', placeholder: 'endereço do site' },
]

const HANDLE = /^[A-Za-z0-9._-]{1,60}$/

function comoUrl(valor: string): string | null {
  const v = valor.trim()
  const comEsquema = /^https?:\/\//i.test(v) ? v : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v) ? `https://${v}` : null
  if (!comEsquema) return null
  try {
    const u = new URL(comEsquema)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/**
 * Monta o link de uma rede a partir do que o usuário digitou (@usuario, número ou URL).
 * Só devolve http/https (nunca javascript:) ou null quando o valor é inválido.
 */
export function linkDaRede(rede: RedeSocial, valor: string): string | null {
  const v = valor.trim()
  if (!v) return null
  const url = comoUrl(v)
  if (url) return url
  const handle = v.replace(/^@/, '')

  switch (rede) {
    case 'instagram':
      return HANDLE.test(handle) ? `https://instagram.com/${handle}` : null
    case 'facebook':
      return HANDLE.test(handle) ? `https://facebook.com/${handle}` : null
    case 'youtube':
      return HANDLE.test(handle) ? `https://youtube.com/@${handle}` : null
    case 'tiktok':
      return HANDLE.test(handle) ? `https://tiktok.com/@${handle}` : null
    case 'x':
      return HANDLE.test(handle) ? `https://x.com/${handle}` : null
    case 'whatsapp': {
      const d = v.replace(/\D/g, '')
      if (d.length < 10 || d.length > 13) return null
      return `https://wa.me/${d.length <= 11 ? '55' + d : d}`
    }
    default:
      return null
  }
}

export function rotuloDaRede(id: RedeSocial) {
  return REDES.find((r) => r.id === id)?.label ?? id
}
