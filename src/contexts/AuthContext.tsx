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
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { sincronizarCartaoPublico } from '../lib/publicCard'
import type { Player } from '../types'

interface RegisterInput {
  nomeCompleto: string
  email: string
  senha: string
}

interface AuthContextValue {
  currentUser: User | null
  player: Player | null
  loading: boolean
  register: (input: RegisterInput) => Promise<void>
  login: (email: string, senha: string) => Promise<void>
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

  async function register({ nomeCompleto, email, senha }: RegisterInput) {
    const cred = await createUserWithEmailAndPassword(auth, email, senha)
    await updateProfile(cred.user, { displayName: nomeCompleto })

    const now = Date.now()
    const newPlayer: Player = {
      uid: cred.user.uid,
      nomeCompleto,
      email,
      endereco: '',
      dataNascimento: '',
      contatoEmergenciaNome: '',
      contatoEmergenciaTelefone: '',
      condicoesMedicas: '',
      fotoUrl: null,
      timeId: null,
      timeNome: null,
      timeAprovado: false,
      status: 'inadimplente',
      role: 'player',
      criadoEm: now,
      atualizadoEm: now,
    }
    await setDoc(doc(db, 'players', cred.user.uid), {
      ...newPlayer,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    })
    await sincronizarCartaoPublico(newPlayer)
  }

  async function login(email: string, senha: string) {
    await signInWithEmailAndPassword(auth, email, senha)
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
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
