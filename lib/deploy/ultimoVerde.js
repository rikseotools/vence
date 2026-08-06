// lib/deploy/ultimoVerde.js — QUÉ commit desplegar cuando la punta de `main` no tiene veredicto.
// Decisión PURA: entran los commits de main (del más nuevo al más viejo) ya clasificados por
// `ciGate.clasificarCiCodigo`, y sale qué hacer. Sin red, sin git.
//
// ## Por qué existe ([T-619], 06/08/2026)
//
// `deploy-cuando-verde.sh` preguntaba SOLO por la punta de `origin/main`. Con 2-10 sesiones y la
// flota pusheando, la punta casi nunca tiene veredicto: medido ese día, **40 commits en `main`,
// hueco MEDIANO entre pushes de 2 minutos, 35 de 39 huecos por debajo de 15**. Y el mecanismo no
// es el que parece: `test.yml` no cancela el run EN CURSO en un push a `main`
// (`cancel-in-progress` solo vale en pull_request), pero GitHub guarda **un único run PENDIENTE
// por grupo de concurrencia**, así que al llegar el tercero **cancela al que esperaba**. Resultado
// medido: `cancelled, cancelled, cancelled, queued` y CERO SHAs con checks completados.
//
// El lanzador además **resincronizaba a la punta en cada vuelta**, o sea que perseguía un blanco
// móvil: agotaba sus 12 vueltas sin desplegar nada. Y lo caro no es que no despliegue, es que **no
// da error**: el trabajo se queda «hecho pero sin verificar» y no se entera nadie. Ese día había 6
// tareas esperando frontend y 3 backend, y la ficha de [T-448] ya llevaba el síntoma sin
// diagnosticar desde por la mañana.
//
// ## El criterio, y por qué NO es un apaño
//
// Desplegar **el ancestro más reciente que SÍ tiene su CI en verde** es lo que hace cualquier
// entrega continua: se despliega el artefacto que pasó su pipeline, no «lo que hubiera en HEAD al
// mirar». Y aquí encaja especialmente porque **el deploy es CUMULATIVO**: sube todo lo que hay
// hasta ese commit. Exigir la punta no añade ninguna garantía —los commits de detrás también van—
// y a cambio vuelve el gate inalcanzable por construcción cuando el ritmo de push supera al CI.
//
// Lo que sí sería un apaño, y por eso no se hace: saltarse el gate (desplegar sin CI), o bajar el
// listón de qué cuenta como verde.
//
// ## Invariantes
//
// 1. **Nunca hacia atrás.** Si el verde elegido ya está contenido en lo vivo, no se despliega.
// 2. **Un rojo NO detiene la búsqueda, pero se canta.** Si alguien rompió la punta, desplegar el
//    último verificado es lo correcto; callarlo, no.
// 3. **Lo que se queda fuera se NOMBRA.** Un deploy que sube «casi todo» sin decir qué deja detrás
//    es el mismo fallo silencioso que esto viene a arreglar.
// 4. **«No lo sé» no es «adelante».** Sin ningún veredicto utilizable se espera; solo se aborta
//    cuando consta que todo lo mirado está rojo.

/** Estados que `ciGate.clasificarCiCodigo` puede devolver y que aquí significan «aún puede verdear». */
const PENDIENTES = ['curso', 'faltan', 'cancelado']

/**
 * @param {object} p
 * @param {Array<{sha:string, estado:string}>} p.candidatos  commits de main, del MÁS NUEVO al más viejo
 * @param {(sha:string)=>boolean} [p.yaVivo]  ¿lo desplegado ya contiene este sha? (por defecto: no)
 * @returns {{accion:'desplegar'|'esperar'|'abortar'|'nada', sha?:string, dejaFuera:string[],
 *            rotos:string[], motivo:string}}
 */
function elegirCommitDesplegable({ candidatos, yaVivo } = {}) {
  const lista = Array.isArray(candidatos) ? candidatos.filter((c) => c && c.sha) : []
  const contenido = typeof yaVivo === 'function' ? yaVivo : () => false

  if (!lista.length) {
    return { accion: 'esperar', dejaFuera: [], rotos: [], motivo: 'no hay ningún commit que mirar' }
  }

  const dejaFuera = []
  const rotos = []
  let hayPendientes = false

  for (const c of lista) {
    if (c.estado === 'verde') {
      if (contenido(c.sha)) {
        return {
          accion: 'nada',
          sha: c.sha,
          dejaFuera,
          rotos,
          motivo: `el último commit verde (${corto(c.sha)}) ya está desplegado; lo de delante todavía no tiene veredicto`,
        }
      }
      return {
        accion: 'desplegar',
        sha: c.sha,
        dejaFuera,
        rotos,
        motivo: dejaFuera.length
          ? `desplegando el último verde ${corto(c.sha)}; quedan ${dejaFuera.length} commit(s) más nuevos sin veredicto`
          : `la punta ${corto(c.sha)} está verde`,
      }
    }
    // No es verde: se queda fuera de este deploy, y decimos por qué.
    dejaFuera.push(c.sha)
    if (c.estado === 'rojo') rotos.push(c.sha)
    else if (PENDIENTES.includes(c.estado)) hayPendientes = true
  }

  if (hayPendientes) {
    return {
      accion: 'esperar',
      dejaFuera,
      rotos,
      motivo: `ninguno de los ${lista.length} commits mirados está verde todavía; hay CI sin terminar`,
    }
  }
  return {
    accion: 'abortar',
    dejaFuera,
    rotos,
    motivo: `los ${lista.length} commits mirados tienen el CI en ROJO — alguien rompió main y no hay nada verificado que desplegar`,
  }
}

/**
 * ¿Merece la pena avisar de que este deploy no ha podido salir?
 *
 * Un `esperar` suelto es normal (el CI tarda). Lo que NO es normal es agotar las vueltas sin
 * desplegar: eso es exactamente el fallo silencioso de [T-619]. Se separa del criterio de arriba
 * porque una cosa es el veredicto y otra la política de alarma.
 */
function debeAlertar({ accion, vueltasAgotadas } = {}) {
  if (accion === 'abortar') return { alertar: true, severidad: 'error' }
  if (vueltasAgotadas && accion !== 'desplegar' && accion !== 'nada') {
    return { alertar: true, severidad: 'error' }
  }
  return { alertar: false, severidad: 'info' }
}

function corto(sha) {
  return String(sha || '').slice(0, 9)
}

module.exports = { elegirCommitDesplegable, debeAlertar, PENDIENTES }
