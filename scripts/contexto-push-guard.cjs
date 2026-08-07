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
// Fail-open ante infra (sin git, sin `origin/main`, fichero ausente). Escape: CONTEXTO_GUARD_SKIP=1.
// Escape PROPIO a propósito: si compartiera el de otro guard, apagar uno apagaría dos.

const path = require('path')
const { execFileSync, spawn } = require('child_process')
const { findPerdidaDeContexto, bloqueantes } = require('../lib/backlog/perdidaDeContexto.cjs')

// El repo es el de este script. `CONTEXTO_GUARD_REPO` existe SOLO para la simulación de
// `scripts/backlog/sim-contexto-guard.cjs`, que monta un repo de pruebas y reproduce el incidente
// real: sin esa costura habría que probar el bridge contra el repo de verdad, o no probarlo — y un
// guardarraíl que bloquea a TODAS las sesiones no puede estrenarse sin haberlo visto bloquear.
const REPO = process.env.CONTEXTO_GUARD_REPO || path.join(__dirname, '..')
const FICHERO = 'docs/roadmap/tareas-pendientes.md'

/** Registrar el roce sin bloquear NUNCA: detached y sin esperar (T-423). */
function friccion(clase, detalle) {
  try {
    const a = ['--clase', clase, '--guard', 'contexto-backlog']
    if (detalle) a.push('--detalle', String(detalle).slice(0, 200))
    spawn(process.execPath, [path.join(REPO, 'scripts', 'friccion-emitir.cjs'), ...a],
      { detached: true, stdio: 'ignore' }).unref()
  } catch { /* la telemetría nunca estorba a un push */ }
}

function git(args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 }) } catch { return null }
}

const DIR_FICHAS = 'docs/roadmap/tareas'

/**
 * T-532: cada ficha vive en su propio fichero (`docs/roadmap/tareas/T-nnn.md`). Un `git diff
 * --stat` ya deja VISIBLE que un fichero desapareció o se vació — la razón de ser original de
 * este guardarraíl (una pérdida escondida entre miles de líneas ajenas) deja de existir por
 * construcción. Lo que SIGUE haciendo falta es que el push se PARE, no solo que sea visible: la
 * misma lógica pura de `perdidaDeContexto.cjs` (el suelo de caracteres, la exención al cerrar)
 * se reutiliza SIN TOCARLA, comparando las dos versiones del fichero de CADA ficha que cambió —
 * un fichero de una sola ficha es, para `findPerdidaDeContexto`, un markdown con una entrada.
 */
function hallazgosDeFicheros() {
  const tocados = git(['diff', '--name-only', 'origin/main...HEAD', '--', DIR_FICHAS])
  if (tocados === null) return { ok: false, hallazgos: [] }
  const rutas = tocados.split('\n').map((l) => l.trim()).filter((l) => /^docs\/roadmap\/tareas\/T-\d+\.md$/.test(l))
  const hallazgos = []
  for (const ruta of rutas) {
    // `git show` de un blob que ya no existe en esa ref falla → gitOut-style: se trata como ''
    // (fichero nuevo o borrado), que es exactamente lo que findPerdidaDeContexto espera para
    // detectar «desaparecida».
    const antes = git(['show', `origin/main:${ruta}`]) ?? ''
    const despues = git(['show', `HEAD:${ruta}`]) ?? ''
    if (!antes) continue // fichero NUEVO: nada que perder
    const { hallazgos: h } = findPerdidaDeContexto(antes, despues)
    hallazgos.push(...h)
  }
  return { ok: true, hallazgos }
}

function main() {
  if (process.env.CONTEXTO_GUARD_SKIP === '1') {
    console.log('⏭️  contexto-push-guard saltado (CONTEXTO_GUARD_SKIP=1)')
    friccion('guard_escape')
    return 0
  }

  // Cortocircuito: si el push no toca ni el índice ni un fichero de ficha, no se paga peaje.
  const tocados = git(['diff', '--name-only', 'origin/main...HEAD'])
  const tocaAlgoRelevante = tocados !== null && tocados.split('\n').some((l) => {
    const t = l.trim()
    return t === FICHERO || t.startsWith(`${DIR_FICHAS}/`)
  })
  if (tocados !== null && !tocaAlgoRelevante) return 0

  // Sin esta garantía no se puede afirmar que lo que falta lo has quitado tú (ver cabecera).
  if (git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD']) === null) {
    console.log('ℹ️  contexto-push-guard: HEAD no contiene origin/main (rama suelta o desactualizada) — no puedo atribuir la pérdida. No opino.')
    return 0
  }

  let hallazgos = []

  // Protección PRINCIPAL (T-532): un fichero por ficha.
  const porFicheros = hallazgosDeFicheros()
  if (porFicheros.ok) hallazgos.push(...porFicheros.hallazgos)

  // Protección LEGACY: el índice generado. Cada vez menos probable que dispare (ya no se edita a
  // mano en el flujo normal), pero seguir mirándolo cuesta una llamada a git y cubre a quien
  // edite `tareas-pendientes.md` directamente por costumbre en vez de su ficha.
  const publicado = git(['show', `origin/main:${FICHERO}`])
  const propuesto = git(['show', `HEAD:${FICHERO}`])
  if (publicado && propuesto) {
    hallazgos.push(...findPerdidaDeContexto(publicado, propuesto).hallazgos)
  }

  // Los `info` se imprimen SIEMPRE aunque no bloqueen: una excepción silenciosa es una excepción
  // que nadie revisa (mismo criterio que el guard de claims).
  for (const h of hallazgos.filter((x) => x.severidad === 'info')) {
    console.log(`ℹ️  contexto-push-guard: ${h.id} — ${h.motivo}`)
  }

  const malos = bloqueantes(hallazgos)
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
  console.error(`   Míralo con:  git diff origin/main -- ${DIR_FICHAS}/<T-nnn>.md`)
  console.error('   Con una ficha por fichero, un conflicto real solo puede pasar si DOS sesiones tocaron')
  console.error('   la MISMA ficha — conserva los dos cambios, no elijas «tu lado».')
  console.error('   Si el borrado es a propósito (renumerar, la entrada no era una tarea):')
  console.error('     CONTEXTO_GUARD_SKIP=1 git push …\n')
  return 1
}

try {
  process.exit(main())
} catch (e) {
  // Bug del propio guard: fail-open (no romper el push por un fallo del hook).
  console.log(`⚠️  contexto-push-guard error inesperado (${e.message}). Push permitido (fail-open).`)
  process.exit(0)
}
