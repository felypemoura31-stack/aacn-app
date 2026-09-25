// Firebase Auth falso em memória, usado apenas por `npm run dev:demo`.
const users = [
  { uid: 'u-admin', email: 'admin@teste.com', senha: '123456', displayName: 'Administrador AACN' },
  { uid: 'u-jogador', email: 'jogador@teste.com', senha: '123456', displayName: 'Carlos Silva' },
  { uid: 'u-marcos', email: 'marcos@teste.com', senha: '123456', displayName: 'Marcos Lima' },
  { uid: 'u-ana', email: 'ana@teste.com', senha: '123456', displayName: 'Ana Souza' },
  { uid: 'u-pedro', email: 'pedro@teste.com', senha: '123456', displayName: 'Pedro Alves' },
]

const KEY = 'aacn-demo-uid'
let current = null
try {
  const saved = localStorage.getItem(KEY)
  current = users.find((u) => u.uid === saved) ?? null
} catch {
  current = null
}

const subs = new Set()
const setCurrent = (u) => {
  current = u
  try {
    if (u) localStorage.setItem(KEY, u.uid)
    else localStorage.removeItem(KEY)
  } catch {
    // ignora
  }
  subs.forEach((cb) => cb(current))
}
const authError = (code) => Object.assign(new Error(code), { code })

export const getAuth = () => ({})

export function onAuthStateChanged(_auth, cb) {
  subs.add(cb)
  setTimeout(() => cb(current), 0)
  return () => subs.delete(cb)
}

export async function signInWithEmailAndPassword(_auth, email, senha) {
  const u = users.find((x) => x.email === email && x.senha === senha)
  if (!u) throw authError('auth/invalid-credential')
  setCurrent(u)
  return { user: u }
}

export async function createUserWithEmailAndPassword(_auth, email, senha) {
  if (users.some((x) => x.email === email)) throw authError('auth/email-already-in-use')
  const u = { uid: 'u-' + Math.random().toString(36).slice(2, 10), email, senha, displayName: '' }
  users.push(u)
  setCurrent(u)
  return { user: u }
}

export async function updateProfile(user, { displayName }) {
  user.displayName = displayName
}

export async function signOut() {
  setCurrent(null)
}
