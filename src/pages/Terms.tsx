import { Link } from 'react-router-dom'
import { POLITICA_PRIVACIDADE, TERMO_RESPONSABILIDADE, VERSAO_TERMOS, type Secao } from '../lib/termos'

function Bloco({ titulo, secoes }: { titulo: string; secoes: Secao[] }) {
  return (
    <section className="panel mb-6 p-5">
      <h2 className="mb-4 text-sm font-bold text-ink">{titulo}</h2>
      <div className="space-y-4">
        {secoes.map((s) => (
          <div key={s.titulo}>
            <h3 className="mb-1 text-sm font-semibold text-ink">{s.titulo}</h3>
            <p className="text-sm leading-relaxed text-mute">{s.texto}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Terms() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="text-sm text-mute hover:underline">
        &larr; Voltar
      </Link>
      <h1 className="mb-1 mt-3 text-xl font-bold text-ink">Termos e privacidade</h1>
      <p className="mb-6 text-xs text-mute">Versão {VERSAO_TERMOS}</p>
      <Bloco titulo="Termo de responsabilidade e ciência de riscos" secoes={TERMO_RESPONSABILIDADE} />
      <Bloco titulo="Política de privacidade (LGPD)" secoes={POLITICA_PRIVACIDADE} />
    </div>
  )
}
