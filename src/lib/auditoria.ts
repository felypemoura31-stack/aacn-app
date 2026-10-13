import { doc, serverTimestamp, setDoc, type WriteBatch } from 'firebase/firestore'
import { db } from '../firebase'
import type { Autor } from './credits'

/**
 * Histórico de ações da diretoria (Admin → Histórico de ações): quem fez o quê e quando. Cada registro é
 * gravado no MESMO lote da ação sempre que ela já é um lote (então não existe a ação sem o registro) e, nas
 * demais, logo depois. Os registros não se editam nem se apagam (as regras do banco impedem).
 *
 * Só vê o que o app faz: quem mexer direto no console do Firebase não aparece aqui.
 */
export type AcaoAuditoria =
  | 'pagamento_baixa'
  | 'pagamento_estorno'
  | 'pagamento_cancelado'
  | 'chave_pix'
  | 'credito_ajuste'
  | 'credito_ajuste_desfeito'
  | 'caixa_lancamento'
  | 'caixa_edicao'
  | 'caixa_exclusao'
  | 'caixa_publicacao'
  | 'jogador_excluido'
  | 'conta_excluida'
  | 'jogador_resetado'
  | 'jogador_editado'
  | 'cargo'
  | 'conquista_concedida'
  | 'conquista_removida'
  | 'time_representante'
  | 'jogo_excluido'
  | 'inscricao_removida'

export const ROTULO_ACAO: Record<AcaoAuditoria, string> = {
  pagamento_baixa: 'Baixa de Pix',
  pagamento_estorno: 'Baixa estornada',
  pagamento_cancelado: 'Cobrança cancelada',
  chave_pix: 'Chave Pix',
  credito_ajuste: 'Ajuste de créditos',
  credito_ajuste_desfeito: 'Ajuste desfeito',
  caixa_lancamento: 'Caixa: lançamento',
  caixa_edicao: 'Caixa: edição',
  caixa_exclusao: 'Caixa: exclusão',
  caixa_publicacao: 'Prestação de contas',
  jogador_excluido: 'Jogador excluído',
  conta_excluida: 'Conta excluída',
  jogador_resetado: 'Dados resetados',
  jogador_editado: 'Ficha editada',
  cargo: 'Cargo',
  conquista_concedida: 'Conquista concedida',
  conquista_removida: 'Conquista removida',
  time_representante: 'Representante de time',
  jogo_excluido: 'Jogo excluído',
  inscricao_removida: 'Inscrição removida',
}

export type GrupoAuditoria = 'dinheiro' | 'pessoas' | 'jogos'

export const GRUPOS_AUDITORIA: { id: GrupoAuditoria; rotulo: string; acoes: AcaoAuditoria[] }[] = [
  {
    id: 'dinheiro',
    rotulo: 'Dinheiro',
    acoes: [
      'pagamento_baixa',
      'pagamento_estorno',
      'pagamento_cancelado',
      'chave_pix',
      'credito_ajuste',
      'credito_ajuste_desfeito',
      'caixa_lancamento',
      'caixa_edicao',
      'caixa_exclusao',
      'caixa_publicacao',
    ],
  },
  {
    id: 'pessoas',
    rotulo: 'Pessoas',
    acoes: ['jogador_excluido', 'conta_excluida', 'jogador_resetado', 'jogador_editado', 'cargo', 'conquista_concedida', 'conquista_removida', 'time_representante'],
  },
  { id: 'jogos', rotulo: 'Jogos', acoes: ['jogo_excluido', 'inscricao_removida'] },
]

export interface RegistroAuditoria {
  acao: AcaoAuditoria
  /** Frase pronta, no passado: "Deu baixa no Pix de R$ 15,00 de Fulano". Até 400 letras. */
  resumo: string
  autor: Autor
  /** A pessoa atingida pela ação, quando há uma. */
  alvo?: { uid: string; nome: string } | null
}

function dados(r: RegistroAuditoria) {
  return {
    acao: r.acao,
    resumo: r.resumo.slice(0, 400),
    porUid: r.autor.uid,
    porNome: r.autor.nome,
    alvoUid: r.alvo?.uid ?? null,
    alvoNome: r.alvo?.nome ?? null,
    criadoEm: serverTimestamp(),
  }
}

const novoId = () => crypto.randomUUID().replace(/-/g, '')

/** Junta o registro ao lote da própria ação (grava os dois ou nenhum). */
export function auditar(batch: WriteBatch, r: RegistroAuditoria) {
  batch.set(doc(db, 'auditoria', novoId()), dados(r))
}

/**
 * Registro avulso, para ações que não são um lote. Se o registro falhar, a ação já foi feita e não dá para
 * desfazer: o erro só vai para o console (não interrompe quem está trabalhando).
 */
export async function registrarAuditoria(r: RegistroAuditoria) {
  try {
    await setDoc(doc(db, 'auditoria', novoId()), dados(r))
  } catch (e) {
    console.warn('Não consegui registrar no histórico de ações', e)
  }
}
