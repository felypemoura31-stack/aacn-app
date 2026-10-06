import QRCode from 'react-qr-code'
import { ITENS_LEGAIS, NOTA_LEGAL, REGRAS_CONDUTA, TITULO_CONDUTA, TITULO_LEGAL } from '../lib/regulamento'
import { formatarData, paraMillis } from '../lib/status'
import type { Player } from '../types'

/** Nomes longos usam fonte menor para continuar cabendo (a frente é pequena). */
function tamanhoNome(nome: string) {
  const n = nome.trim().length
  if (n <= 22) return 12.5
  if (n <= 34) return 10.6
  return 8.8
}

interface Props {
  player: Player
  verifyUrl: string
  timeNome: string | null
  timeLogoUrl: string | null
}

function dataBr(iso: string) {
  const [a, m, d] = iso.split('-')
  return a && m && d ? `${d}/${m}/${a}` : iso
}

/**
 * Folha para imprimir: frente e verso lado a lado, cada um no tamanho de cartão de crédito
 * (85,6 x 54 mm). Recortar na linha externa, dobrar na linha do meio e plastificar.
 */
export function CarteirinhaImpressao({ player, verifyUrl, timeNome, timeLogoUrl }: Props) {
  return (
    <div id="print-sheet">
      <p className="cc-instrucoes">
        <b>Como montar:</b> imprima em tamanho real (100%, papel A4, sem “ajustar à página”). Recorte na linha tracejada
        externa, dobre na linha tracejada do meio (frente de um lado, verso do outro) e plastifique.
      </p>

      <div className="cc-folha">
        <div className="cc-face cc-frente">
          <div className="cc-topo">
            <img src="/logo.png" alt="" className="cc-logo" />
            <div>
              <p className="cc-assoc">Associação de Airsoft de Caldas Novas</p>
              <p className="cc-tipo">Carteira do associado</p>
            </div>
          </div>

          <div className="cc-corpo">
            <div className="cc-foto">
              {player.fotoUrl ? <img src={player.fotoUrl} alt={player.nomeCompleto} /> : <span>sem foto</span>}
            </div>

            <div className="cc-dados">
              <p className="cc-nome" style={{ fontSize: `${tamanhoNome(player.nomeCompleto)}pt` }}>
                {player.nomeCompleto}
              </p>
              <div className="cc-info">
                <div className="cc-par">
                  <p className="cc-linha">
                    <span>Nascimento</span>
                    <b>{player.dataNascimento ? dataBr(player.dataNascimento) : '—'}</b>
                  </p>
                  <p className="cc-linha">
                    <span>Membro desde</span>
                    <b>{formatarData(paraMillis(player.criadoEm))}</b>
                  </p>
                </div>
                <div className="cc-time">
                  {timeLogoUrl && <img src={timeLogoUrl} alt="" className="cc-time-logo" />}
                  <p className="cc-linha">
                    <span>Time</span>
                    <b>{player.timeAprovado && timeNome ? timeNome : 'Sem time'}</b>
                  </p>
                </div>
              </div>
            </div>

            <div className="cc-qr">
              <div className="cc-qr-box">
                <QRCode value={verifyUrl} size={256} style={{ height: 'auto', maxWidth: '100%', width: '100%' }} />
              </div>
              <p>Leia para validar</p>
            </div>
          </div>
        </div>

        <div className="cc-face cc-verso">
          <p className="cc-titulo-verso">{TITULO_LEGAL}</p>
          <ul className="cc-legal">
            {ITENS_LEGAIS.map((i) => (
              <li key={i.ref}>
                {i.texto} <b>{i.ref}</b>
              </li>
            ))}
          </ul>
          <p className="cc-nota-legal">{NOTA_LEGAL}</p>

          <p className="cc-titulo-verso cc-titulo-conduta">{TITULO_CONDUTA}</p>
          <ul className="cc-regras">
            {REGRAS_CONDUTA.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
