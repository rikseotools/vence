/**
 * despejarArticuladoPorLetra — quita de una razón las citas del articulado POR LETRA y los ordinales
 * que el detector de barajabilidad confunde con referencias a una opción.
 *
 * ## Por qué existe
 *
 * `explanationReferencesLetters` (el detector que decide si una pregunta puede barajarse) marca
 * «la letra e) del artículo 7» igual que «la opción E», y «la segunda frase» igual que «la segunda
 * opción». Es un falso positivo asumido por diseño —el módulo declara que 0 falsos negativos es
 * sagrado— pero tiene una consecuencia concreta: una explicación impecable que cita el articulado
 * como se cita en Derecho **pierde el barajado**.
 *
 * Medido en la campaña de T-291: 30 razones de 400 preguntas jurídicas (7,5%) caían por esto, todas
 * de la misma familia. El agente no se equivoca al escribirlas; es la convención de cita la que
 * choca con el detector.
 *
 * ## Qué hace y qué NO hace
 *
 * Reescrituras de SUPERFICIE que no cambian el fondo: nombra el artículo o el apartado sin su letra.
 * NO toca el argumento, NO inventa contenido, NO altera la `cita` (que sí puede reproducir el
 * listado con sus letras: la cita no se examina). Lo que no encaje en estos patrones se deja tal
 * cual para que lo mire una persona — el gate lo seguirá marcando, que es lo correcto.
 *
 * Se aplica a las razones Y a la narrativa (`intro`/`outro`), porque el render la emite verbatim en
 * cualquier orden y una letra ahí queda clavada igual.
 */

/** Ordinal femenino → masculino, para «la segunda frase» → «el segundo enunciado». */
const ORDINAL_M = { primera: 'primer', segunda: 'segundo', tercera: 'tercer', cuarta: 'cuarto' };

/**
 * Despeja un texto. Devuelve el texto reescrito (igual al original si no había nada que despejar).
 * Función PURA: sin IO, sin estado.
 */
function despejarArticuladoPorLetra(texto) {
  if (!texto) return texto;
  let n = String(texto);
  // «la letra e) del artículo 7» / «… del art. 7» → «el artículo 7»
  n = n.replace(/\bla\s+letra\s+[a-eA-E]\)\s+del\s+(art[íi]culo|art\.)\s*/gi, 'el $1 ');
  // «la letra c) del apartado 4» → «el apartado 4»
  n = n.replace(/\bla\s+letra\s+[a-eA-E]\)\s+del\s+apartado\s+(\d+)/gi, 'el apartado $1');
  // «(letra b)» / «(letras b)» → fuera
  n = n.replace(/\s*\(\s*letras?\s+[a-eA-E]\)\s*\)/gi, '');
  n = n.replace(/\s*\(\s*letras?\s+[a-eA-E]\s*\)/gi, '');
  // «(letra c del apartado segundo)» → «(del apartado segundo)»
  n = n.replace(/\(\s*letras?\s+[a-eA-E]\s+(del\s+[^)]+)\)/gi, '($1)');
  // «la letra c del apartado segundo» (sin paréntesis) → «del apartado segundo»
  n = n.replace(/\bla\s+letra\s+[a-eA-E]\s+(del\s+(?:art[íi]culo|apartado))/gi, '$1');
  // «letras a) y b) del artículo» → «el artículo»
  n = n.replace(/\bletras?\s+[a-eA-E]\)\s+y\s+[a-eA-E]\)\s+del\s+(art[íi]culo|art\.|apartado)\s*/gi, 'el $1 ');
  // «conforme a la letra a)» → «conforme a lo previsto»
  n = n.replace(/\bconforme\s+a\s+la\s+letra\s+[a-eA-E]\)/gi, 'conforme a lo previsto');
  // resto de «(la) letra X)» / «apartado X)» → «ese apartado».
  //
  // ⚠️ El determinante previo hay que COMERLO, no dejarlo delante: sin esto sale «su ese apartado»
  // (pasó en la campaña, lo cazó un agente al revisar su propio fichero). Con el determinante
  // absorbido, «su letra a)» → «ese apartado» y la frase sigue siendo gramatical.
  n = n.replace(/\b(?:su|sus|el|la|los|las|un|una)\s+letra\s+[a-eA-E]\)/gi, 'ese apartado');
  n = n.replace(/\b(?:del|al)\s+letra\s+[a-eA-E]\)/gi, 'de ese apartado');
  n = n.replace(/\bletra\s+[a-eA-E]\)/gi, 'ese apartado');
  n = n.replace(/\b(?:su|sus|el|la|los|las|un|una)\s+apartado\s+[a-eA-E]\)/gi, 'ese apartado');
  n = n.replace(/\bapartado\s+[a-eA-E]\)/gi, 'ese apartado');
  // red de seguridad: si un despeje anterior dejó un determinante huérfano, se limpia aquí
  n = n.replace(/\b(su|sus|el|la|los|las|un|una)\s+ese\s+apartado/gi, 'ese apartado');
  // ordinal + «frase» referido al PRECEPTO (el detector lo lee como ordinal de opción)
  n = n.replace(/\bla\s+(primera|segunda|tercera|cuarta)\s+frase\b/gi,
    (_, o) => `el ${ORDINAL_M[o.toLowerCase()] || o} enunciado`);
  return n;
}

/**
 * Despeja una explicación estructurada COMPLETA (razones + intro + outro). No muta la entrada:
 * devuelve `{ data, cambios }`, con `cambios` describiendo cada campo tocado.
 */
function despejarEstructurada(data) {
  const out = { ...data, options: { ...(data.options || {}) } };
  const cambios = [];
  for (const [k, v] of Object.entries(out.options)) {
    const n = despejarArticuladoPorLetra(v);
    if (n !== v) { out.options[k] = n; cambios.push({ campo: `options.${k}`, antes: v, ahora: n }) }
  }
  for (const campo of ['intro', 'outro']) {
    if (!out[campo]) continue;
    const n = despejarArticuladoPorLetra(out[campo]);
    if (n !== out[campo]) { cambios.push({ campo, antes: out[campo], ahora: n }); out[campo] = n }
  }
  return { data: out, cambios };
}

module.exports = { despejarArticuladoPorLetra, despejarEstructurada };

// ── CLI: despeja todos los ficheros de un directorio de estructuradas ────────────────────────────
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const base = process.argv[2];
  if (!base) { console.error('Uso: despejarArticuladoPorLetra.cjs <dir-campaña>  (espera estructuradas/ dentro)'); process.exit(2) }
  const dir = path.join(base, 'estructuradas');
  const log = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const p = path.join(dir, f);
    const { data, cambios } = despejarEstructurada(JSON.parse(fs.readFileSync(p, 'utf8')));
    if (!cambios.length) continue;
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    for (const c of cambios) log.push(`${f.replace('.json', '')} [${c.campo}]\n   antes: ${c.antes}\n   ahora: ${c.ahora}`);
  }
  if (log.length) fs.appendFileSync(path.join(base, 'arreglos.log'), `\n=== despeje de articulado por letra ===\n${log.join('\n')}\n`);
  console.log(`✅ ${log.length} campo(s) despejado(s) en ${base}`);
  for (const l of log) console.log('  · ' + l.split('\n')[0]);
}
