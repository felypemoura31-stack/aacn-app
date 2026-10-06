import QRCode from 'react-qr-code'
import { REGRAS_VERSO, TITULO_VERSO } from '../lib/regulamento'
import type { Player } from '../types'

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
              <p className="cc-nome">{player.nomeCompleto}</p>
              <p className="cc-linha">
                <span>Nascimento</span> {player.dataNascimento ? dataBr(player.dataNascimento) : '—'}
              </p>
              <div className="cc-time">
                {timeLogoUrl && <img src={timeLogoUrl} alt="" className="cc-time-logo" />}
                <p className="cc-linha">
                  <span>Time</span>
                  <br />
                  <b>{player.timeAprovado && timeNome ? timeNome : 'Sem time'}</b>
                </p>
              </div>
            </div>

            <div className="cc-qr">
              <div className="cc-qr-box">
                <QRCode value={verifyUrl} size={256} style={{ height: 'auto', maxWidth: '100%', width: '100%' }} />
              </div>
              <p>Situação e validade: leia o QR</p>
            </div>
          </div>
        </div>

        <div className="cc-face cc-verso">
          <p className="cc-titulo-verso">{TITULO_VERSO}</p>
          <ol className="cc-regras">
            {REGRAS_VERSO.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <p className="cc-assinatura">Assinatura do associado: ______________________</p>
        </div>
      </div>
    </div>
  )
}
