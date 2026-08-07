/**
 * puerta-vivo.ts — «no le digas que está arreglado si no está EN PRODUCCIÓN». (T-678, 07/08/2026)
 *
 * ## El incidente que la motiva
 *
 * A Esther (feedback `e523eabc`) se le envió *«Las dos venían del mismo fallo y ya está corregido.
 * Actualiza la página y vuelve a probar, que no debería volver a pasarte»*. El arreglo estaba en
 * `main` y **no desplegado**: `/api/health` servía `76404f1d` y el commit del arreglo no era
 * ancestro suyo. Si ella entraba, le seguía fallando — con un correo nuestro diciendo lo contrario.
 * Manuel: *«no vuelvas a decir que está arreglado sin estar en producción y probado y simulado»*.
 *
 * ## Por qué aquí y no en otro sitio
 *
 * [T-392] ya impide **cerrar una tarea** cuyos commits tocan superficie servida y no están vivos.
 * El criterio existía; lo que no tenía puerta era el punto por donde sale un **mensaje a una
 * persona**. Esto no inventa un criterio nuevo: **reutiliza el verificador de T-392**
 * (`scripts/backlog/verificacion.cjs`: `ficherosDe`, `importadoEn`, `contenidos`) y el sha vivo de
 * `lib/deploy/shaVivo.cjs`. Dos criterios distintos sobre «¿está vivo?» se contradirían.
 *
 * ## Por qué mira los commits DE ESTE CASO y no «cualquier cosa sin desplegar»
 *
 * Medido sobre los mensajes reales de 30 días: **134 de 569 (23,6%)** afirman que algo está
 * corregido. Bloquear todos ellos cada vez que hubiera algo sin desplegar convertiría la puerta en
 * un estorbo que se rodea con el escape — y la mayoría son arreglos de **contenido** (una
 * explicación, una clave, un scope), que viven en la BD y **no necesitan deploy**: ahí decir «ya
 * está» es CIERTO. Solo el arreglo de **código** necesita estar vivo. Por eso se buscan los commits
 * que citan el id del caso: si el arreglo fue de datos, no hay ninguno y no se bloquea.
 *
 * Fail-open donde no se puede afirmar nada (sin red, sin git, rollout a medias): avisa y deja
 * pasar, igual que las otras puertas de este cierre.
 */
import path from 'path'
import { execFileSync } from 'child_process'

const RAIZ = path.join(__dirname, '..', '..', '..')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { puedeAfirmarse } = require(path.join(RAIZ, 'lib/impugnaciones/promesaDeArreglo.cjs'))
// eslint-disable-next-line @typescript-eslint/no-var-requires
const VERIF = require(path.join(RAIZ, 'scripts/backlog/verificacion.cjs'))

/** Commits de `main` que CITAN el id del caso (corto o largo). Sin filtro de menciones: aquí no
 * hay «declara vs cita» — que un commit nombre el caso ya lo vincula. */
function commitsDelCaso(idCaso: string): string[] {
  const corto = idCaso.slice(0, 8)
  try {
    const out = execFileSync(
      'git',
      ['log', 'origin/main', '--grep', corto, '-E', '-40', '--format=%H'],
      { cwd: RAIZ, encoding: 'utf8' },
    )
    return out.split('\n').map((s) => s.trim()).filter(Boolean)
  } catch {
    return []
  }
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { emitirFriccion } = require(path.join(RAIZ, 'lib/sessions/friccion.cjs'))

export interface VeredictoVivo {
  bloquea: boolean
  aviso: string | null
}

/**
 * Imprime el veredicto y devuelve si se puede seguir. Misma forma que `anunciarEmbudo` y
 * `anunciarTemario`: el roce se cuenta AQUÍ (dentro de la puerta), no en el script que la llama —
 * si no, cada consumidor nuevo se olvidaría de contarlo y el bus mediría de menos.
 */
export function anunciarVivo(
  v: VeredictoVivo,
  { igualmente }: { igualmente?: string | null } = {},
): boolean {
  if (v.aviso) console.log(`\n${v.aviso}`)
  if (!v.bloquea) return true
  if (igualmente) {
    console.log(`   ↪️  se envía igualmente: ${igualmente}`)
    try { emitirFriccion('cerrar', 'guard_escape', `vivo: ${igualmente}`) } catch { /* nunca bloquea */ }
    return true
  }
  try { emitirFriccion('cerrar', 'guard_bloqueo', 'vivo: el mensaje afirma un arreglo sin desplegar') } catch { /* idem */ }
  return false
}

/**
 * @param idCaso  id de la impugnación o del feedback
 * @param texto   el mensaje que se va a enviar
 */
export async function comprobarVivo(idCaso: string, texto: string): Promise<VeredictoVivo> {
  const commits = commitsDelCaso(idCaso)
  if (!commits.length) {
    // Ningún commit cita el caso: o fue un arreglo de datos, o no hubo arreglo. Nada que exigir.
    return { bloquea: false, aviso: null }
  }

  let vivo: string | null = null
  try {
    vivo = await VERIF.shaVivo('frontend')
  } catch {
    vivo = null
  }

  // La pregunta es POR COMMIT: ¿hay alguno SIN DESPLEGAR que ADEMÁS toque superficie servida?
  //
  // Cruzar los dos conjuntos por separado —«¿hay ficheros servidos en alguna parte?» y «¿hay algo
  // sin desplegar en alguna parte?»— da falsos positivos, y se vio en cuanto se probó en vivo: con
  // el arreglo YA desplegado, la puerta seguía bloqueando por el commit que construyó la propia
  // puerta, que nombra el caso en su mensaje y no toca nada servido. Un guardarraíl que sigue
  // gritando cuando el problema ya está resuelto se aprende a ignorar (misma lección que los
  // detectores que se calibran para no matar su badge).
  const sinDesplegar: string[] = vivo ? VERIF.noContenidos(vivo, commits) : commits
  const servidos: string[] = []
  const culpables: string[] = []
  for (const sha of sinDesplegar) {
    const suyos = VERIF.ficherosDe([sha]).filter((f: string) => (VERIF.importadoEn(f) || []).length > 0)
    if (suyos.length) {
      culpables.push(sha)
      servidos.push(...suyos)
    }
  }
  if (!culpables.length) return { bloquea: false, aviso: null }

  const pendientes = culpables
  const v = puedeAfirmarse({ texto, shaVivo: vivo, commitsPendientes: pendientes })

  if (!v.bloquea) {
    return { bloquea: false, aviso: v.motivo ? `⚠️  ${v.motivo}` : null }
  }
  return {
    bloquea: true,
    aviso:
      `⛔ NO SE ENVÍA — ${v.motivo}\n` +
      `   commits sin desplegar: ${pendientes.map((s: string) => s.slice(0, 9)).join(', ')}\n` +
      `   ficheros de superficie servida: ${servidos.slice(0, 5).join(', ')}\n` +
      `   Salidas: (a) desplegar y volver a cerrar — \`npm run deploy:estado\` y el runbook de despliegue;\n` +
      `            (b) reescribir el mensaje en futuro honesto («lo tenemos corregido y estará\n` +
      `                disponible en las próximas horas»), que esta puerta NO marca;\n` +
      `            (c) si lo has comprobado en vivo y esto se equivoca: --vivo-igualmente "<cómo lo comprobaste>".`,
  }
}
