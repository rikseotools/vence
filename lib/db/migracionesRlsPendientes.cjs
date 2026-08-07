// lib/db/migracionesRlsPendientes.cjs — [T-645]
//
// EL HUECO QUE ESTO CIERRA: una migración de `supabase/migrations/*.sql` que se mergea a
// `main` NO llega sola a producción — aplicarla contra RDS es un paso MANUAL, sin ningún
// paso de deploy que lo haga (comprobado: ningún script de `scripts/deploy-*.sh` ni workflow
// de `.github/workflows/*.yml` menciona `supabase/migrations`). Medido el 07/08: al menos 3
// migraciones de política RLS `flota_lector_lee` llevaban 2+ días en `main` sin aplicar
// (T-573, T-038), un cuarto caso confirmado el mismo día (T-108/T-645) y CLAUDE.md ya
// documenta el patrón de estas migraciones como "establecido" — así que van a seguir
// apareciendo. Nadie lo veía porque nada lo comprobaba: la única señal era un trabajador
// tropezando con `pg_policies` vacío mientras investigaba OTRA tarea.
//
// LA IDEA: estas migraciones tienen una FORMA MUY CONCRETA y repetida (ver CLAUDE.md, "patrón
// establecido") — declaran una política `CREATE POLICY <nombre> ON public.<tabla> FOR <cmd>
// TO <rol[, rol...]>`, en línea o dentro de un `EXECUTE format(...)` con `%I` recorriendo un
// `ARRAY[...]` de tablas. Esa forma es mecánicamente parseable, y lo que declara ("esta tabla
// debería dejar de estar bloqueada para este rol") es EXACTAMENTE lo que
// `seleccionBloqueadaPorRls` (T-574) ya sabe comprobar contra el catálogo vivo — se reutiliza
// en vez de inventar un segundo criterio que pueda divergir del primero.
//
// LO QUE ESTO NO CUBRE (a propósito, no es una promesa incumplida): NO es un ledger genérico
// de "toda migración aplicada" — eso exigiría una tabla de seguimiento nueva (escribirla es
// DDL de negocio, fuera del permiso de un trabajador) y una forma de verificar CUALQUIER tipo
// de cambio de esquema, no solo políticas RLS. Se acota a esta familia porque es la que ha
// causado los 3+ casos confirmados y porque es la única verificable HOY sin escribir nada —
// vía el catálogo, con la credencial de solo lectura de la flota (`VENCE_LECTOR_URL`).

const { seleccionBloqueadaPorRls } = require('./rlsSelectBlocked.cjs')

/**
 * Generalización de `seleccionBloqueadaPorRls` a un `cmd` arbitrario (esa función es
 * deliberadamente SOLO-SELECT por contrato y nombre, y otros sitios ya dependen de esa forma
 * exacta — no se toca). La mayoría de estas migraciones son SELECT (donde esto y
 * `seleccionBloqueadaPorRls` dan EXACTAMENTE el mismo resultado, mismo predicado), pero al
 * menos una (`20260805_rls_impugnaciones_flota.sql`) también declara una política `UPDATE` —
 * y para esa, preguntar "¿está bloqueado el SELECT?" sería la pregunta equivocada: podría dar
 * "no" porque OTRA política ya cubre el SELECT, mientras la política UPDATE de verdad falta.
 */
function politicaFalta(cmd, role, rowsecurity, policies) {
  if (!rowsecurity) return false
  const aplica = (p) =>
    (p.cmd === cmd || p.cmd === 'ALL') &&
    Array.isArray(p.roles) &&
    (p.roles.includes('public') || p.roles.includes(role))
  return !(policies || []).some(aplica)
}

/**
 * Extrae las declaraciones `CREATE POLICY … ON public.<tabla> FOR <cmd> TO <rol[,rol]>` de
 * un fichero de migración. Reconoce las DOS formas usadas en el repo (ver CLAUDE.md):
 *  (a) directa:  `CREATE POLICY nombre ON public.tabla FOR SELECT TO rol USING (true);`
 *  (b) plantilla: dentro de `EXECUTE format('CREATE POLICY nombre ON public.%I FOR SELECT TO
 *      rol USING (true)', t)` recorriendo `FOREACH t IN ARRAY ARRAY['tabla1', 'tabla2']`.
 *
 * Ignora los comentarios `-- …` de la migración: varias de estas migraciones EXPLICAN el
 * patrón en su cabecera citando el propio SQL de ejemplo, y eso parsearía como una
 * declaración fantasma si no se despoja antes.
 *
 * @param {string} sqlTexto  contenido íntegro del `.sql`
 * @returns {Array<{policy: string, table: string, cmd: string, roles: string[]}>}
 */
function extraerDeclaraciones(sqlTexto) {
  const sinComentarios = String(sqlTexto || '')
    .split('\n')
    .map((linea) => linea.replace(/--.*$/, ''))
    .join('\n')

  const declaraciones = []

  // (b) plantilla con %I — se resuelve contra cada tabla del ARRAY[...] del mismo bloque DO $$.
  const reBloque = /FOREACH\s+\w+\s+IN\s+ARRAY\s+ARRAY\[([^\]]+)\][\s\S]*?END\s*\$\$/gi
  let mBloque
  while ((mBloque = reBloque.exec(sinComentarios))) {
    const bloque = mBloque[0]
    const tablas = [...bloque.matchAll(/'([a-zA-Z0-9_]+)'/g)].map((m) => m[1])
    const rePlantilla =
      /CREATE POLICY\s+(\S+)\s+ON\s+public\.%I\s+FOR\s+(\w+)\s+TO\s+([\w,\s]+?)\s+USING/gi
    let mPlantilla
    while ((mPlantilla = rePlantilla.exec(bloque))) {
      const [, policy, cmd, rolesRaw] = mPlantilla
      const roles = rolesRaw.split(',').map((r) => r.trim()).filter(Boolean)
      for (const table of tablas) {
        declaraciones.push({ policy, table, cmd: cmd.toUpperCase(), roles })
      }
    }
  }

  // (a) directa — ON public.<tabla_literal>, nunca %I (eso ya lo cubrió el bloque de arriba).
  const reDirecta =
    /CREATE POLICY\s+(\S+)\s+ON\s+public\.([a-zA-Z0-9_]+)\s+FOR\s+(\w+)\s+TO\s+([\w,\s]+?)\s+USING/gi
  let mDirecta
  while ((mDirecta = reDirecta.exec(sinComentarios))) {
    const [, policy, table, cmd, rolesRaw] = mDirecta
    const roles = rolesRaw.split(',').map((r) => r.trim()).filter(Boolean)
    declaraciones.push({ policy, table, cmd: cmd.toUpperCase(), roles })
  }

  return declaraciones
}

/**
 * De una lista de migraciones ya parseadas, cuáles siguen SIN cumplirse contra el catálogo
 * vivo — es decir, para al menos uno de sus `(tabla, rol)` declarados, `seleccionBloqueadaPorRls`
 * seguiría diciendo que sí bloquea.
 *
 * @param {Array<{archivo: string, declaraciones: ReturnType<typeof extraerDeclaraciones>}>} migraciones
 * @param {Record<string, {rowsecurity: boolean, policies: Array<{cmd: string, roles: string[]}>}>} catalogoPorTabla
 *   una entrada por tabla; ausente = la tabla no se pudo leer del catálogo (se reporta, no se asume).
 * @returns {Array<{archivo: string, faltan: Array<{table: string, role: string, motivo: string}>}>}
 */
function migracionesRlsPendientes(migraciones, catalogoPorTabla) {
  const pendientes = []
  for (const m of migraciones) {
    const faltan = []
    const vistos = new Set()
    for (const d of m.declaraciones || []) {
      for (const role of d.roles) {
        const clave = `${d.table}|${role}|${d.cmd}`
        if (vistos.has(clave)) continue
        vistos.add(clave)
        const cat = catalogoPorTabla[d.table]
        if (!cat) {
          faltan.push({ table: d.table, role, motivo: 'tabla no encontrada en el catálogo (VENCE_LECTOR_URL)' })
          continue
        }
        const bloqueado =
          d.cmd === 'SELECT'
            ? seleccionBloqueadaPorRls(cat.rowsecurity, cat.policies, role) // mismo predicado, contrato pinado
            : politicaFalta(d.cmd, role, cat.rowsecurity, cat.policies)
        if (bloqueado) {
          faltan.push({ table: d.table, role, motivo: `RLS sigue bloqueando ${d.cmd} de ${role}` })
        }
      }
    }
    if (faltan.length) pendientes.push({ archivo: m.archivo, faltan })
  }
  return pendientes
}

/**
 * Parte los pendientes en ACCIONABLES y LEGACY (T-658).
 *
 * Por qué hace falta: al poner el detector a correr en CI se vio que arrastra dos migraciones de
 * **mayo** (`20260502_*`) cuyas políticas son para el rol `authenticated` — el rol de la era
 * Supabase Auth, que en RDS todavía EXISTE pero ya no inicia sesión (`rolcanlogin=false`,
 * comprobado en el catálogo el 07/08). Nadie las va a aplicar hoy y decidirlas es trabajo aparte.
 *
 * Dejarlas contando como fallo tendría un coste conocido y medido en esta casa: un gate que sale
 * rojo todos los días se deja de mirar, y con él se deja de ver el rojo de verdad (misma lección
 * que T-047/T-113/T-179). Y ocultarlas sería peor. Así que se SEPARAN: siguen imprimiéndose, pero
 * el veredicto del gate lo fija solo lo accionable — las políticas de los roles propios de la
 * flota (`vence_*`), que son las que alguien puede aplicar hoy con una orden.
 *
 * @returns {{accionables: Array, legacy: Array}}
 */
function partirPorAccionabilidad(pendientes) {
  const esNuestro = (rol) => /^vence_/.test(String(rol || ''))
  const accionables = [], legacy = []
  for (const p of pendientes || []) {
    const nuestras = (p.faltan || []).filter((f) => esNuestro(f.role))
    const ajenas = (p.faltan || []).filter((f) => !esNuestro(f.role))
    if (nuestras.length) accionables.push({ ...p, faltan: nuestras })
    if (ajenas.length) legacy.push({ ...p, faltan: ajenas })
  }
  return { accionables, legacy }
}

/**
 * ¿Este fichero de migración se puede APLICAR desde esta herramienta sin sorpresas? (T-645-bis)
 *
 * El detector señala como pendiente CUALQUIER fichero cuyas políticas no estén en el catálogo, y
 * entre ellos aparecen ficheros ANTIGUOS y ANCHOS (p. ej. `20260502_security_advisor_fixes.sql`,
 * que además de políticas toca funciones y vistas). Aplicar eso «porque el canario lo lista»
 * sería justo la chapuza que esta familia de herramientas evita: el que detecta no puede arrastrar
 * al que escribe.
 *
 * Por eso la puerta es una LISTA BLANCA de sentencias, no una lista negra: solo pasan los ficheros
 * cuyo SQL se limita a la familia de RLS por política (habilitar RLS, crear/borrar políticas y la
 * guarda `DO $$ … RAISE EXCEPTION …` que estas migraciones llevan). Cualquier otra sentencia —un
 * `UPDATE`, un `CREATE FUNCTION`, un `DROP TABLE`— la deja fuera y manda a aplicarla a mano.
 *
 * @param {string} sql contenido del fichero
 * @returns {{ok: boolean, motivo?: string, sentencias: string[]}}
 */
function esAplicableSinRiesgo(sql) {
  // Fuera comentarios de línea y de bloque: no son sentencias y contienen ejemplos de SQL
  // (estas migraciones documentan mucho en la cabecera) que dispararían falsos rechazos.
  const limpio = String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

  // Los bloques DO $$ … $$ se tratan como UNA sentencia: dentro llevan el EXECUTE format(...) de
  // las políticas y la guarda del GRANT, y trocearlos por `;` los rompería.
  const sinBloques = limpio.replace(/DO\s*\$\$[\s\S]*?\$\$\s*;/gi, 'DO_BLOQUE;')

  const sentencias = sinBloques.split(';').map((s) => s.trim()).filter(Boolean)
  const PERMITIDAS = [
    /^DO_BLOQUE$/i,
    /^ALTER\s+TABLE\s+[\w."]+\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY$/i,
    /^CREATE\s+POLICY\b/i,
    /^DROP\s+POLICY\b/i,
    /^BEGIN$/i,
    /^COMMIT$/i,
  ]
  for (const s of sentencias) {
    const unaLinea = s.replace(/\s+/g, ' ').trim()
    if (!PERMITIDAS.some((re) => re.test(unaLinea))) {
      return { ok: false, motivo: `sentencia fuera de la familia RLS: «${unaLinea.slice(0, 60)}…»`, sentencias }
    }
  }
  if (!sentencias.length) return { ok: false, motivo: 'el fichero no tiene sentencias', sentencias }
  return { ok: true, sentencias }
}

module.exports = {
  extraerDeclaraciones, migracionesRlsPendientes, politicaFalta,
  esAplicableSinRiesgo, partirPorAccionabilidad,
}
