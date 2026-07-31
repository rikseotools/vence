// scripts/sim/stubs/server-only-shim.cjs
//
// `server-only` es un paquete que EXISTE para reventar si lo importa algo que no sea
// el runtime de servidor de Next. Una simulación corre en Node pelado, así que al
// ejercer un módulo `.server.ts` de verdad choca con esa guarda.
//
// El shim la neutraliza SOLO dentro del proceso de la simulación. No toca el paquete
// ni el bundle: en la app la guarda sigue intacta, que es su razón de ser.
//
//   NODE_OPTIONS="--require ./scripts/sim/stubs/server-only-shim.cjs" npx tsx …
const Module = require('module')
const cargarOriginal = Module._load
Module._load = function (peticion, ...resto) {
  if (peticion === 'server-only') return {}
  return cargarOriginal.call(this, peticion, ...resto)
}
