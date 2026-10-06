import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { CartaoVerificado, type CartaoPublico } from '../components/CartaoVerificado'

export function Verify() {
  const { uid } = useParams<{ uid: string }>()
  const [card, setCard] = useState<CartaoPublico | null | undefined>(undefined)

  useEffect(() => {
    if (!uid) return
    getDoc(doc(db, 'publicCards', uid)).then((snap) => {
      setCard(snap.exists() ? (snap.data() as CartaoPublico) : null)
    })
  }, [uid])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="chamfer w-full max-w-sm panel p-6 text-center">
        <img
          src="/logo.png"
          alt="AACN"
          className="mx-auto mb-3 h-16 w-16 rounded-full ring-2 ring-accent-hi/60"
        />
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-mute">
          Verificação de associado
        </p>

        {card === undefined && <p className="text-mute">Carregando...</p>}

        {card === null && (
          <p className="text-danger">Carteirinha não encontrada.</p>
        )}

        {card && <CartaoVerificado card={card} />}
      </div>
    </div>
  )
}
