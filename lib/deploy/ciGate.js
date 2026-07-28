// lib/deploy/ciGate.js — ¿puede desplegarse este commit? Decisión PURA sobre los check-runs de
// GitHub Actions. Sin red, sin git: entra la respuesta de la API y sale un veredicto.
//
// ## Por qué existe (28/07/2026)
//
// El criterio vivía SOLO dentro de `scripts/deploy-{backend,frontend}.sh`, en bash+jq. Eso tenía
// dos consecuencias: no se podía probar (un error se descubre desplegando) y cualquier herramienta
// que quisiera "esperar a que el CI verdee" tenía que **reimplementarlo**, que es justo el silo que
// este repo persigue. `scripts/deploy-cuando-verde.sh` usa este módulo; los scripts de deploy
// conservan su copia en jq (no se reescriben a la ligera: acababan de arreglarse) y la paridad la
// vigila `__tests__/guardrails/ciGateParidad.test.ts`.
//
// ## Las dos distinciones que costaron deploys de verdad
//
// 1. **`cancelled` NO es `failure`.** GitHub cancela el run en curso cuando llega un push más nuevo
//    (`concurrency: cancel-in-progress`), cosa que pasa constantemente con varias sesiones. Meterlo
//    en el mismo saco que un fallo **bloqueó tres deploys el 27/07** con CERO checks rojos. Ante
//    `cancelled` lo correcto es RESINCRONIZAR al HEAD nuevo, no abortar.
// 2. **`integration` NO gatea.** Pega a la BD real y puede estar en rojo por datos de otra sesión.
//    Solo bloquean los checks de CÓDIGO: unit, typecheck y lint.
//
// El 28/07, un deploy de backend necesitó SIETE intentos y solo UNO falló por el código; el resto
// fue esta clasificación mal interpretada, contención de lock y árbol sucio.

/** Checks que BLOQUEAN el deploy. Se casan por substring sobre el nombre en minúsculas. */
const CHECKS_DE_CODIGO = ['unit', 'typecheck', 'lint']

/** Conclusiones que son un fallo REAL del código (y solo estas). */
const CONCLUSIONES_ROJAS = ['failure', 'timed_out']

/**
 * @param {Array<{name:string,status:string,conclusion:string|null}>} checkRuns  `check_runs` de la API
 * @returns {{estado:'verde'|'rojo'|'cancelado'|'curso'|'faltan', motivo:string, detalle:string[]}}
 *
 * Orden de precedencia (el mismo que el bash, y NO es arbitrario): faltan → rojo → cancelado →
 * curso → verde. `rojo` antes que `cancelado` porque un fallo real importa aunque otro check se
 * haya cancelado; `cancelado` antes que `curso` porque la acción es distinta (resincronizar vs
 * esperar).
 */
function clasificarCiCodigo(checkRuns) {
  const runs = Array.isArray(checkRuns) ? checkRuns : []
  // Igual que el jq del script: por cada check requerido, el ÚLTIMO run que casa por substring.
  const porCheck = CHECKS_DE_CODIGO.map((k) => {
    const casan = runs.filter((r) => String(r?.name || '').toLowerCase().includes(k))
    const ultimo = casan.length ? casan[casan.length - 1] : null
    return { k, status: ultimo ? ultimo.status : 'missing', conclusion: ultimo ? ultimo.conclusion : 'missing' }
  })

  const faltan = porCheck.filter((c) => c.status === 'missing')
  if (!runs.length || faltan.length) {
    return {
      estado: 'faltan',
      motivo: `faltan checks de código (${faltan.map((c) => c.k).join(', ') || 'ninguno publicado'}): ¿está el commit pusheado?`,
      detalle: faltan.map((c) => c.k),
    }
  }

  const rojos = porCheck.filter((c) => CONCLUSIONES_ROJAS.includes(c.conclusion))
  if (rojos.length) {
    return { estado: 'rojo', motivo: `${rojos.length} check(s) de código fallando`, detalle: rojos.map((c) => c.k) }
  }

  const cancelados = porCheck.filter((c) => c.conclusion === 'cancelled')
  if (cancelados.length) {
    return {
      estado: 'cancelado',
      motivo: 'llegó un push más nuevo y GitHub canceló el run — NO es un fallo de tu código: resincroniza',
      detalle: cancelados.map((c) => c.k),
    }
  }

  const enCurso = porCheck.filter((c) => c.status !== 'completed')
  if (enCurso.length) {
    return { estado: 'curso', motivo: `${enCurso.length} check(s) todavía corriendo`, detalle: enCurso.map((c) => c.k) }
  }

  return { estado: 'verde', motivo: 'unit, typecheck y lint en verde', detalle: [] }
}

/** ¿Se puede desplegar? Azúcar sobre `clasificarCiCodigo` para no repetir la comparación. */
function puedeDesplegar(checkRuns) {
  return clasificarCiCodigo(checkRuns).estado === 'verde'
}

/**
 * ¿Qué debe hacer un lanzador automático ante este estado?
 * Separado del diagnóstico a propósito: el veredicto es un hecho, la reacción es política.
 */
function accionSugerida(estado) {
  switch (estado) {
    case 'verde': return { accion: 'desplegar', reintentable: false }
    case 'curso': return { accion: 'esperar', reintentable: true }
    case 'cancelado': return { accion: 'resincronizar', reintentable: true }
    case 'faltan': return { accion: 'esperar', reintentable: true } // el CI aún no ha arrancado
    case 'rojo': return { accion: 'abortar', reintentable: false }
    default: return { accion: 'abortar', reintentable: false }
  }
}

module.exports = { clasificarCiCodigo, puedeDesplegar, accionSugerida, CHECKS_DE_CODIGO, CONCLUSIONES_ROJAS }
