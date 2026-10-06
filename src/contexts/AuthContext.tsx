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
import { VERSAO_TERMOS } from '../lib/termos'
import type { Player } from '../types'

interface RegisterInput {
  nomeCompleto: string
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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [playerLoading, setPlayerLoading] = useState(true)

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

  useEffect(() => {
    if (!player?.celular) return
    getDoc(doc(db, 'contatos', player.uid))
      .then((snap) => {
        if (!snap.exists() || snap.data().celular !== player.celular) {
          return setDoc(doc(db, 'contatos', player.uid), { celular: player.celular, atualizadoEm: serverTimestamp() })
        }
      })
      .catch(() => {})
  }, [player])

  async function register({ nomeCompleto, email, senha, aceitaTermos }: RegisterInput) {
    if (!aceitaTermos) throw new Error('É preciso aceitar o termo de responsabilidade.')
    const cred = await createUserWithEmailAndPassword(auth, email, senha)
    await updateProfile(cred.user, { displayName: nomeCompleto })

    const now = Date.now()
    const newPlayer: Player = {
      uid: cred.user.uid,
      nomeCompleto,
      email,
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
    await setDoc(doc(db, 'players', cred.user.uid), {
      ...newPlayer,
      aceiteTermosEm: serverTimestamp(),
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    })
    await setDoc(doc(db, 'wallets', cred.user.uid), {
      creditos: 0,
      ultimoJogoId: null,
      atualizadoEm: serverTimestamp(),
    })
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

  const value: AuthContextValue = {
    currentUser,
    player,
    loading: authLoading || playerLoading,
    register,
    login,
    resetPassword,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
