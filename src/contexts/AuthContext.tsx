import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { sincronizarCartaoPublico } from '../lib/publicCard'
import { excluirMinhaConta } from '../lib/conta'
import { cpfValido, soDigitos } from '../lib/cadastro'
import { contatoDesatualizado, contatoDoCadastro, type Contato } from '../lib/useContatos'
import { VERSAO_TERMOS } from '../lib/termos'
import type { Player } from '../types'

interface RegisterInput {
  nomeCompleto: string
  cpf: string
  email: string
  senha: string
  aceitaTermos: boolean
}

interface AuthContextValue {
  currentUser: User | null
  player: Player | null
  loading: boolean
  register: (input: RegisterInput) => Promise<void>
  login: (email: string, senha: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  logout: () => Promise<void>
  /** Entrou com e-mail/senha, mas o cadastro foi excluído (pelo admin). */
  cadastroExcluido: boolean
  recriarCadastro: () => Promise<void>
  /** Exclui a própria conta (pede a senha de novo). */
  excluirConta: (senha: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [playerLoading, setPlayerLoading] = useState(true)
  // true enquanto o app cria/exclui o cadastro: evita mostrar a tela de "cadastro excluído" nesse meio tempo
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setAuthLoading(false)
      if (!user) {
        setPlayer(null)
        setPlayerLoading(false)
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!currentUser) return
    setPlayerLoading(true)
    const ref = doc(db, 'players', currentUser.uid)
    const unsub = onSnapshot(ref, (snap) => {
      setPlayer(snap.exists() ? (snap.data() as Player) : null)
      setPlayerLoading(false)
    })
    return unsub
  }, [currentUser])

  useEffect(() => {
    if (!player?.timeAprovado || !player.timeId) return
    getDoc(doc(db, 'publicCards', player.uid))
      .then((snap) => {
        if (snap.exists() && snap.data().timeId !== player.timeId) return sincronizarCartaoPublico(player)
      })
      .catch(() => {})
  }, [player])

  // Cópia para a tesouraria (celular, nascimento e data de cadastro); o tesoureiro não lê o cadastro.
  useEffect(() => {
    if (!player) return
    getDoc(doc(db, 'contatos', player.uid))
      .then((snap) => {
        if (contatoDesatualizado(snap.exists() ? (snap.data() as Contato) : undefined, player)) {
          return setDoc(doc(db, 'contatos', player.uid), { ...contatoDoCadastro(player), atualizadoEm: serverTimestamp() })
        }
      })
      .catch(() => {})
  }, [player])

  async function register({ nomeCompleto, cpf, email, senha, aceitaTermos }: RegisterInput) {
    if (!aceitaTermos) throw new Error('É preciso aceitar o termo de responsabilidade.')
    if (!cpfValido(cpf)) throw new Error('Informe um CPF válido.')
    setOcupado(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha)
      await updateProfile(cred.user, { displayName: nomeCompleto })
      await criarCadastro(cred.user.uid, email, nomeCompleto, soDigitos(cpf))
    } finally {
      setOcupado(false)
    }
  }

  /** Cria o cadastro inicial (jogador, inadimplente) e o cartão público; a carteira só se ainda não existir. */
  async function criarCadastro(uid: string, email: string, nomeCompleto: string, cpf = '') {
    const now = Date.now()
    const newPlayer: Player = {
      uid,
      nomeCompleto,
      email,
      cpf,
      endereco: '',
      bairro: '',
      cep: '',
      dataNascimento: '',
      contatoEmergenciaNome: '',
      contatoEmergenciaTelefone: '',
      celular: '',
      condicoesMedicas: '',
      fotoUrl: null,
      timeId: null,
      timeNome: null,
      timeAprovado: false,
      status: 'inadimplente',
      vencimento: null,
      ultimoPagamento: null,
      role: 'player',
      aceiteTermosVersao: VERSAO_TERMOS,
      criadoEm: now,
      atualizadoEm: now,
    }
    await setDoc(doc(db, 'players', uid), {
      ...newPlayer,
      aceiteTermosEm: serverTimestamp(),
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    })
    if (!(await getDoc(doc(db, 'wallets', uid))).exists()) {
      await setDoc(doc(db, 'wallets', uid), {
        creditos: 0,
        ultimoJogoId: null,
        atualizadoEm: serverTimestamp(),
      })
    }
    await sincronizarCartaoPublico(newPlayer)
  }

  async function login(email: string, senha: string) {
    await signInWithEmailAndPassword(auth, email, senha)
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email)
  }

  async function logout() {
    await signOut(auth)
  }

  async function recriarCadastro() {
    if (!currentUser?.email) return
    setOcupado(true)
    try {
      await criarCadastro(currentUser.uid, currentUser.email, currentUser.displayName || currentUser.email)
    } finally {
      setOcupado(false)
    }
  }

  async function excluirConta(senha: string) {
    if (!currentUser || !player) return
    setOcupado(true)
    try {
      await excluirMinhaConta(currentUser, player, senha)
    } finally {
      setOcupado(false)
    }
  }

  const value: AuthContextValue = {
    currentUser,
    player,
    loading: authLoading || playerLoading,
    register,
    login,
    resetPassword,
    logout,
    cadastroExcluido: !authLoading && !playerLoading && !ocupado && !!currentUser && !player,
    recriarCadastro,
    excluirConta,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
