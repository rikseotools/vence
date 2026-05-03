// Service Worker — NO-OP (sistema push notifications eliminado 2026-05-03).
//
// Este archivo NO debe ser registrado por código nuevo. Existe únicamente
// para que los navegadores que YA tienen el SW antiguo cacheado lo
// desregistren automáticamente en su próxima visita.
//
// Tras 2-3 semanas de mantener este archivo desplegado, todos los browsers
// activos lo habrán desregistrado y se podrá borrar /public/sw.js
// completamente.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Borrar cualquier cache que dejara el SW antiguo
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((name) => caches.delete(name)))
      // Desregistrar este SW
      await self.registration.unregister()
      // Recargar todos los clients para que dejen de usar este SW
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) {
        client.navigate(client.url)
      }
    })(),
  )
})
