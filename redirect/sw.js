// Endereço antigo (aacn-app.web.app): o app mudou para aacn.web.app.
// Quem instalou o app por aqui tem um service worker antigo que não consegue mais se atualizar
// (o /sw.js redirecionava). Este arquivo o substitui: limpa os caches, se desinstala e recarrega as
// abas abertas, que então são redirecionadas para o endereço novo.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const chaves = await caches.keys()
      await Promise.all(chaves.map((k) => caches.delete(k)))
      await self.clients.claim()
      await self.registration.unregister()
      const abas = await self.clients.matchAll({ type: 'window' })
      abas.forEach((aba) => aba.navigate(aba.url).catch(() => {}))
    })(),
  )
})
