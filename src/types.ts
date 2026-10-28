export type PlayerStatus = 'pago' | 'inadimplente' | 'inativo'

export type UserRole = 'player' | 'admin' | 'tesoureiro' | 'organizador' | 'parceiro'

/** Dados públicos mínimos de um jogador (cartão público), sem informações pessoais. */
export interface JogadorResumo {
  uid: string
  nomeCompleto: string
  timeNome: string | null
  timeId?: string | null
  fotoUrl?: string | null
  destaques?: string[]
}

export interface Player {
  uid: string
  nomeCompleto: string
  email: string
  endereco: string
  bairro?: string
  cep?: string
  dataNascimento: string // ISO date (yyyy-mm-dd)
  cpf?: string // só os 11 dígitos
  /** Até 3 conquistas (ids) que o jogador escolheu mostrar na carteirinha, na ordem. */
  destaques?: string[]
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
  /** Id do último pagamento estornado (a tesouraria grava junto com o estorno; liga a mudança de vencimento ao estorno nas regras). */
  ultimoEstornoId?: string
  /** Cargo principal: 'player' ou 'admin' (definido no console). Cargos delegados antigos também podem estar aqui. */
  role: UserRole
  /** Cargos delegados pelo admin (tesoureiro, organizador, parceiro). Uma pessoa pode ter mais de um. */
  cargos?: UserRole[]
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

export type JoinRequestStatus = 'pendente' | 'aprovado' | 'rejeitado' | 'removido'

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
  /** WhatsApp do tesoureiro: para onde o jogador manda o comprovante do Pix. */
  whatsapp?: string
}

/** pendente = Pix gerado, aguardando a baixa; confirmado = baixa dada; estornado = baixa desfeita (fica no histórico). */
export type PaymentStatus = 'pendente' | 'confirmado' | 'estornado'

export interface Payment {
  id: string
  uid: string
  jogadorNome: string
  valor: number
  txid: string
  status: PaymentStatus
  criadoEm: number
  confirmadoEm: unknown
  dataPagamento: unknown
  creditosGerados?: number
  /** Log da baixa: quem confirmou o recebimento (a data e a hora estão em confirmadoEm). */
  confirmadoPor?: string
  confirmadoPorNome?: string
  /** Como o jogador estava antes da baixa; serve para desfazer exatamente no estorno. */
  statusAntes?: PlayerStatus
  vencimentoAntes?: number | null
  /** Log do estorno: quem desfez a baixa, quando e por quê. */
  estornadoEm?: unknown
  estornadoPor?: string
  estornadoPorNome?: string
  estornoMotivo?: string
}

export interface Wallet {
  creditos: number
  ultimoJogoId: string | null
  ultimaConquistaId?: string | null
}

/** Contadores de confiança (só a organização e a tesouraria incrementam): base das conquistas. */
export interface Estatisticas {
  jogos?: number
  noturnos?: number
  mensalidades?: number
  ultimoJogoId?: string
}

/** Conquista já resgatada (um documento por jogador e conquista; cria o bônus de créditos). */
export interface ConquistaResgatada {
  uid: string
  conquista: string
  creditos: number
  criadoEm: unknown
  concedidaPor?: string
  concedidaPorNome?: string
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
  horario?: string | null // HH:MM
  local?: string | null
  localLink?: string | null
  descricao?: string | null
  vagas?: number | null // null = sem limite
  inscritos?: number // inscrições ativas + presentes
  espera?: number // lista de espera
}

export type PagoCom = 'creditos' | 'dinheiro' | 'pendente'

// espera = lista de espera (jogo lotado); ativa = inscrito (débito só no check-in);
// presente = check-in feito; removida = cancelada pela diretoria
export type ParticipationStatus = 'espera' | 'ativa' | 'presente' | 'removida'

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
  /** Convidado: não é associado (nem tem cadastro), joga só este jogo e paga em dinheiro. O uid é "convidado_...". */
  convidado?: boolean
}

export type LedgerTipo = 'pagamento' | 'jogo' | 'estorno' | 'ajuste' | 'bonus' | 'estorno_pagamento'

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

export interface Aviso {
  id: string
  titulo: string
  texto: string
  fixado: boolean
  autorUid: string
  autorNome: string
  criadoEm: unknown
}

export interface Partner {
  id: string
  /** Jogador (com o cargo de parceiro) que gerencia esta loja: edita as promoções e os dados. */
  donoUid?: string | null
  nome: string
  categoria: string
  desconto: string
  descricao?: string | null
  endereco?: string | null
  telefone?: string | null
  link?: string | null
  logoUrl?: string | null
  ativo: boolean
  criadoEm: unknown
}

/** Lançamento manual do caixa da associação (as mensalidades entram sozinhas, não ficam aqui). */
export interface LancamentoCaixa {
  id: string
  tipo: 'entrada' | 'saida'
  valor: number
  data: string // yyyy-mm-dd
  categoria: string
  descricao?: string
  criadoPor: string
  criadoPorNome: string
  criadoEm: unknown
  editadoPor?: string
  editadoPorNome?: string
  editadoEm?: unknown
}

/** Resumo mensal publicado aos associados (totais e por categoria, sem os lançamentos). */
export interface PrestacaoContas {
  mes: string // yyyy-mm
  entradas: number
  saidas: number
  saldoMes: number
  saldoAcumulado: number
  entradasPorCategoria: Record<string, number>
  saidasPorCategoria: Record<string, number>
  publicadoPor: string
  publicadoPorNome: string
  publicadoEm: unknown
}

/** Ranking de presença (um documento só, montado a partir dos check-ins). */
export interface RankingJogador {
  n: string // nome
  t: string | null // nome do time
  ti: string | null // id do time
  m: Record<string, number> // presenças por mês ("2026-10": 3)
  nt: Record<string, number> // presenças em jogos noturnos por mês
}

export interface RankingJogo {
  id: string
  nome: string
  data: string // yyyy-mm-dd
  noturno: boolean
  presentes: number
}

export interface RankingDoc {
  atualizadoEm: unknown
  atualizadoPor: string
  atualizadoPorNome: string
  jogos: RankingJogo[]
  jogadores: Record<string, RankingJogador>
}

/** Registro do histórico de ações da diretoria. */
export interface RegistroDeAcao {
  id: string
  acao: string
  resumo: string
  porUid: string
  porNome: string
  alvoUid: string | null
  alvoNome: string | null
  criadoEm: unknown
}

/** Registro de que um jogador marcou um aviso como lido (avisoLeituras/<avisoId>_<uid>). Sem data = lido antes do registro existir. */
export interface AvisoLeitura {
  avisoId: string
  uid: string
  nome: string
  lidoEm: unknown
}
