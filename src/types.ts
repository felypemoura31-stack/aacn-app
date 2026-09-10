export type PlayerStatus = 'pago' | 'inadimplente' | 'inativo'

export type UserRole = 'player' | 'admin'

export interface Player {
  uid: string
  nomeCompleto: string
  email: string
  endereco: string
  dataNascimento: string // ISO date (yyyy-mm-dd)
  contatoEmergenciaNome: string
  contatoEmergenciaTelefone: string
  condicoesMedicas: string
  fotoUrl: string | null
  timeId: string | null
  timeNome: string | null
  timeAprovado: boolean
  status: PlayerStatus
  role: UserRole
  criadoEm: number
  atualizadoEm: number
}

export interface Team {
  id: string
  nome: string
  representanteUid: string | null
  representanteNome: string | null
  representanteEmail: string | null
  criadoEm: number
}

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
