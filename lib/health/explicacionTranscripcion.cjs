// lib/health/explicacionTranscripcion.cjs — núcleo puro del cubo «explicación = transcripción
// del artículo»: preguntas ACTIVAS cuya «explicación» no explica nada, sino que **copia el
// artículo vinculado** (a veces precedido de «Artículo 137.» o «Según el art. 16 de la Ley
// 39/2015»). El opositor responde, falla, abre la explicación y se encuentra otra vez el texto
// que acaba de no saber aplicar.
//
// ## De dónde sale (31/07/2026, impugnación `e60091bd`)
//
// Natalia impugnó «La Constitución establece el principio de autonomía de los municipios en su
// artículo:» diciendo que la clave estaba mal. La clave era correcta (art. 137), pero la
// pregunta tenía **46% de acierto en 130 exposiciones** y su explicación entera era:
//
//     Constitución Española.
//     Artículo 137.
//     El Estado se organiza territorialmente en municipios, en provincias y en las Comunidades
//     Autónomas que se constituyan. Todas estas entidades gozan de autonomía para la gestión…
//
// Es decir: no decía por qué el 140 —el artículo que uno tiene en la cabeza— no era la
// respuesta. La impugnación no era un defecto de clave: era el síntoma de una explicación que
// no explica. Medido acto seguido con el criterio de este fichero: **2.146 preguntas activas
// con ≥10 impresiones en 90 días** (998 copia literal + 1.148 casi literal), ~78.700
// impresiones, concentradas en Ley 39/2015, CE, Ley 40/2015 y LPRL.
//
// ## Por qué es un cubo APARTE y no «apelotonada» o «nota de auditoría»
//
//   · **apelotonada** (>400 caracteres sin un salto de línea) mira la FORMA. Una transcripción
//     con saltos de línea —como la de arriba— se le escapa entera, y una explicación buena
//     escrita de corrido cae en él sin ser este defecto.
//   · **nota de auditoría** es la explicación que habla de sí misma. Aquí no habla: calla y
//     copia.
//
// El defecto propio de este cubo es de FONDO: falta el razonamiento por opción. Por eso el
// criterio combina dos cosas y exige LAS DOS: (a) la explicación no analiza las opciones, y
// (b) su contenido ya está en el artículo. Solo (b) marcaría citas legítimas dentro de una
// explicación que sí razona; solo (a) marcaría media base de datos.
//
// ## Calibración (medida sobre el banco, no supuesta)
//
//   · `literal`: el texto normalizado de la explicación, quitado el preámbulo de referencia,
//     está CONTENIDO en el artículo. No admite discusión: es copiar y pegar.
//   · `casi`: ≥92% de las palabras largas (>3 letras, sin repetir) de la explicación aparecen
//     en el artículo. Cubre la copia con los saltos de línea movidos, la que compacta una
//     enumeración o la que cambia dos conectores. Por debajo de 0,92 empiezan a entrar
//     explicaciones que sí aportan frases propias, así que ese es el corte.
//   · Se exige un mínimo de longitud (60 caracteres normalizados) y de vocabulario (10 palabras
//     largas distintas) para no clasificar sobre nada.
//
// Reparar NUNCA es automático: se verifica la clave contra el artículo y se reescribe la
// explicación en formato estructurado (`scripts/aplicar-explicacion.ts`), que además la deja
// barajable. Cola y método: T-409 + `docs/maintenance/revisar-preguntas-con-agente.md`.

/** Umbral de solape de vocabulario a partir del cual la explicación «no aporta palabras». */
const COBERTURA_CASI = 0.92;
/** Mínimos para que el juicio signifique algo (ni textos de tres palabras ni vocabulario pobre). */
const MIN_CARACTERES = 60;
const MIN_PALABRAS = 10;

/** Minúsculas, sin tildes y sin puntuación: comparar texto legal exige ignorar el maquetado. */
function normaliza(texto) {
  return (texto || '')
    .toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Quita el preámbulo de referencia con el que suelen abrir estas explicaciones («Constitución
 * Española. Artículo 137.», «Según el artículo 16 de la Ley 39/2015»). Es texto NUESTRO que
 * nunca está dentro del artículo, así que sin podarlo la comparación fallaría justo en el caso
 * más evidente. Se poda como mucho una vez cada cosa: no es un limpiador general.
 */
function quitaPreambulo(normalizado) {
  return normalizado
    .replace(/^(constitucion espanola|ley organica [0-9 ]+|ley [0-9 ]+|real decreto[a-z0-9 ]{0,20}|texto refundido[a-z0-9 ]{0,30})\s*/, '')
    .replace(/^(segun|conforme a|de acuerdo con|a tenor de)( lo dispuesto en)?( el| la)?\s*/, '')
    // El «de la Ley 39/2015» solo se poda si viene detrás de «de la»/«del»: sin esa condición
    // la cola opcional de palabras se comía el principio de la explicación («articulo 137 el
    // estado se organiza» → ''), que es justo el texto que hay que comparar.
    .replace(/^(articulo|art|apartado)s? [0-9]+( bis| ter| quater)?( [0-9]+)*( (de la|del)( [a-z0-9]+){0,6})?\s*/, '')
    .trim();
}

/**
 * ¿La explicación razona opción por opción? Es la marca del formato §5.1 (y del §8.1 de
 * generación). Vive aquí y no en el SQL del extractor para que cubo, medición y tests usen la
 * MISMA definición: dos puertas con criterios distintos no protegen, se contradicen.
 */
function tieneAnalisisPorOpcion(explanation) {
  const t = explanation || '';
  if (/\*\*[A-E]\)/.test(t)) return true;                       // «**A)** INCORRECTA. …»
  if (/\b(INCORRECTA|CORRECTA)\b/.test(t)) return true;         // veredicto por opción en mayúsculas
  if (/por qu[eé] (las )?dem[aá]s/i.test(t)) return true;       // render estructurado
  if (/^\s*[-*]\s*\*\*[A-E]\b/m.test(t)) return true;           // lista con la letra en negrita
  return false;
}

/**
 * Clasifica una pareja explicación↔artículo.
 * @returns {{clase: 'literal'|'casi'|null, cobertura: number|null, motivo: string}}
 */
function clasificaTranscripcion({ explanation, articleContent }) {
  if (!explanation || !articleContent) return { clase: null, cobertura: null, motivo: 'sin_datos' };
  if (tieneAnalisisPorOpcion(explanation)) return { clase: null, cobertura: null, motivo: 'analiza_opciones' };

  const ne = quitaPreambulo(normaliza(explanation));
  const na = normaliza(articleContent);
  if (ne.length < MIN_CARACTERES) return { clase: null, cobertura: null, motivo: 'demasiado_corta' };

  if (na.includes(ne)) return { clase: 'literal', cobertura: 1, motivo: 'contenida_en_el_articulo' };

  const palabras = [...new Set(ne.split(' ').filter((w) => w.length > 3))];
  if (palabras.length < MIN_PALABRAS) return { clase: null, cobertura: null, motivo: 'vocabulario_insuficiente' };
  const dentro = palabras.filter((w) => na.includes(w)).length;
  const cobertura = dentro / palabras.length;
  if (cobertura >= COBERTURA_CASI) return { clase: 'casi', cobertura, motivo: 'vocabulario_del_articulo' };
  return { clase: null, cobertura, motivo: 'aporta_texto_propio' };
}

module.exports = {
  COBERTURA_CASI,
  MIN_CARACTERES,
  MIN_PALABRAS,
  normaliza,
  quitaPreambulo,
  tieneAnalisisPorOpcion,
  clasificaTranscripcion,
};
