#!/usr/bin/env node
// scripts/flota/canario-oom.cjs — ¿sigue viva la detección de OOM de la flota? (T-647)
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────────
// La capa 4 de [T-647] publica `flota_sin_memoria` cuando el kernel mata un proceso por falta de
// memoria. Ese detector tiene el problema de todos los detectores que solo hablan cuando pasa
// algo malo: **mientras la máquina va bien, «funciona» y «está roto» se ven exactamente igual**
// — cero eventos en los dos casos. Es el mismo agujero que costó [T-712] (una sonda que llevaba
// 439 pasadas sin medir nada y nadie lo notó) y el que ya midió [T-529].
//
// Aquí no basta con afirmar el verde, porque el verde correcto ES la ausencia de muertes. Lo que
// se puede hacer es **provocar una muerte de mentira** y comprobar que el aviso llega.
//
// ── POR QUÉ ES SEGURO ───────────────────────────────────────────────────────────────────────
// El OOM se provoca DENTRO de un cgroup transitorio propio (`systemd-run --scope` con
// `MemoryMax` diminuto y sin swap), así que el kernel elige víctima ahí dentro: muere el proceso
// de usar y tirar y nadie más. No toca a los trabajadores ni al supervisor. Verificado el 08/08:
// murió el `tail` del canario, los cuatro turnos siguieron.
//
// ── QUÉ COMPRUEBA, DE VERDAD ────────────────────────────────────────────────────────────────
// La cadena ENTERA, no una parte: kernel → journal → el usuario `flota` puede leerlo →
// el supervisor lo ve en su pasada → INSERT en `observable_events`. Cualquier eslabón roto
// (permisos de journal, supervisor parado, clon viejo, credencial caducada) sale aquí.
//
//   node scripts/flota/canario-oom.cjs            # provoca y espera el evento
//   node scripts/flota/canario-oom.cjs --solo-mirar   # no provoca nada: solo dice qué se ve
//
// Salida 0 = la cadena funciona · 1 = no llegó el aviso · 2 = no se pudo ejecutar.
const { execFileSync } = require('child_process')
const path = require('path')
const postgres = require('postgres')

const REPO = path.resolve(__dirname, '..', '..')
require('dotenv').config({ path: path.join(REPO, '.env.local') })

const MAQ = require('../../lib/flota/maquinas.cjs')

const SOLO_MIRAR = process.argv.includes('--solo-mirar')
// Dos pasadas del supervisor con margen: la ventana que mira es `pausa/60 + 1` minutos.
const ESPERA_MAX_MS = 12 * 60 * 1000

/** Ejecuta en la máquina de la flota, por ssh o en local según desde dónde se llame. */
function enFlota(orden) {
  const m = MAQ.maquinaDe('w1')
  if (!m) throw new Error('w1 no está declarado en lib/flota/maquinas.cjs')
  if (m.local) return execFileSync('bash', ['-c', orden], { encoding: 'utf8', timeout: 120_000 })
  const noLlego = MAQ.inalcanzable(m)
  if (noLlego) throw new Error(noLlego)
  return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=15', '-i', m.llave, `${m.usuario}@${m.host}`, orden],
  { encoding: 'utf8', timeout: 120_000 })
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

async function ultimoEvento() {
  const r = await sql`
    SELECT created_at, error_message, metadata->>'via' AS via
      FROM observable_events
     WHERE event_type = 'flota_sin_memoria'
     ORDER BY created_at DESC LIMIT 1`
  return r[0] || null
}

;(async () => {
  const previo = await ultimoEvento()
  console.log(`Último \`flota_sin_memoria\` antes de empezar: ${
    previo ? previo.created_at.toISOString() : '(ninguno en toda la historia)'}`)

  if (SOLO_MIRAR) {
    const oom = enFlota(`journalctl -k --since '-24h' --no-pager 2>/dev/null | grep -ci 'killed process' || true`).trim()
    console.log(`Muertes por OOM en el diario del kernel (24 h): ${oom}`)
    console.log('(--solo-mirar: no se ha provocado nada)')
    await sql.end()
    return
  }

  console.log('\nProvocando un OOM AISLADO en la máquina de la flota…')
  // `MemorySwapMax=0` para que no se salve por swap si algún día se añade. El proceso reserva
  // mucho más de lo que su cgroup permite, así que muere él y solo él.
  const salida = enFlota(
    `systemd-run --scope -q -p MemoryMax=40M -p MemorySwapMax=0 --unit=canario-oom-flota `
    + `bash -c 'head -c 300M /dev/zero | tail -c 300M > /dev/null' 2>&1 | tail -1 || true; `
    + `sleep 2; journalctl -k --since '-2min' --no-pager 2>/dev/null | grep -i 'killed process' | tail -1`)
  if (!/killed process/i.test(salida)) {
    console.error('❌ el kernel no registró ninguna muerte: el canario no ha podido provocar el OOM')
    console.error(`   salida: ${salida.trim().slice(0, 200)}`)
    await sql.end()
    process.exit(2)
  }
  console.log(`✅ el kernel lo registró: ${salida.trim().slice(0, 120)}`)

  console.log('\nEsperando a que el supervisor lo publique (una pasada, hasta 12 min)…')
  const inicio = Date.now()
  for (;;) {
    const ahora = await ultimoEvento()
    const esNuevo = ahora && (!previo || ahora.created_at > previo.created_at)
    if (esNuevo) {
      console.log(`\n✅ CADENA COMPLETA. Evento publicado a las ${ahora.created_at.toISOString()} `
        + `(vía ${ahora.via || 'journalctl'}): ${ahora.error_message}`)
      await sql.end()
      return
    }
    if (Date.now() - inicio > ESPERA_MAX_MS) {
      console.error('\n❌ el kernel mató el proceso y el supervisor NO lo publicó en 12 min.')
      console.error('   La detección de OOM está CIEGA. Mirar, en este orden:')
      console.error('     1. ¿corre el supervisor?  systemctl is-active vence-flota-supervisor')
      console.error('     2. ¿ve el diario el usuario `flota`?  sudo -u flota journalctl --since -10min | grep -c "Killed process"')
      console.error('        (si da 0, falta:  usermod -aG systemd-journal flota)')
      console.error('     3. ¿está su clon al día?  cd ~flota/vence && git log --oneline -1')
      await sql.end()
      process.exit(1)
    }
    await new Promise((r) => setTimeout(r, 20_000))
  }
})().catch((e) => {
  console.error(`❌ no se pudo ejecutar el canario: ${e.message}`)
  process.exit(2)
})
