// Firestore falso em memória, usado apenas por `npm run dev:demo`.
const now = Date.now()
const day = 86400000

const store = {
  players: {},
  publicCards: {},
  teams: {},
  teamJoinRequests: {},
  mail: {},
  config: {},
  payments: {},
  wallets: {},
  stats: {},
  conquistas: {},
  games: {},
  participations: {},
  ledger: {},
  contatos: {},
  cobrancas: {},
  avisos: {},
  partners: {},
}

const svg = (s) => 'data:image/svg+xml;utf8,' + encodeURIComponent(s)
const fotoDemo = (cor) =>
  svg(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect width="240" height="320" fill="${cor}"/><circle cx="120" cy="125" r="55" fill="#f1c9a5"/><path d="M20 320c0-70 45-105 100-105s100 35 100 105z" fill="#1f2937"/></svg>`)
const logoAlpha = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><path d="M96 8l78 26v62c0 46-34 78-78 90C52 174 18 142 18 96V34z" fill="#b91c1c"/><path d="M96 24l62 21v51c0 36-26 63-62 73-36-10-62-37-62-73V45z" fill="#111827"/><text x="96" y="118" font-family="Arial" font-weight="900" font-size="64" text-anchor="middle" fill="#fbbf24">AS</text></svg>',
)

function player(uid, nome, email, extra = {}) {
  return {
    uid,
    nomeCompleto: nome,
    email,
    endereco: 'Rua das Acácias, 120',
    bairro: 'Centro',
    cep: '75680-000',
    dataNascimento: '1994-05-17',
    contatoEmergenciaNome: 'Maria Silva',
    contatoEmergenciaTelefone: '(64) 99999-1234',
    celular: '(64) 98888-0000',
    aceiteTermosVersao: '2026-10-v1',
    aceiteTermosEm: now - 20 * day,
    responsavelLegalNome: '',
    responsavelLegalTelefone: '',
    responsavelLegalAutoriza: false,
    condicoesMedicas: '',
    fotoUrl: fotoDemo('#cbd5e1'),
    timeId: null,
    timeNome: null,
    timeAprovado: false,
    status: 'pago',
    vencimento: now + 20 * day,
    ultimoPagamento: now - 10 * day,
    role: 'player',
    criadoEm: now - 30 * day,
    atualizadoEm: now - day,
    ...extra,
  }
}

const seedPlayers = [
  player('u-admin', 'Administrador AACN', 'admin@teste.com', { role: 'admin' }),
  player('u-tesoureiro', 'Tiago Tesoureiro', 'tesoureiro@teste.com', { role: 'tesoureiro' }),
  player('u-organizador', 'Olavo Organizador', 'organizador@teste.com', { role: 'organizador' }),
  player('u-jogador', 'Carlos Silva', 'jogador@teste.com', {
    timeId: 't-alpha',
    timeNome: 'Alpha Squad',
    timeAprovado: true,
  }),
  player('u-marcos', 'Marcos Lima', 'marcos@teste.com', {
    status: 'pago',
    vencimento: now - 5 * day,
    ultimoPagamento: now - 35 * day,
    condicoesMedicas: 'Alergia a picada de abelha',
  }),
  player('u-ana', 'Ana Souza', 'ana@teste.com', {
    aceiteTermosVersao: null,
    celular: '',
    fotoUrl: null,
    status: 'inativo',
    vencimento: now - 40 * day,
    timeId: 't-bravo',
    timeNome: 'Bravo Company',
    timeAprovado: true,
  }),
  player('u-pedro', 'Pedro Alves', 'pedro@teste.com', {
    dataNascimento: '2010-06-01',
    timeId: 't-alpha',
    timeNome: 'Alpha Squad',
    timeAprovado: false,
  }),
]

for (const p of seedPlayers) {
  store.players[p.uid] = p
  store.publicCards[p.uid] = {
    nomeCompleto: p.nomeCompleto,
    fotoUrl: p.fotoUrl,
    timeNome: p.timeAprovado ? p.timeNome : null,
    timeId: p.timeAprovado ? p.timeId : null,
    status: p.status,
    vencimento: p.vencimento,
    atualizadoEm: now,
  }
}

store.teams['t-alpha'] = {
  nome: 'Alpha Squad',
  representanteUid: 'u-jogador',
  representanteNome: 'Carlos Silva',
  representanteEmail: 'jogador@teste.com',
  logoUrl: logoAlpha,
  cidade: 'Caldas Novas - GO',
  responsavelNome: 'Carlos Silva',
  dataCriacao: '2019-03-15',
  redes: { instagram: '@alphasquad', whatsapp: '(64) 99999-0000' },
  criadoEm: now - 60 * day,
}
store.teams['t-bravo'] = {
  nome: 'Bravo Company',
  representanteUid: null,
  representanteNome: null,
  representanteEmail: null,
  criadoEm: now - 50 * day,
}
store.teamJoinRequests['r-1'] = {
  timeId: 't-alpha',
  timeNome: 'Alpha Squad',
  jogadorUid: 'u-pedro',
  jogadorNome: 'Pedro Alves',
  status: 'pendente',
  criadoEm: now - 2 * day,
  resolvidoEm: null,
}

store.config.pix = {
  chave: 'demo@aacn.org.br',
  nome: 'AACN Caldas Novas',
  cidade: 'Caldas Novas',
  valor: 5,
}
store.payments['pg-1'] = {
  uid: 'u-marcos',
  jogadorNome: 'Marcos Lima',
  valor: 5,
  txid: 'AACNUMARCOSDEMO1',
  status: 'pendente',
  criadoEm: now - day,
  confirmadoEm: null,
  dataPagamento: null,
}

const saldos = { 'u-organizador': 0, 'u-tesoureiro': 0, 'u-admin': 0, 'u-jogador': 20, 'u-marcos': 0, 'u-ana': 0, 'u-pedro': 4 }
for (const [uid, creditos] of Object.entries(saldos)) {
  store.wallets[uid] = { creditos, ultimoJogoId: null, atualizadoEm: now }
}
const mov = (id, uid, tipo, creditos, saldoApos, descricao, offset, porUid = 'u-admin', porNome = 'Administrador AACN') => {
  store.ledger[id] = { uid, tipo, creditos, saldoApos, descricao, refId: null, porUid, porNome, criadoEm: now + offset * day }
}
mov('l1', 'u-jogador', 'pagamento', 20, 20, 'Pix de R$ 10,00 (pago em 25/09/2026)', -10)
mov('l2', 'u-pedro', 'pagamento', 10, 10, 'Pix de R$ 5,00 (pago em 20/09/2026)', -15)
mov('l3', 'u-pedro', 'ajuste', -6, 4, 'Compra de BBs na loja', -3)
const iso = (offset) => new Date(now + offset * day).toISOString().slice(0, 10)
store.games['g-1'] = {
  nome: 'Jogo de domingo',
  data: iso(7),
  horario: '07:30',
  local: 'Campo AACN - Rodovia GO-139',
  localLink: 'https://maps.google.com/?q=Caldas+Novas',
  descricao: 'Concentração às 7h30. Cronagem obrigatória. Levar óculos de proteção fechados e água.',
  vagas: 3,
  inscritos: 2,
  espera: 0,
  valor: 10,
  custoCreditos: 10,
  status: 'aberto',
  criadoEm: now - 2 * day,
}
store.games['g-2'] = {
  nome: 'Operação Noturna',
  data: iso(21),
  horario: '19:00',
  vagas: null,
  inscritos: 0,
  espera: 0,
  valor: 20,
  custoCreditos: 20,
  status: 'aberto',
  criadoEm: now - day,
}
store.participations['g-1_u-pedro'] = {
  gameId: 'g-1',
  gameNome: 'Jogo de domingo',
  uid: 'u-pedro',
  jogadorNome: 'Pedro Alves',
  pagoCom: 'pendente',
  creditosDebitados: 0,
  status: 'ativa',
  criadoEm: now - day,
}
store.participations['g-1_u-jogador'] = {
  gameId: 'g-1',
  gameNome: 'Jogo de domingo',
  uid: 'u-jogador',
  jogadorNome: 'Carlos Silva',
  pagoCom: 'pendente',
  creditosDebitados: 0,
  status: 'ativa',
  criadoEm: now - day,
}

store.stats['u-jogador'] = { jogos: 5, noturnos: 1, mensalidades: 1 }
store.stats['u-pedro'] = { jogos: 1, noturnos: 0, mensalidades: 3 }

store.partners['pt-1'] = {
  nome: 'Mercado do Atirador',
  categoria: 'Equipamentos e airsoft',
  desconto: '10% em BBs, baterias e acessórios',
  descricao: 'Válido para compras presenciais, mediante apresentação da carteirinha com mensalidade em dia.',
  endereco: 'Av. Orcalino Santos, 100 - Caldas Novas/GO',
  telefone: '(64) 99999-1111',
  link: 'https://instagram.com/mercadodoatirador',
  logoUrl: null,
  ativo: true,
  criadoEm: now - 10 * day,
}
store.partners['pt-2'] = {
  nome: 'Lanchonete Ponto Tático',
  categoria: 'Alimentação',
  desconto: '5% no consumo no local',
  descricao: null,
  endereco: 'Rua das Palmeiras, 55',
  telefone: null,
  link: null,
  logoUrl: null,
  ativo: true,
  criadoEm: now - 8 * day,
}
store.partners['pt-3'] = { nome: 'Oficina Velha (inativa)', categoria: 'Serviços', desconto: '15% na mão de obra', ativo: false, criadoEm: now - 20 * day }
const mes = (n, dia) => { const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(dia); return d.getTime() }
const pagos = [[0, 'u-jogador', 'Carlos Silva', 10, 3], [1, 'u-jogador', 'Carlos Silva', 10, 5], [2, 'u-jogador', 'Carlos Silva', 10, 5], [0, 'u-pedro', 'Pedro Alves', 5, 2], [1, 'u-pedro', 'Pedro Alves', 5, 4], [3, 'u-marcos', 'Marcos Lima', 5, 8]]
pagos.forEach(([n, uid, nome, valor, dia], i) => {
  store.payments['pg-h' + i] = { uid, jogadorNome: nome, valor, txid: 'AACNHIST' + i, status: 'confirmado', criadoEm: mes(n, dia), confirmadoEm: mes(n, dia), dataPagamento: mes(n, dia), creditosGerados: valor * 2 }
})

for (const p of seedPlayers) store.contatos[p.uid] = { celular: p.celular || '', atualizadoEm: now }
store.contatos['u-ana'] = { celular: '', atualizadoEm: now }
store.avisos['a-1'] = {
  titulo: 'Jogo de domingo confirmado',
  texto: 'Concentração às 7h30 no campo. Cronagem das 7h30 às 8h30. Tragam óculos de proteção fechados.',
  fixado: true,
  autorUid: 'u-organizador',
  autorNome: 'Olavo Organizador',
  criadoEm: now - day,
}
store.avisos['a-2'] = {
  titulo: 'Mensalidade por Pix',
  texto: 'Agora dá para pagar a mensalidade direto pelo app, em Minha carteirinha > Mensalidade.',
  fixado: false,
  autorUid: 'u-admin',
  autorNome: 'Administrador AACN',
  criadoEm: now - 3 * day,
}

const listeners = new Set()
const notify = () => setTimeout(() => listeners.forEach((l) => l()), 0)
const clone = (v) => JSON.parse(JSON.stringify(v))

function resolveValues(data, base = {}) {
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && v.__serverTimestamp ? Date.now() : v && v.__inc !== undefined ? (base[k] ?? 0) + v.__inc : v
  }
  return out
}

function docSnap(col, id) {
  const data = store[col]?.[id]
  return { id, exists: () => data !== undefined, data: () => clone(data) }
}

function runQuery(q) {
  let rows = Object.entries(store[q.col] ?? {}).map(([id, d]) => [id, d])
  for (const c of q.cons) {
    if (c.t !== 'where') continue
    rows = rows.filter(([, d]) => {
      if (c.op === '==') return d[c.field] === c.value
      if (c.op === 'in') return c.value.includes(d[c.field])
      return true
    })
  }
  for (const c of [...q.cons].reverse()) {
    if (c.t !== 'order') continue
    const dir = c.dir === 'desc' ? -1 : 1
    rows.sort(([, a], [, b]) => {
      const x = a[c.field]
      const y = b[c.field]
      if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y) * dir
      return ((x ?? 0) - (y ?? 0)) * dir
    })
  }
  return { docs: rows.map(([id]) => docSnap(q.col, id)), empty: rows.length === 0, size: rows.length }
}

export const getFirestore = () => ({})
export const serverTimestamp = () => ({ __serverTimestamp: true })
export const increment = (n) => ({ __inc: n })
export const collection = (_db, col) => ({ kind: 'col', col })
export const doc = (_db, col, id) => ({ kind: 'doc', col, id })
export const orderBy = (field, dir = 'asc') => ({ t: 'order', field, dir })
export const where = (field, op, value) => ({ t: 'where', field, op, value })
export const query = (c, ...cons) => ({ kind: 'query', col: c.col, cons })

export function onSnapshot(ref, cb) {
  const emit = () =>
    cb(ref.kind === 'doc' ? docSnap(ref.col, ref.id) : runQuery(ref.kind === 'col' ? { col: ref.col, cons: [] } : ref))
  listeners.add(emit)
  setTimeout(emit, 0)
  return () => listeners.delete(emit)
}

export async function getDoc(ref) {
  return docSnap(ref.col, ref.id)
}

export async function setDoc(ref, data, opts) {
  store[ref.col] ??= {}
  const atual = store[ref.col][ref.id]
  store[ref.col][ref.id] = opts?.merge && atual ? { ...atual, ...resolveValues(data, atual) } : resolveValues(data)
  notify()
}

export async function updateDoc(ref, data) {
  if (!store[ref.col]?.[ref.id]) throw new Error('Documento não existe: ' + ref.col + '/' + ref.id)
  Object.assign(store[ref.col][ref.id], resolveValues(data))
  notify()
}

export async function deleteDoc(ref) {
  delete store[ref.col]?.[ref.id]
  notify()
}

export async function addDoc(colRef, data) {
  const id = 'id-' + Math.random().toString(36).slice(2, 10)
  store[colRef.col] ??= {}
  store[colRef.col][id] = resolveValues(data)
  notify()
  return { id }
}

export function writeBatch() {
  const ops = []
  const batch = {
    set: (ref, data, opts) => (ops.push(['set', ref, data, opts]), batch),
    update: (ref, data) => (ops.push(['update', ref, data]), batch),
    delete: (ref) => (ops.push(['delete', ref]), batch),
    async commit() {
      for (const [op, ref, data, opts] of ops) {
        store[ref.col] ??= {}
        if (op === 'set') {
          const atual = store[ref.col][ref.id]
          store[ref.col][ref.id] = opts?.merge && atual ? { ...atual, ...resolveValues(data, atual) } : resolveValues(data)
        }
        else if (op === 'update') {
          if (!store[ref.col][ref.id]) throw new Error('Documento não existe: ' + ref.col + '/' + ref.id)
          Object.assign(store[ref.col][ref.id], resolveValues(data, store[ref.col][ref.id]))
        } else delete store[ref.col][ref.id]
      }
      notify()
    },
  }
  return batch
}

export const initializeFirestore = () => ({})
export const persistentLocalCache = () => ({})
export const persistentMultipleTabManager = () => ({})

export async function getDocs(ref) {
  return runQuery(ref.kind === 'col' ? { col: ref.col, cons: [] } : ref)
}
