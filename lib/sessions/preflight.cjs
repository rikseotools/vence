// lib/sessions/preflight.cjs — ¿esta sesión está COMPLETA para trabajar? (T-539, 04/08/2026)
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
// El andamiaje de sesiones paralelas (claim, lease, latido, guardarraíles, embudo de preguntas)
// cuelga entero de poder hablar con la BD de coordinación. Cuando no puede, cada pieza lo resuelve
// por su cuenta y **todas hacen fail-open**: el push-guard avisa y deja pasar, el latido no escribe
// y calla, el guard del índice salía 0 sin decir nada (arreglado en T-486).
//
// El resultado medido el 04/08, en un clon sin `.env.local` —que es la condición NORMAL de un
// worktree de agente, porque el fichero está en `.gitignore` y no viaja— es una sesión que:
//   · no aparece en `worktree_sessions`, así que es INVISIBLE para las demás y ellas para ella;
//   · pasa los guardarraíles que dependen de la BD sin que se compruebe nada;
//   · y no se distingue por fuera de una sesión sana.
//
// Para una persona eso es aceptable (está delante, puede juzgar, y bloquearle el trabajo por una
// avería de telemetría sería peor). Para un trabajador autónomo es inaceptable: significa trabajar
// sin supervisión y sin dejar rastro. **Misma comprobación, dos consecuencias.**
//
// ── POR QUÉ UN SOLO SITIO ────────────────────────────────────────────────────────────────────
// La pregunta «¿estoy completo?» ya se contesta hoy en cinco scripts, cada uno a su manera y sin
// poder contárselo a nadie. Es el mismo modo de fallo que costó [T-407] con el session-id: seis
// copias, dos reglas, y el andamiaje mintiendo sin romperse. Aquí la decisión es PURA y el que
// observa (`scripts/sessions/preflight.cjs`) es el único que toca disco y red.

/** Lo que hace falta para participar del reparto, y qué pasa si falta. */
const REQUISITOS = {
  identidad: {
    que: 'no se puede resolver el session-id',
    arreglo: 'trabaja desde un worktree creado con scripts/worktrees/crear-worktree.sh (escribe .session-id)',
  },
  coordinacion: {
    que: 'no se alcanza la base de datos de coordinación',
    arreglo: 'define DATABASE_URL (o el .env.local del worktree). Un trabajador la recibe del gestor de secretos, NUNCA de un .env.local copiado',
  },
  latido: {
    que: 'la sesión no consigue escribir su latido, así que es invisible para las demás',
    arreglo: 'comprueba el acceso a worktree_sessions con la credencial de esta sesión',
  },
  ubicacion: {
    que: 'esta sesión está trabajando en un árbol que NO es el suyo',
    arreglo: 'vuelve a tu worktree antes de seguir: cada comando desde ahí (cd <tu-worktree> && …)',
  },
}

// ── ESTAR EN EL ÁRBOL DE OTRA SESIÓN ES INDETECTABLE POR DENTRO (T-539) ─────────────────────
// La identidad de este repo la manda el SITIO (`resolverSid` prefiere el `.session-id` del
// directorio). Correcto para una persona; y para un proceso autónomo significa que **si acaba en
// el árbol de otra sesión, adopta su identidad y se vuelve indistinguible de ella**: el sid, el
// latido y la huella se derivan todos del directorio, así que al mudarse cambian con él y todo
// vuelve a cuadrar. No hay nada dentro del repositorio con lo que notarlo.
//
// Lo reportó el trabajador en la 1ª vuelta del piloto: *«hice cd a mi worktree y la llamada
// siguiente ya estaba de vuelta en el otro… un comando que yo creía ejecutando en mi worktree se
// habría ejecutado en el directorio de otra sesión»*. Es [T-415] por otra puerta, y esa ya costó
// un commit con el trabajo de otra sesión dentro.
//
// El único ancla que sobrevive a un cambio de directorio es el ENTORNO DEL PROCESO, y por eso el
// hogar lo declara quien ARRANCA al trabajador (igual que el rol). Sin la variable esto no opina:
// una persona no tiene por qué declarar dónde trabaja, y ladrarle sería la forma de que deje de
// mirarse.

/**
 * ¿Está la sesión donde debería?
 *
 * @param hogar  el árbol declarado (`VENCE_SESSION_HOME`), o null si nadie lo declaró
 * @param aqui   el árbol desde el que se está ejecutando (toplevel de git), o null si no se sabe
 * @returns 'ok' | 'fuera' | 'no_declarado'
 *
 * Ante la duda —no se sabe dónde estoy— NO se acusa: `no_declarado`. Es el mismo criterio que
 * `mismaMaquina`, y por la misma razón: un falso positivo aquí manda a alguien a mudarse de sitio
 * sin motivo, y a la tercera vez deja de hacer caso.
 */
function evaluarUbicacion(hogar, aqui) {
  if (!hogar || !aqui) return 'no_declarado'
  const norm = (p) => String(p).replace(/\/+$/, '')
  return norm(hogar) === norm(aqui) ? 'ok' : 'fuera'
}

/**
 * Veredicto de arranque. Decisión pura: recibe OBSERVACIONES ya hechas, no las hace.
 *
 * @param sid            session-id resuelto (null si no se pudo)
 * @param host           máquina, si se sabe. NO es requisito: se puede trabajar sin saberlo, y
 *                       fingir que se sabe sería peor (mismo criterio que `mismaMaquina`).
 * @param coordinacion   ¿se alcanza la BD de coordinación? `null` = no se ha podido comprobar
 * @param latido         ¿se escribió el latido? `null` = no se ha podido comprobar
 * @param rol            'persona' | 'trabajador'
 *
 * @returns {completo, faltas[], puedeTrabajar, veredicto, motivo}
 *
 * **`null` NO es «bien».** Una comprobación que no se pudo hacer cuenta como falta, igual que en
 * el guard del índice: ante la duda, no se afirma que todo está en orden. Es el principio
 * «"no lo sé" tiene que poder decirse» de `sistema-sesiones-paralelas.md`.
 */
function evaluarPreflight({ sid = null, host = null, coordinacion = null, latido = null, rol = 'persona', ubicacion = 'no_declarado' } = {}) {
  const faltas = []
  if (!sid) faltas.push({ clave: 'identidad', ...REQUISITOS.identidad })
  // Solo cuenta cuando se puede AFIRMAR que está fuera. `no_declarado` no es una falta: nadie ha
  // dicho dónde debería estar, y suponerlo sería inventarse el requisito.
  if (ubicacion === 'fuera') faltas.push({ clave: 'ubicacion', ...REQUISITOS.ubicacion })
  if (coordinacion !== true) faltas.push({ clave: 'coordinacion', ...REQUISITOS.coordinacion })
  // El latido solo se puede juzgar si la BD responde: si no, ya está contado como `coordinacion`
  // y añadirlo sería contar dos veces el mismo fallo (y mandar a arreglar donde no es).
  if (coordinacion === true && latido !== true) faltas.push({ clave: 'latido', ...REQUISITOS.latido })

  const completo = faltas.length === 0
  const esTrabajador = rol === 'trabajador'

  return {
    completo,
    faltas,
    host,
    rol,
    // Aquí está toda la tesis de esta pieza: la MISMA observación, distinta consecuencia.
    puedeTrabajar: completo || !esTrabajador,
    veredicto: completo ? 'completo' : esTrabajador ? 'incompleto_bloqueante' : 'incompleto_avisado',
    motivo: completo
      ? 'la sesión participa del reparto con normalidad'
      : esTrabajador
        ? `un trabajador autónomo no puede coger trabajo así: ${faltas.map((f) => f.clave).join(', ')}`
        : `puedes trabajar, pero NO estás en el reparto: ${faltas.map((f) => f.clave).join(', ')}`,
  }
}

/** El texto que se imprime. Aquí para poder testear que DICE cómo arreglarlo, no solo qué pasa. */
function mensajePreflight(v) {
  if (v.completo) {
    return `✅ sesión completa (${v.rol}${v.host ? ` · ${v.host}` : ''}): participa del reparto.`
  }
  const cabecera = v.puedeTrabajar
    ? '⚠️  SESIÓN INCOMPLETA — puedes trabajar, pero NO estás en el reparto:'
    : '⛔ TRABAJADOR INCOMPLETO — no puede coger trabajo:'
  return [
    '',
    cabecera,
    ...v.faltas.flatMap((f) => [`   · ${f.que}`, `       → ${f.arreglo}`]),
    '',
    ...(v.puedeTrabajar
      ? ['   Las demás sesiones no te ven, y los guardarraíles que dependen de la BD no comprueban nada.',
         '   Esto NO es «estás solo»: es «no lo sé».', '']
      : ['   Un trabajador invisible reclamaría tareas que nadie puede ver ni recuperar.', '']),
  ].join('\n')
}

/** Severidad con la que entra en el bus. La política vive aquí, no en el emisor (como fricción). */
const severidadPreflight = (v) => (v.completo ? 'info' : v.puedeTrabajar ? 'warn' : 'error')

// ── CÓMO DEBE FALLAR UN GUARDARRAÍL QUE NO PUEDE COMPROBAR ──────────────────────────────────
// Los guardarraíles de este repo hacen fail-open cuando les falta la BD, y está bien razonado: la
// avería de la telemetría no puede parar el trabajo de una persona. Pero el mismo camino, en un
// trabajador autónomo, deja pasar trabajo SIN comprobar y sin nadie mirando.
//
// El criterio vive AQUÍ y no en cada guardarraíl a propósito: dos reglas sobre cómo fallar
// acabarían divergiendo, que es como nacieron los cinco escritores de `seguimiento_url` (T-130).

/** ¿Una comprobación que NO se ha podido hacer tiene que bloquear? */
const cegueraBloquea = (rol) => rol === 'trabajador'

/** Lo que se imprime al bloquear por ceguera. Dice qué falta y a quién le toca arreglarlo. */
const mensajeCeguera = (guard, detalle) => [
  '',
  `⛔ ${guard}: ${detalle}`,
  '   Esta sesión es un TRABAJADOR AUTÓNOMO (VENCE_SESSION_ROLE=trabajador), así que no puede',
  '   seguir sin comprobar: nadie está delante para juzgarlo. Para una persona esto sería un aviso.',
  '   Arréglalo dándole acceso a la BD de coordinación (npm run sesion:preflight lo diagnostica).',
  '',
].join('\n')

module.exports = {
  evaluarPreflight, mensajePreflight, severidadPreflight,
  evaluarUbicacion, cegueraBloquea, mensajeCeguera, REQUISITOS,
}
