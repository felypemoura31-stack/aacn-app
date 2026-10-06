import { useEffect, useState } from 'react'

/** Avisa quando o aparelho está sem internet (a carteirinha continua abrindo com os dados salvos). */
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const off = () => setOffline(true)
    const on = () => setOffline(false)
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
    }
  }, [])

  if (!offline) return null
  return (
    <div className="no-print bg-warn/15 px-3 py-1 text-center text-xs text-warn">
      Sem conexão. Você está vendo os dados salvos neste aparelho; alterações serão enviadas quando a internet voltar.
    </div>
  )
}
