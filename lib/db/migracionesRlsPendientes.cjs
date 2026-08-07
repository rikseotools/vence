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

module.exports = { extraerDeclaraciones, migracionesRlsPendientes, politicaFalta }
