#!/usr/bin/env node
// scripts/contexto-push-guard.cjs — bridge del guardarraíl de pérdida de contexto (T-428).
// Lo invoca `.husky/pre-push`. Reúne los inputs de git, llama a la lógica PURA de
// `lib/backlog/perdidaDeContexto.cjs` y decide si el push sigue. La regla vive en ese fichero.
//
// ── QUÉ BLOQUEA ─────────────────────────────────────────────────────────────────────────────
// Que tu push borre de `docs/roadmap/tareas-pendientes.md` el cuerpo de una ficha VIVA que ya
// estaba publicada. Es el modo de fallo del 31/07: dos sesiones tocan el mismo fichero, una
// resuelve el conflicto quedándose con «su» lado, y el trabajo de documentar de la otra se va sin
// que nada lo vea (el CI sigue verde: el id sigue existiendo).
//
// ── CONTRA QUÉ COMPARA, Y POR QUÉ ASÍ ───────────────────────────────────────────────────────
// Contra `origin/main`, no contra el padre de tus commits. La pregunta que importa no es «¿qué
// cambiaron mis commits?» sino **«¿qué se va a perder de lo ya publicado cuando esto entre?»**, y
// solo la segunda caza el caso del MERGE: si resuelves un conflicto tirando el bloque de la otra
// sesión, tus commits nunca «borraron» nada respecto de su propio padre — el contenido jamás
// estuvo en tu rama. Comparando con el padre, el incidente que motiva esta tarea pasa invisible.
//
// Comparar con `origin/main` NO puede dar falso positivo en un push que vaya a funcionar: para
// entrar en `main` tu HEAD tiene que contenerlo (fast-forward), así que todo lo que le falte
// respecto a `origin/main` lo has quitado tú. Cuando HEAD **no** contiene `origin/main` (rama
// suelta, o `origin/main` por delante) esa garantía se cae y el guard NO opina: lo dice y deja
// pasar. Un guardarraíl que acusa cuando no puede saberlo se acaba apagando entero — y entonces
// deja de proteger también en los casos en los que sí sabía.
//
// Fail-open ante infra (sin git, sin `origin/main`, fichero ausente).
// Escape PROPIO a propósito: si compartiera el de otro guard, apagar uno apagaría dos.
//
// ── EL ESCAPE PIDE MOTIVO, COMO SUS DOS HERMANOS (T-704, 08/08) ────────────────────────────
//   CONTEXTO_GUARD_SKIP="por qué te lo saltas" git push …
// Nació aceptando un `=1` y se quedó atrás cuando T-496/T-497 se lo quitaron a `backlog-push` y
// a `indice-compartido`. El efecto está medido: en 7 días, **25 escapes sin UN SOLO motivo
// escrito**, y 8 de ellos en 60 segundos — o sea, la variable se copiaba de un comando a otro.
// Un escape que se satisface con un «1» deja de ser una decisión y pasa a ser un prefijo.
// El criterio de qué vale como motivo NO se reescribe aquí: es `evaluarEscape`, el mismo que
// usan los otros dos. Tres criterios para lo mismo acabarían divergiendo.

const path = require('path')
const { execFileSync, spawn } = require('child_process')
const { findPerdidaDeContexto, bloqueantes } = require('../lib/backlog/perdidaDeContexto.cjs')
const { evaluarEscape } = require('../lib/observability/friccionSesiones.cjs')

// El repo es el de este script. `CONTEXTO_GUARD_REPO` existe SOLO para la simulación de
// `scripts/backlog/sim-contexto-guard.cjs`, que monta un repo de pruebas y reproduce el incidente
// real: sin esa costura habría que probar el bridge contra el repo de verdad, o no probarlo — y un
// guardarraíl que bloquea a TODAS las sesiones no puede estrenarse sin haberlo visto bloquear.
const REPO = process.env.CONTEXTO_GUARD_REPO || path.join(__dirname, '..')
const FICHERO = 'docs/roadmap/tareas-pendientes.md'

/** Registrar el roce sin bloquear NUNCA: detached y sin esperar (T-423). */
function friccion(clase, detalle, evitoBloqueo) {
  try {
    const a = ['--clase', clase, '--guard', 'contexto-backlog']
    if (detalle) a.push('--detalle', String(detalle).slice(0, 200))
    // Tri-estado: sin bandera = «no sé contestarlo», que no es lo mismo que «no evitó nada» (T-702).
    if (evitoBloqueo === true) a.push('--evito-bloqueo')
    else if (evitoBloqueo === false) a.push('--sin-nada-que-rodear')
    spawn(process.execPath, [path.join(REPO, 'scripts', 'friccion-emitir.cjs'), ...a],
      { detached: true, stdio: 'ignore' }).unref()
  } catch { /* la telemetría nunca estorba a un push */ }
}

function git(args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 }) } catch { return null }
}

function main() {
  const escape = evaluarEscape(process.env.CONTEXTO_GUARD_SKIP)
  if (escape.usa && !escape.permitido) {
    // Que el valor no valga NO añade un bloqueo: sigue adelante y se evalúa como si no lo hubieras
    // puesto. Si no había nada que borrar, el push pasa igual — solo deja de ser llave maestra.
    console.log(`⚠️  contexto-push-guard: ${escape.problema}`)
    console.log('     CONTEXTO_GUARD_SKIP="por qué te lo saltas" git push …')
  }

  // Cortocircuito: si el push no toca el fichero, no se paga peaje.
  const tocados = git(['diff', '--name-only', 'origin/main...HEAD'])
  if (tocados !== null && !tocados.split('\n').some((l) => l.trim() === FICHERO)) return 0

  // Sin esta garantía no se puede afirmar que lo que falta lo has quitado tú (ver cabecera).
  if (git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD']) === null) {
    console.log('ℹ️  contexto-push-guard: HEAD no contiene origin/main (rama suelta o desactualizada) — no puedo atribuir la pérdida. No opino.')
    return 0
  }

  const publicado = git(['show', `origin/main:${FICHERO}`])
  const propuesto = git(['show', `HEAD:${FICHERO}`])
  if (!publicado || !propuesto) {
    console.log('⚠️  contexto-push-guard: no pude leer las dos versiones del fichero. Push permitido (fail-open).')
    return 0
  }

  const { hallazgos } = findPerdidaDeContexto(publicado, propuesto)
  // Los `info` se imprimen SIEMPRE aunque no bloqueen: una excepción silenciosa es una excepción
  // que nadie revisa (mismo criterio que el guard de claims).
  for (const h of hallazgos.filter((x) => x.severidad === 'info')) {
    console.log(`ℹ️  contexto-push-guard: ${h.id} — ${h.motivo}`)
  }

  const malos = bloqueantes(hallazgos)

  // El escape se resuelve AQUÍ y no arriba (T-702/T-704): saliendo antes de evaluar, el guard no
  // podía decir si había algo que rodear, y el panel tenía que deducirlo restando bloqueos — con
  // 0 bloqueos eso da «rodeado el 100%» por aritmética y prescribe borrar la puerta. Ahora se
  // mide: `evitoBloqueo` responde si el escape servía para algo o se puso de prefijo.
  if (escape.permitido) {
    console.log(`⏭️  contexto-push-guard saltado: ${escape.motivo}`)
    if (malos.length) {
      console.log(`     (te saltas ${malos.length} ficha(s) que este guard habría protegido: ${malos.map((h) => h.id).join(', ')})`)
    }
    friccion('guard_escape', escape.motivo, malos.length > 0)
    return 0
  }

  if (!malos.length) return 0

  console.error('\n❌ PUSH BLOQUEADO — tu push borra contexto de fichas VIVAS que ya están publicadas:\n')
  for (const h of malos) {
    const detalle = h.tipo === 'desaparecida'
      ? `la ficha entera ya no está (${h.charsAntes} caracteres)`
      : `pierde ${Math.round(h.ratio * 100)}% del cuerpo (${h.charsAntes} → ${h.charsDespues} caracteres)`
    console.error(`   · ${h.id}: ${detalle}`)
  }
  friccion('guard_bloqueo', malos.map((h) => h.id).join(','))
  console.error('\n   Casi seguro es una resolución de conflicto que se quedó con UN solo lado.')
  console.error(`   Míralo con:  git diff origin/main -- ${FICHERO}`)
  console.error('   Al resolver este fichero se conservan SIEMPRE los dos lados: son fichas distintas.')
  console.error('   Si el borrado es a propósito (renumerar, la entrada no era una tarea):')
  console.error('     CONTEXTO_GUARD_SKIP="por qué lo borras a propósito" git push …\n')
  return 1
}

try {
  process.exit(main())
} catch (e) {
  // Bug del propio guard: fail-open (no romper el push por un fallo del hook).
  console.log(`⚠️  contexto-push-guard error inesperado (${e.message}). Push permitido (fail-open).`)
  process.exit(0)
}
