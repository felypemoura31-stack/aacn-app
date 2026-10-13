import { useEffect, useState } from 'react'

/**
 * Tela cheia para mostrar a carteirinha ao parceiro: pede ao navegador a tela cheia e a rotação para paisagem, e
 * mantém a tela ligada. Importante: um site NÃO consegue mudar o brilho do aparelho (nenhum navegador permite), então
 * o brilho só pode ser lembrado ao usuário; o que o app faz para ajudar o leitor é fundo branco e o QR bem grande.
 *
 * - Android/Chrome: tela cheia + trava em paisagem (a trava só vale em tela cheia).
 * - iPhone/Safari: o navegador não oferece tela cheia para páginas; fica a tela do app cobrindo tudo, girada por CSS.
 *
 * Chame dentro do toque do usuário (o navegador exige). Devolve a função que desfaz tudo.
 */
export function iniciarTelaCheia(aoSairPeloSistema: () => void): () => void {
  let ativo = true
  let emTelaCheia = false
  let luz: { release: () => Promise<void> } | null = null

  const raiz = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
  const pedir = raiz.requestFullscreen
    ? () => raiz.requestFullscreen({ navigationUI: 'hide' })
    : raiz.webkitRequestFullscreen
      ? () => raiz.webkitRequestFullscreen!()
      : null
  if (pedir) {
    Promise.resolve(pedir())
      .then(() => {
        emTelaCheia = true
        const o = screen.orientation as unknown as { lock?: (t: string) => Promise<void> } | undefined
        return o?.lock?.('landscape')
      })
      .catch(() => {
        /* sem tela cheia ou sem trava de rotação: o app gira a carteirinha sozinho */
      })
  }

  const pedirLuz = async () => {
    try {
      luz = (await navigator.wakeLock?.request('screen')) ?? null
    } catch {
      /* sem suporte: a tela pode apagar pelo tempo normal do aparelho */
    }
  }
  void pedirLuz()
  const aoVoltar = () => {
    if (ativo && document.visibilityState === 'visible') void pedirLuz()
  }
  // o gesto "voltar" e a tecla Esc tiram a tela cheia: o app acompanha
  const aoMudarTelaCheia = () => {
    if (ativo && emTelaCheia && !document.fullscreenElement) aoSairPeloSistema()
  }
  document.addEventListener('visibilitychange', aoVoltar)
  document.addEventListener('fullscreenchange', aoMudarTelaCheia)

  return () => {
    ativo = false
    document.removeEventListener('visibilitychange', aoVoltar)
    document.removeEventListener('fullscreenchange', aoMudarTelaCheia)
    void luz?.release().catch(() => {})
    try {
      ;(screen.orientation as unknown as { unlock?: () => void } | undefined)?.unlock?.()
    } catch {
      /* nada a destravar */
    }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }
}

/** Celular em pé (tela estreita) ou deitado (tela baixa). No computador, o clique na carteirinha não faz nada. */
const CONSULTA_CELULAR = '(max-width: 767px), (max-height: 500px)'

export function useEhCelular() {
  const [celular, setCelular] = useState(() => window.matchMedia(CONSULTA_CELULAR).matches)
  useEffect(() => {
    const m = window.matchMedia(CONSULTA_CELULAR)
    const f = () => setCelular(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return celular
}
