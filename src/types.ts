export type PlayerStatus = 'pago' | 'inadimplente' | 'inativo'

export type UserRole = 'player' | 'admin' | 'tesoureiro' | 'organizador'

/** Dados públicos mínimos de um jogador (cartão público), sem informações pessoais. */
export interface JogadorResumo {
  uid: string
  nomeCompleto: string
  timeNome: string | null
  timeId?: string | null
  fotoUrl?: string | null
}

export interface Player {
  uid: string
  nomeCompleto: string
  email: string
  endereco: string
  dataNascimento: string // ISO date (yyyy-mm-dd)
  contatoEmergenciaNome: string
  contatoEmergenciaTelefone: string
  celular: string
  condicoesMedicas: string
  fotoUrl: string | null
  timeId: string | null
  timeNome: string | null
  timeAprovado: boolean
  status: PlayerStatus
  vencimento: number | null // ms; pago enquanto vencimento > agora
  ultimoPagamento: number | null
  role: UserRole
  cargoAlteradoPor?: string
  cargoAlteradoEm?: number
  aceiteTermosVersao?: string | null
  aceiteTermosEm?: unknown
  responsavelLegalNome?: string
  responsavelLegalTelefone?: string
  responsavelLegalAutoriza?: boolean
  criadoEm: number
  atualizadoEm: number
}

export interface Team {
  id: string
  nome: string
  representanteUid: string | null
  representanteNome: string | null
  representanteEmail: string | null
  logoUrl?: string | null
  dataCriacao?: string | null // yyyy-mm-dd
  cidade?: string | null
  responsavelNome?: string | null
  redes?: RedesDoTime | null
  criadoEm: number
}

export type RedeSocial = 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'whatsapp' | 'x' | 'discord' | 'site'

/** Só as redes que o time tem; o valor é o que foi digitado (@usuario, número ou link). */
export type RedesDoTime = Partial<Record<RedeSocial, string>>

export type JoinRequestStatus = 'pendente' | 'aprovado' | 'rejeitado'

export interface TeamJoinRequest {
  id: string
  timeId: string
  timeNome: string
  jogadorUid: string
  jogadorNome: string
  status: JoinRequestStatus
  criadoEm: number
  resolvidoEm: number | null
}

export interface PixConfig {
  chave: string
  nome: string
  cidade: string
  valor: number
}

export type PaymentStatus = 'pendente' | 'confirmado'

export interface Payment {
  id: string
  uid: string
  jogadorNome: string
  valor: number
  txid: string
  status: PaymentStatus
  criadoEm: number
  confirmadoEm: number | null
  dataPagamento: number | null
  creditosGerados?: number
}

export interface Wallet {
  creditos: number
  ultimoJogoId: string | null
}

export type GameStatus = 'aberto' | 'encerrado'

export interface Game {
  id: string
  nome: string
  data: string // yyyy-mm-dd
  valor: number // preço em dinheiro (R$)
  custoCreditos: number
  status: GameStatus
  criadoEm: number
}

export type PagoCom = 'creditos' | 'dinheiro' | 'pendente'

// ativa = inscrito (débito só no check-in); presente = check-in feito; removida = cancelada pela diretoria
export type ParticipationStatus = 'ativa' | 'presente' | 'removida'

export interface Participation {
  id: string
  gameId: string
  gameNome: string
  uid: string
  jogadorNome: string
  pagoCom: PagoCom
  creditosDebitados: number
  status: ParticipationStatus
  criadoEm: number
  presenteEm?: number
  checkInPor?: string
  checkInPorNome?: string
}

export type LedgerTipo = 'pagamento' | 'jogo' | 'estorno' | 'ajuste'

export interface LedgerEntry {
  id: string
  uid: string
  tipo: LedgerTipo
  creditos: number // positivo = entrada, negativo = saída
  saldoApos: number
  descricao: string
  refId: string | null
  porUid: string
  porNome: string
  criadoEm: number
}
