// lib/impugnaciones/avisosPorMateria.cjs — el aviso llega CUANDO hace falta, no al principio. (T-486)
//
// ── POR QUÉ EXISTE, MEDIDO ──────────────────────────────────────────────────────────────────
// El 06/08 tres trabajadores analizaron la misma impugnación sobre un atajo de teclado y los
// TRES verificaron contra `support.microsoft.com/es-es` — la única fuente que el manual
// desaconseja explícitamente para esto.
//
// Y no es que les faltara la información: el aviso llevaba en
// `docs/maintenance/impugnaciones-claude-code.md` desde el **04/08 a las 17:50**, dos días antes
// de sus turnos. Lo tenían. Lo que pasa es que ese manual tiene **2.157 líneas** y el encargo
// dice «léelo entero primero» — que nadie hace, ni una persona ni un agente, antes de cada tarea.
//
// La primera idea fue darles más documentación (bajarles la memoria del proyecto). Se descartó
// tras medirlo: de 40 memorias, 37 ya tenían su contenido en el repo. **El problema no era dónde
// vivía el conocimiento, era CUÁNDO aparecía.** Más documentación es un segundo sitio donde
// tampoco se mira.
//
// Así que el aviso se imprime en el dossier, delante de los ojos, en el momento en que se va a
// cometer el error. Es el mismo patrón que ya funciona en la casa: `tools:buscar` y el registro
// de detectores, que enseñan la regla justo cuando toca.
//
// ── CÓMO SE AÑADE UNO ───────────────────────────────────────────────────────────────────────
// Una entrada más en `AVISOS`. Si una materia vuelve a costar una impugnación mal resuelta, ahí
// va — y con la CIFRA del caso, que es lo que hace que se lea.

/**
 * Avisos por materia. Cada uno declara:
 *  · `cuando`  — cómo se reconoce la materia en el texto de la pregunta/opciones.
 *  · `titulo`  — de qué va, en una línea.
 *  · `lineas`  — lo que hay que saber ANTES de ponerse, no después.
 *
 * Deliberadamente CORTOS: un aviso de veinte líneas se salta igual que el manual.
 */
const AVISOS = [
  {
    id: 'atajos_teclado',
    // Atajo escrito de cualquiera de las formas que aparecen en el banco.
    // «combinación de teclas» va PRIMERO porque es como estaba escrito el enunciado que causó
    // el incidente — y sin ella el aviso no habría saltado mirando solo el enunciado. Lo cazó un
    // test al escribirlo, no la revisión del patrón.
    cuando: /combinaci[oó]n de teclas|\b(ctrl|control|alt|mayús|mayus|shift)\s*\+|\batajo|método abreviado|metodo abreviado|tecla r[aá]pida/i,
    titulo: 'Va de ATAJOS DE TECLADO — la fuente evidente NO vale',
    lineas: [
      'La página `support.microsoft.com/es-es` da los atajos INTERNACIONALES aunque la',
      'instalación española use otros. Verificar ahí es el error que ya se cometió: el 06/08',
      'los TRES trabajadores que miraron una impugnación de Outlook fueron a esa página.',
      '',
      'Qué hacer en su lugar:',
      '  · Cruza VARIAS fuentes españolas. Una sola no basta — un WebFetch puede confabular,',
      '    y dos WebFetch a la MISMA página se han contradicho (medido el 30/07).',
      '  · Usa `curl` + parseo del HTML, no WebFetch a secas, para leer la tabla de verdad.',
      '  · PRUEBA DISCRIMINANTE: no mires el atajo suelto, mira si el SET de su familia está',
      '    desplazado por iniciales españolas. Si coincide con el inglés fila a fila, la fuente',
      '    es una traducción y no prueba nada sobre el Windows español.',
      '  · Atajos españoles ya fijados: guardar=Ctrl+G · nuevo=Ctrl+U · negrita=Ctrl+N ·',
      '    cursiva=Ctrl+K · nota al pie=Ctrl+Alt+O. Los de CORREO no se localizan (Q/U).',
      '',
      'Detalle: docs/maintenance/impugnaciones-claude-code.md §5.1.3',
    ],
  },
  {
    id: 'imagen_invocada',
    cuando: /siguiente (icono|símbolo|simbolo|imagen|figura|gráfico|grafico)|observa la (figura|imagen)|en la imagen|figura\.?\s*\d/i,
    titulo: 'El enunciado invoca una IMAGEN — comprueba que exista',
    lineas: [
      'Si `image_url` es NULL y `content_data` va vacío, la pregunta es IRRESOLUBLE: nadie ve el',
      'gráfico. No es difícil, es imposible — y el re-verificador por LLM no puede detectarlo',
      'porque razona solo sobre TEXTO (ya revirtió un `needs_human` correcto por eso).',
      'Salidas: si el texto ya describe el visual, es autocontenida y se deja; si hay fuente, se',
      'reconstruye; si no, se jubila (`admin_image_unavailable` → `retired_irreparable`).',
      'NUNCA inventar la imagen ni fijar la clave a ciegas.',
      'Detalle: docs/runbooks/salud-contenido.md (kind `visual_deixis_no_image`).',
    ],
  },
  {
    id: 'fuera_de_temario',
    cuando: /no entra en (el|mi) temario|fuera de(l)? (temario|programa)|no corresponde al tema|tema incorrecto/i,
    titulo: 'Dice que NO ENTRA EN SU TEMARIO — hay una puerta antes de contestar',
    lineas: [
      'Antes de analizar nada: `npm run epigrafe:revision -- <position_type> --pregunta <id>`.',
      '`cerrar.ts` lo EXIGE para mandar el email, así que hacerlo después es rehacer el trabajo.',
      'Y desconfía de un `verified_correct`: un Paso 2 sellado por `claude_direct` o con',
      '`agent_run_id=--run` no vino del pipeline y no respalda nada (711 temas así en 45',
      'oposiciones). La colocación la manda el `topic_scope`, NUNCA los `tags`.',
    ],
  },
  {
    id: 'examen_oficial',
    cuando: /examen oficial|convocatoria oficial|salió en el examen|pregunta oficial/i,
    titulo: 'Menciona un EXAMEN OFICIAL — pero oficial no es incuestionable',
    lineas: [
      'En una pregunta oficial NO se toca el enunciado ni las opciones: son las que se',
      'publicaron. Pero eso no la vuelve correcta por decreto — la clave oficial puede estar',
      'mal, y ya ha pasado. Se verifica igual contra la fuente; lo que cambia es qué se puede',
      'arreglar (la explicación sí, el enunciado no).',
      'Detalle: docs/maintenance/impugnaciones-claude-code.md (§ preguntas oficiales).',
    ],
  },
]

/**
 * Los avisos que tocan para un texto dado. PURA.
 * @param textos  enunciado, opciones, lo que escribió el usuario… todo lo que describa el caso
 */
function avisosPara(...textos) {
  const t = textos.filter(Boolean).join('\n')
  if (!t.trim()) return []
  return AVISOS.filter((a) => a.cuando.test(t))
}

/** Cómo se pinta, para que se lea: separado, con el porqué en la primera línea. */
function formatear(avisos) {
  if (!avisos.length) return []
  const out = ['', '━━━ ANTES DE PONERTE: esto ya salió mal una vez ━━━']
  for (const a of avisos) {
    out.push('', `⚠️  ${a.titulo}`)
    for (const l of a.lineas) out.push(l ? `   ${l}` : '')
  }
  out.push('')
  return out
}

module.exports = { AVISOS, avisosPara, formatear }
