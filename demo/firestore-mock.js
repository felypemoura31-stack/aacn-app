// Firestore falso em memória, usado apenas por `npm run dev:demo`.
const now = Date.now()
const day = 86400000

const store = {
  players: {},
  publicCards: {},
  teams: {},
  teamJoinRequests: {},
  mail: {},
}

function player(uid, nome, email, extra = {}) {
  return {
    uid,
    nomeCompleto: nome,
    email,
    endereco: 'Rua das Acácias, 120 - Caldas Novas/GO',
    dataNascimento: '1994-05-17',
    contatoEmergenciaNome: 'Maria Silva',
    contatoEmergenciaTelefone: '(64) 99999-1234',
    condicoesMedicas: '',
    fotoUrl: null,
    timeId: null,
    timeNome: null,
    timeAprovado: false,
    status: 'pago',
    role: 'player',
    criadoEm: now - 30 * day,
    atualizadoEm: now - day,
    ...extra,
  }
}

const seedPlayers = [
  player('u-admin', 'Administrador AACN', 'admin@teste.com', { role: 'admin' }),
  player('u-jogador', 'Carlos Silva', 'jogador@teste.com', {
    timeId: 't-alpha',
    timeNome: 'Alpha Squad',
    timeAprovado: true,
  }),
  player('u-marcos', 'Marcos Lima', 'marcos@teste.com', {
    status: 'inadimplente',
    condicoesMedicas: 'Alergia a picada de abelha',
  }),
  player('u-ana', 'Ana Souza', 'ana@teste.com', {
    status: 'inativo',
    timeId: 't-bravo',
    timeNome: 'Bravo Company',
    timeAprovado: true,
  }),
  player('u-pedro', 'Pedro Alves', 'pedro@teste.com', {
    timeId: 't-alpha',
    timeNome: 'Alpha Squad',
    timeAprovado: false,
  }),
]

for (const p of seedPlayers) {
  store.players[p.uid] = p
  store.publicCards[p.uid] = {
    nomeCompleto: p.nomeCompleto,
    fotoUrl: null,
    timeNome: p.timeAprovado ? p.timeNome : null,
    status: p.status,
    atualizadoEm: now,
  }
}

store.teams['t-alpha'] = {
  nome: 'Alpha Squad',
  representanteUid: 'u-jogador',
  representanteNome: 'Carlos Silva',
  representanteEmail: 'jogador@teste.com',
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

const listeners = new Set()
const notify = () => setTimeout(() => listeners.forEach((l) => l()), 0)
const clone = (v) => JSON.parse(JSON.stringify(v))

function resolveValues(data) {
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && v.__serverTimestamp ? Date.now() : v
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
  return { docs: rows.map(([id]) => docSnap(q.col, id)) }
}

export const getFirestore = () => ({})
export const serverTimestamp = () => ({ __serverTimestamp: true })
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

export async function setDoc(ref, data) {
  store[ref.col] ??= {}
  store[ref.col][ref.id] = resolveValues(data)
  notify()
}

export async function updateDoc(ref, data) {
  if (!store[ref.col]?.[ref.id]) throw new Error('Documento não existe: ' + ref.col + '/' + ref.id)
  Object.assign(store[ref.col][ref.id], resolveValues(data))
  notify()
}

export async function addDoc(colRef, data) {
  const id = 'id-' + Math.random().toString(36).slice(2, 10)
  store[colRef.col] ??= {}
  store[colRef.col][id] = resolveValues(data)
  notify()
  return { id }
}
