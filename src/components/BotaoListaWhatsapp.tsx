import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { carregarTimes } from '../lib/listaInscritos'
import { linkEnviarWhatsapp, montarListaWhatsapp } from '../lib/listaPresenca'
import type { Game, Participation } from '../types'

/**
 * "Enviar a lista no WhatsApp" para quem já está inscrito: abre o WhatsApp com a lista de operadores do jogo (nome e time,
 * na ordem de inscrição) e o link para se inscrever; a pessoa escolhe o grupo. A lista fica pronta antes do toque (o link é
 * montado com os inscritos de agora), para o navegador não bloquear a abertura. A lista de espera não entra.
 * `destaque` é o botão grande que aparece logo depois de a pessoa se inscrever.
 */
export function BotaoListaWhatsapp({ jogo, destaque = false }: { jogo: Game; destaque?: boolean }) {
  const [lista, setLista] = useState<Participation[] | null>(null)
  const [times, setTimes] = useState<Record<string, string | null>>({})

  useEffect(() => {
    const q = query(collection(db, 'participations'), where('gameId', '==', jogo.id), where('status', 'in', ['ativa', 'presente']))
    return onSnapshot(q, (snap) => setLista(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participation)))
  }, [jogo.id])

  useEffect(() => {
    void carregarTimes().then(setTimes)
  }, [])

  const href = lista ? linkEnviarWhatsapp(montarListaWhatsapp(jogo, lista, new Map(Object.entries(times)))) : undefined

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={!href}
      className={destaque ? 'btn-primary inline-block text-center' : 'mt-2 inline-block text-[11px] font-semibold text-accent-hi underline'}
    >
      {href ? 'Enviar a lista no WhatsApp' : 'Preparando a lista...'}
    </a>
  )
}
