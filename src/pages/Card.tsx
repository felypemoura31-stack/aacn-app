import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { CarteirinhaImpressao } from '../components/CarteirinhaImpressao'
import { ResumoConta } from '../components/ResumoConta'
import { SelosConquistas } from '../components/SelosConquistas'
import { AvisosPanel } from '../components/AvisosPanel'
import { AvisoMensalidade } from '../components/AvisoMensalidade'
import { salvarDestaques } from '../lib/publicCard'
import { useTeam } from '../lib/useTeam'

/**
 * Tela inicial: a carteirinha de um lado e, ao lado dela (no computador), um resumo da conta, as
 * conquistas e os avisos. No celular tudo fica numa coluna só, com a carteirinha primeiro.
 */
export function Card() {
  const { currentUser, player } = useAuth()
  const time = useTeam(player?.timeAprovado ? player.timeId : null)

  if (!currentUser || !player) return null

  const verifyUrl = `${window.location.origin}/verificar/${player.uid}`

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <AvisoMensalidade player={player} />

      <div className="grid items-start gap-6 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <div className="min-w-0">
          <CarteirinhaImpressao
            player={player}
            verifyUrl={verifyUrl}
            timeNome={time?.nome ?? player.timeNome}
            timeLogoUrl={time?.logoUrl ?? null}
            destaques={player.destaques}
          />

          <div className="no-print mt-4 flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => window.print()} className="btn-primary">
              Imprimir carteirinha
            </button>
            <Link to="/validar" className="btn-ghost">
              Validador de parceiros
            </Link>
          </div>
          <p className="no-print mt-2 text-center text-[11px] text-mute/70">Quem lê o QR vê a situação atual da mensalidade.</p>
        </div>

        <div className="no-print min-w-0 space-y-4">
          <ResumoConta player={player} />
          <SelosConquistas
            uid={player.uid}
            className=""
            escolhidas={player.destaques ?? []}
            onAlternar={(id) => {
              const atuais = player.destaques ?? []
              return salvarDestaques(player.uid, atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id])
            }}
          />
          <AvisosPanel />
        </div>
      </div>
    </div>
  )
}
