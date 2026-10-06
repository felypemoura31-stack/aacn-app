import { useEffect, useRef, useState } from 'react'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { paraMillis } from './status'
import type { Player } from '../types'

/** Cópia que a tesouraria pode ler (o tesoureiro não lê o cadastro): celular, nascimento e "membro desde". */
export interface Contato {
  celular?: string
  dataNascimento?: string
  criadoEm?: unknown
}

/** Dados do cadastro que o espelho `contatos/{uid}` guarda. */
export function contatoDoCadastro(p: Pick<Player, 'celular' | 'dataNascimento' | 'criadoEm'>) {
  return {
    celular: p.celular ?? '',
    dataNascimento: p.dataNascimento ?? '',
    ...(p.criadoEm ? { criadoEm: p.criadoEm } : {}),
  }
}

export function contatoDesatualizado(
  c: Contato | undefined,
  p: Pick<Player, 'celular' | 'dataNascimento' | 'criadoEm'>,
) {
  return (
    !c ||
    (c.celular ?? '') !== (p.celular ?? '') ||
    (c.dataNascimento ?? '') !== (p.dataNascimento ?? '') ||
    (paraMillis(c.criadoEm) ?? null) !== (paraMillis(p.criadoEm) ?? null)
  )
}

/**
 * Lê os contatos de todos os jogadores (tesouraria). Se quem usa é o admin, que lê os cadastros,
 * ele também repõe a cópia de quem ainda não abriu o app depois de a cópia existir ou mudar.
 */
export function useContatos(repor: boolean) {
  const [contatos, setContatos] = useState<Record<string, Contato>>({})
  const repostos = useRef(new Set<string>())

  useEffect(() => {
    return onSnapshot(collection(db, 'contatos'), (snap) => {
      const m: Record<string, Contato> = {}
      snap.docs.forEach((d) => (m[d.id] = d.data() as Contato))
      setContatos(m)
    })
  }, [])

  useEffect(() => {
    if (!repor) return
    return onSnapshot(collection(db, 'players'), (snap) => {
      for (const d of snap.docs) {
        const p = d.data() as Player
        const chave = `${d.id}|${p.celular}|${p.dataNascimento}|${paraMillis(p.criadoEm)}`
        if (!contatoDesatualizado(contatos[d.id], p) || repostos.current.has(chave)) continue
        repostos.current.add(chave)
        setDoc(doc(db, 'contatos', d.id), { ...contatoDoCadastro(p), atualizadoEm: serverTimestamp() }).catch(() => {})
      }
    })
  }, [repor, contatos])

  return contatos
}
