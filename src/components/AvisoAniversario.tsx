import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import {
  BONUS_ANIVERSARIO,
  ehAniversarioHoje,
  hojeEmBrasilia,
  mensagemDeAniversario,
  primeiroNome,
  receberBonusAniversario,
} from '../lib/aniversario'

/**
 * Aniversário do associado: hoje (em Brasília) é o dia? `recebido` diz se ele já tocou em "Lido" e levou os créditos
 * (null enquanto não se sabe). Confere de minuto em minuto, para o aviso aparecer e sumir na virada do dia.
 */
function useAniversario() {
  const { currentUser, player, cadastroExcluido } = useAuth()
  const [agora, setAgora] = useState(() => Date.now())
  const [recebido, setRecebido] = useState<boolean | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const uid = currentUser?.uid
  const ano = hojeEmBrasilia(agora).ano
  const hoje = !!uid && !!player && !cadastroExcluido && ehAniversarioHoje(player.dataNascimento, agora)

  useEffect(() => {
    setRecebido(null)
    if (!hoje || !uid) return
    return onSnapshot(
      doc(db, 'aniversarios', `${uid}_${ano}`),
      (snap) => setRecebido(snap.exists()),
      () => setRecebido(null),
    )
  }, [hoje, uid, ano])

  const mensagem = useMemo(() => (player && uid ? mensagemDeAniversario(player.nomeCompleto, uid, ano) : ''), [player, uid, ano])
  return { hoje, recebido, mensagem, player }
}

/**
 * Logo abaixo do menu, em qualquer tela, no dia do aniversário: a mensagem de parabéns e o botão "Lido". Só ao tocar em
 * "Lido" os créditos de presente entram na carteira. Depois disso o aviso some (o destaque fica na carteirinha, até a virada do dia).
 */
export function AvisoAniversario() {
  const { hoje, recebido, mensagem, player } = useAniversario()
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!hoje || recebido !== false || !player) return null

  async function ler() {
    if (!player) return
    setOcupado(true)
    setErro(null)
    try {
      await receberBonusAniversario(player)
    } catch {
      setErro('Não foi possível creditar agora. Confira a internet e toque em "Lido" de novo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="no-print border-b border-gold/60 bg-gold/15">
      <div className="mx-auto max-w-5xl px-4 py-3">
        <article className="rounded-sm border-2 border-gold bg-surface px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-gold">
                <span aria-hidden="true">🎉🎂 </span>
                Feliz aniversário, {primeiroNome(player.nomeCompleto)}!
              </p>
              <p className="mt-1 text-sm text-ink">{mensagem}</p>
              <p className="mt-2 text-xs font-semibold text-gold">
                🎁 Toque em "Lido" e ganhe {BONUS_ANIVERSARIO} créditos de presente da AACN.
              </p>
              {erro && <p className="mt-1 text-xs text-danger">{erro}</p>}
            </div>
            <button
              onClick={ler}
              disabled={ocupado}
              className="shrink-0 rounded-sm bg-gold px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-bg hover:opacity-90 disabled:opacity-60"
            >
              Lido
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}

/** Na carteirinha (perfil): o destaque do dia, depois que o jogador já tocou em "Lido" e recebeu os créditos. */
export function DestaqueAniversario() {
  const { hoje, recebido, mensagem, player } = useAniversario()
  if (!hoje || recebido !== true || !player) return null

  return (
    <section className="no-print mb-6 rounded-sm border-2 border-gold bg-gold/10 px-4 py-4 text-center">
      <p className="text-2xl" aria-hidden="true">
        🎈🎂🎉
      </p>
      <h2 className="mt-1 text-lg font-bold text-gold">Feliz aniversário, {primeiroNome(player.nomeCompleto)}!</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-ink">{mensagem}</p>
      <p className="mt-2 text-xs font-semibold text-ok">✅ {BONUS_ANIVERSARIO} créditos de presente já estão na sua carteira.</p>
    </section>
  )
}
