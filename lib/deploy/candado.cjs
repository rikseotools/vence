// lib/deploy/candado.cjs — el candado de deploy que SÍ cruza máquinas. (T-485)
//
// ── EL HUECO ────────────────────────────────────────────────────────────────────────────────
// La exclusión mutua real la daba `flock` sobre `/tmp/vence-deploy.lock`, y un fichero en `/tmp`
// es PER-MÁQUINA: dos deploys lanzados desde máquinas distintas no se ven. Lo que se rompe si se
// solapan es el incidente del 24/07 ([T-075]): dos `update-service` de ECS sobre el mismo
// servicio.
//
// ── LO QUE YA ESTABA, Y POR QUÉ NO BASTABA ──────────────────────────────────────────────────
// `lib/deploy/estado.cjs` YA detecta el deploy de otra máquina: `procesoVivo` devuelve `null`
// cuando `host !== hostActual`, así que `veredicto()` lo clasifica `en_curso` (si es reciente) o
// `sospechoso` (pasados los minutos). O sea que el sistema **ya sabía**. Lo que faltaba es que
// eso BLOQUEARA — su propio comentario lo admite: «un `dudoso` no bloquea a nadie».
//
// Por eso este módulo NO trae criterio propio sobre qué runs cuentan: se lo pregunta a
// `veredicto()`. Dos puertas al mismo recurso con criterios distintos no protegen, se
// contradicen ([T-130], [T-375]).
//
// ── LEASE, NO LOCK ──────────────────────────────────────────────────────────────────────────
// Mismo patrón que `backlog_tasks`: arriendo con caducidad + renovación. Un lock eterno en una
// tabla es peor que ninguno — si el deploy muere, nadie vuelve a desplegar jamás y la salida es
// borrar filas a mano, que es como se aprende a no usar el candado.
//
// El `flock` SE QUEDA como segunda puerta local: es más barato y cubre el caso normal (varias
// sesiones en el mismo portátil). Defensa en profundidad, no sustitución.

const { veredicto } = require('./estado.cjs')

/**
 * Cuánto dura el arriendo y cada cuánto se renueva.
 *
 * El TTL **no** se dimensiona por lo que tarda un deploy (un build de frontend pasó de 30 min el
 * 28/07, por eso `DEPLOY_LOCK_WAIT` son 45) sino por **cuánto se tolera esperar si el proceso
 * muere sin soltar**. Con renovación, la duración del deploy da igual: mientras viva, renueva.
 * 10 minutos es el compromiso — bastante corto para no dejar la infraestructura bloqueada media
 * hora por un `kill -9`, y bastante largo para aguantar una pausa de red o un `git fetch` lento
 * sin perder el arriendo a mitad de deploy.
 */
const TTL_MINUTOS = 10
const RENOVAR_CADA_SEG = 120

/**
 * ¿Se puede adquirir el candado, vistos los runs abiertos?
 *
 * PURA: recibe las filas y devuelve la decisión, sin tocar BD ni reloj del sistema. El SQL de
 * abajo es su espejo atómico (ver `sqlCandadoLibre`), y el guardarraíl comprueba que los dos
 * hablan de lo mismo.
 *
 * @param runsAbiertos  filas de `deploy_runs` con `finished_at IS NULL` y **lease vivo**
 * @param opts          {ahora, hostActual, matar} — se pasan tal cual a `veredicto`
 * @returns {{libre: boolean, motivo: string|null, quien: object|null}}
 */
function puedeAdquirir(runsAbiertos, opts = {}) {
  const v = veredicto(runsAbiertos, opts)
  if (v.estado === 'libre') return { libre: true, motivo: null, quien: null }
  // `dudoso` también BLOQUEA, y esa es la diferencia con el modelo anterior. Un deploy que no se
  // puede descartar es exactamente el caso de otra máquina, que es el que esto viene a cerrar:
  // tratarlo como «adelante» sería devolver el hueco por la puerta de atrás.
  const c = (v.enCurso[0] || v.sospechosos[0])
  return {
    libre: false,
    motivo: v.resumen,
    quien: c ? { surface: c.run.surface, host: c.run.host, sid: c.run.sid, minutos: c.minutos, estado: c.estado } : null,
  }
}

/**
 * El MISMO criterio como fragmento SQL, para que la adquisición sea ATÓMICA.
 *
 * No es una copia por capricho: la decisión tiene que tomarse **dentro** del INSERT, o dos
 * máquinas que lean «libre» a la vez se lo llevarían las dos — que es justo lo que este candado
 * existe para impedir. La versión JS es la que se puede testear y explicar; ésta es la que se
 * ejecuta.
 *
 * Nótese que aquí NO se replica la clasificación de `estado.cjs`: el SQL solo filtra por «lease
 * vivo», que es un hecho de la tabla. El juicio sobre procesos y antigüedad se queda en el núcleo
 * puro, y lo usa quien informa. Así no hay dos criterios: hay un hecho y un juicio.
 */
function sqlCandadoLibre() {
  return `NOT EXISTS (
            SELECT 1 FROM public.deploy_runs d
             WHERE d.finished_at IS NULL
               AND d.lease_until IS NOT NULL
               AND d.lease_until > now())`
}

/** Lo que se le imprime a quien se queda fuera: quién lo tiene y qué hacer. */
function mensajeOcupado(v) {
  const q = v.quien || {}
  return [
    '',
    '⛔ HAY UN DEPLOY EN CURSO EN OTRA MÁQUINA. No se puede desplegar a la vez.',
    '',
    `   ${v.motivo}`,
    q.host ? `   lo tiene: ${q.surface || '?'} en ${q.host} (sesión ${String(q.sid || '?').slice(0, 12)}, ${q.minutos} min)` : '',
    '',
    '   Dos `update-service` solapados sobre el mismo servicio de ECS es el incidente del',
    '   24/07 ([T-075]). Por eso esto no es un aviso.',
    '',
    `   El arriendo caduca solo a los ${TTL_MINUTOS} min sin renovar, así que si esa máquina murió,`,
    '   reintenta en un rato. Para esperar y reintentar sin estar delante:',
    '     scripts/deploy-cuando-verde.sh <frontend|backend|both>',
    '',
  ].filter((l) => l !== '').join('\n')
}

module.exports = { TTL_MINUTOS, RENOVAR_CADA_SEG, puedeAdquirir, sqlCandadoLibre, mensajeOcupado }
