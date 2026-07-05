// docker/server-keepalive.cjs
//
// Arranca el server standalone de Next.js (server.js) pero forzando
// keepAliveTimeout > idle_timeout del ALB (60s).
//
// POR QUÉ: Node cierra las conexiones keep-alive ociosas a los 5s (default).
// El ALB las mantiene hasta 60s y REUTILIZA una que Node ya cerró → 502 Bad
// Gateway (intermitente, peor en endpoints muy polleados como /api/auth/token).
// Fix estándar AWS: server.keepAliveTimeout > ALB idle, y headersTimeout mayor aún.
// Ver docs/runbooks/deploy.md (§502 keep-alive).
'use strict'

const http = require('http')
const origCreateServer = http.createServer.bind(http)
http.createServer = function patchedCreateServer(...args) {
  const server = origCreateServer(...args)
  server.keepAliveTimeout = 65_000 // > 60s (ALB idle_timeout)
  server.headersTimeout = 66_000 // debe ser > keepAliveTimeout
  return server
}

// Entry generado por Next.js output:'standalone'
require('./server.js')
