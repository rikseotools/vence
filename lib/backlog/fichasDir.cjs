'use strict'
// lib/backlog/fichasDir.cjs — almacenamiento «una ficha = un fichero». [T-532]
//
// FUENTE DE VERDAD desde aquí: `docs/roadmap/tareas/T-nnn.md`, uno por ficha. Dos sesiones
// escribiendo fichas DISTINTAS ya no tocan el mismo fichero — el conflicto que motivó esta tarea
// desaparece por construcción, no se mitiga con avisos.
//
// `docs/roadmap/tareas-pendientes.md` pasa a ser GENERADO (`generarIndice`): un índice legible con
// el mismo aspecto de siempre —preámbulo, «## Abiertas», «## Hechas»— pero calculado, no editado a
// mano. La sección de cada ficha ya NO es su posición: la decide su propia cabecera (`✅` = hecha,
// el mismo criterio que fijó T-382 en `parseMarkdown.cjs`, sin tocar ese fichero).
//
// Los seis bloques `##` sueltos que había en el monolito (texto real, sin id `T-nnn`, escrito por
// una sesión que nunca reservó una ficha) NO se descartan: quedan en `docs/roadmap/tareas/
// _sueltos.md`, con su cabecera de zona en cuarentena, para que alguien decida si merecen ficha o
// si ya no hacen falta. Perderlos habría sido repetir el daño que esta tarea existe para evitar.

const fs = require('fs')
const path = require('path')
const { dividirEnBloques, reconstruir, idsFicha } = require('./dividirFichas.cjs')

const REPO = path.join(__dirname, '..', '..')
const DIR_FICHAS = path.join(REPO, 'docs', 'roadmap', 'tareas')
const FICHERO_PREAMBULO = path.join(DIR_FICHAS, '_preambulo.md')
const FICHERO_SUELTOS = path.join(DIR_FICHAS, '_sueltos.md')
const FICHERO_INDICE = path.join(REPO, 'docs', 'roadmap', 'tareas-pendientes.md')

const RE_ID = /^T-\d+$/
const RE_ARCHIVO_FICHA = /^(T-\d+)\.md$/

/** Ruta del fichero de una ficha. No comprueba que exista. */
function rutaFicha(id) {
  if (!RE_ID.test(String(id ?? ''))) throw new Error(`id inválido: «${id}»`)
  return path.join(DIR_FICHAS, `${id}.md`)
}

/** Ids de todas las fichas que tienen fichero hoy, sin leer su contenido (barato). */
function listarIds() {
  if (!fs.existsSync(DIR_FICHAS)) return []
  return fs.readdirSync(DIR_FICHAS)
    .map((f) => RE_ARCHIVO_FICHA.exec(f))
    .filter(Boolean)
    .map((m) => m[1])
    .sort()
}

/** Lee UNA ficha por id. `null` si no existe — nunca lanza por «no está», que es el caso normal
 *  cuando otra sesión aún no ha pusheado la suya. */
function leerFicha(id) {
  const p = rutaFicha(id)
  if (!fs.existsSync(p)) return null
  return fs.readFileSync(p, 'utf8')
}

/** Escribe UNA ficha. Crea el directorio si hace falta (primera vez tras clonar). */
function escribirFicha(id, texto) {
  if (!fs.existsSync(DIR_FICHAS)) fs.mkdirSync(DIR_FICHAS, { recursive: true })
  fs.writeFileSync(rutaFicha(id), String(texto ?? ''))
}

function borrarFicha(id) {
  const p = rutaFicha(id)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

/** Todas las fichas, en el orden que da `listarIds()` (alfabético = numérico ascendente por cómo
 *  se nombran los ficheros). @returns Array<{id, texto}> */
function leerTodas() {
  return listarIds().map((id) => ({ id, texto: leerFicha(id) }))
}

function leerPreambulo() {
  return fs.existsSync(FICHERO_PREAMBULO) ? fs.readFileSync(FICHERO_PREAMBULO, 'utf8') : ''
}

function escribirPreambulo(texto) {
  if (!fs.existsSync(DIR_FICHAS)) fs.mkdirSync(DIR_FICHAS, { recursive: true })
  fs.writeFileSync(FICHERO_PREAMBULO, String(texto ?? ''))
}

function leerSueltos() {
  return fs.existsSync(FICHERO_SUELTOS) ? fs.readFileSync(FICHERO_SUELTOS, 'utf8') : ''
}

function escribirSueltos(texto) {
  if (!fs.existsSync(DIR_FICHAS)) fs.mkdirSync(DIR_FICHAS, { recursive: true })
  fs.writeFileSync(FICHERO_SUELTOS, String(texto ?? ''))
}

/** `true` si la cabecera de una ficha lleva la marca de cierre. Copia MINIMA y a propósito de la
 *  regla de `parseMarkdown.cjs` (T-382): no se importa ese fichero para no acoplar el almacén al
 *  parser — los dos leen la MISMA convención (✅ en la primera línea), no el mismo código. */
function estaCerrada(textoFicha) {
  const primeraLinea = String(textoFicha ?? '').split('\n', 1)[0]
  return primeraLinea.includes('✅')
}

/** Número de una ficha para poder ordenar («T-042» → 42). */
function numero(id) {
  const m = /^T-(\d+)$/.exec(id)
  return m ? parseInt(m[1], 10) : 0
}

const CABECERA_SUELTOS =
  '## 🗄️ Contenido sin ficha (migrado por [T-532], pendiente de triage)\n\n' +
  '> Estos bloques vivían sueltos en el monolito, con encabezado `##` propio pero SIN id `T-nnn` —\n' +
  '> texto real de alguna sesión que nunca reservó una ficha para él. La migración a «una ficha =\n' +
  '> un fichero» no podía asignarles un id por su cuenta (adivinar sería peor que dejarlos como\n' +
  '> están), así que quedan aquí tal cual, en `docs/roadmap/tareas/_sueltos.md`. Si a alguno le\n' +
  '> queda trabajo de verdad, resérvale un id con `reserve` y conviértelo en ficha; si ya no hace\n' +
  '> falta, bórralo de ese fichero.\n\n'

/**
 * Genera el índice completo (`tareas-pendientes.md`) a partir de lo que hay en disco AHORA MISMO.
 * Determinista: mismas fichas en disco → mismo texto, siempre — es lo que permite comprobar que
 * el fichero comiteado está al día (`indiceEstaAlDia`).
 */
function generarIndice() {
  const preambulo = leerPreambulo()
  const sueltos = leerSueltos()
  const fichas = leerTodas()

  const abiertas = fichas.filter((f) => !estaCerrada(f.texto)).sort((a, b) => numero(b.id) - numero(a.id))
  const hechas = fichas.filter((f) => estaCerrada(f.texto)).sort((a, b) => numero(b.id) - numero(a.id))

  const partes = [preambulo]
  if (sueltos.trim()) partes.push(CABECERA_SUELTOS + sueltos)
  partes.push('## Abiertas\n\n')
  partes.push(abiertas.map((f) => f.texto).join(''))
  partes.push('## Hechas\n\n')
  partes.push(hechas.map((f) => f.texto).join(''))

  return partes.join('')
}

/** Escribe el índice generado en `tareas-pendientes.md`. */
function regenerarIndice() {
  fs.writeFileSync(FICHERO_INDICE, generarIndice())
}

/** ¿El índice comiteado coincide con lo que se regeneraría AHORA? Falso si alguien editó el
 *  índice a mano en vez de editar la ficha, o si se añadió/borró un fichero sin regenerar. */
function indiceEstaAlDia() {
  if (!fs.existsSync(FICHERO_INDICE)) return false
  return fs.readFileSync(FICHERO_INDICE, 'utf8') === generarIndice()
}

module.exports = {
  DIR_FICHAS, FICHERO_PREAMBULO, FICHERO_SUELTOS, FICHERO_INDICE,
  rutaFicha, listarIds, leerFicha, escribirFicha, borrarFicha, leerTodas,
  leerPreambulo, escribirPreambulo, leerSueltos, escribirSueltos,
  estaCerrada, numero, generarIndice, regenerarIndice, indiceEstaAlDia,
  // Reexportados por conveniencia de quien migra (evita un segundo require).
  dividirEnBloques, reconstruir, idsFicha,
}
