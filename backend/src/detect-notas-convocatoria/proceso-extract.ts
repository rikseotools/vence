/**
 * Fase 2 — RECONCILIACIÓN del proceso contra el documento oficial.
 *
 * Diseño: docs/roadmap/verificacion-convocatorias-documentos-proceso.md
 *
 * Qué añade sobre el sensor de versiones que ya existe (`notas-extract.ts`): ese lee las notas para
 * saber QUÉ SE EXAMINA (Windows 11, Word 365). Esto lee las BASES para saber CUÁNDO y CUÁNTAS PLAZAS,
 * y lo COMPARA con lo que mostramos. Es la pieza que ESCALA: un sensor de cobertura dice "no lo has
 * mirado" (un humano por convocatoria → no llega a 2.489); la reconciliación dice "el BOCM dice mayo
 * y tú muestras noviembre".
 *
 * REGLA DE ORO (doctrina del repo): NUNCA auto-flip. Un descuadre es un `finding` para revisar,
 * jamás un `UPDATE exam_date`. Sin cita literal no hay hallazgo.
 *
 * Helpers PUROS: sin DI, sin red, sin BD. Se validan con
 * `scripts/sim-reconciliacion-convocatoria.cjs` contra datos reales ANTES de portarlos al cron —
 * mismo camino que siguió `notas-extract.ts`.
 */

/** Un hito extraído del documento oficial, con su cláusula. */
export interface HitoExtraido {
  /** Vocabulario cerrado de convocatoria_hitos.tipo (17 valores). */
  tipo: string;
  /** ISO 'YYYY-MM-DD', o 'YYYY-MM' cuando el documento solo da el mes ("mayo de 2027"). */
  fecha: string;
  cita_literal: string;
}

/** Lo que el LLM saca del/de los documento(s) oficial(es) de una convocatoria. */
export interface ProcesoExtraction {
  fecha_examen: string | null;
  plazas_libres: number | null;
  plazas_promocion_interna: number | null;
  hitos: HitoExtraido[];
  confianza: 'alta' | 'media' | 'baja';
}

/** Lo que MOSTRAMOS hoy (leído de oposiciones_ssot: lo que ve el usuario, no la tabla cruda). */
export interface ProcesoEnBd {
  exam_date: string | null;
  plazas_libres: number | null;
  plazas_promocion_interna: number | null;
}

export interface Descuadre {
  campo: string;
  db: string | null;
  oficial: string;
  cita: string;
  severidad: 'error' | 'warn';
}

/**
 * Precisión asimétrica: si el documento solo dice "mayo de 2027", lo máximo que puede afirmar es el
 * MES. Comparar a nivel día daría un falso positivo contra nuestro 2027-05-01.
 * ESTE es exactamente el caso Marta: la base 9 dice "mayo de 2027" y nuestra fecha es aproximada al
 * 1-may-2027 → CUADRAN. Si mostráramos nov-2027 → NO cuadran → hallazgo.
 */
export function fechasCuadran(db: string | null, oficial: string): boolean {
  if (!db) return false;
  const soloMes = /^\d{4}-\d{2}$/.test(oficial);
  const norm = (s: string) => (soloMes ? s.slice(0, 7) : s.slice(0, 10));
  return norm(db) === norm(oficial);
}

/** ¿Es un tipo del vocabulario cerrado? Un tipo inventado por el LLM se descarta (no se inventa nada). */
export const TIPOS_VALIDOS = new Set([
  'oep_aprobada', 'convocatoria_publicada', 'bases_publicadas', 'programa_publicado',
  'plazo_inicio', 'plazo_fin', 'lista_provisional', 'lista_definitiva', 'tribunal_constituido',
  'ejercicio_1', 'ejercicio_2', 'plantilla_respuestas', 'resultados', 'reconocimiento_medico',
  'modificacion_plazas', 'nombramientos', 'otro',
]);

/**
 * Compara lo extraído del documento con lo que mostramos. Devuelve descuadres, NUNCA cambios.
 *
 * Guardarraíles anti-falso-positivo (la lección que más caro ha salido en este subsistema):
 *  · Solo con confianza ALTA. Media/baja no genera hallazgo: un descuadre falso quema el inbox y
 *    entonces nadie mira — que es exactamente cómo se llegó al bug de Marta.
 *  · Sin `cita_literal` no hay hallazgo, aunque el dato venga. Sin evidencia no se acusa.
 *  · Si el dato no está en BD (null), es COBERTURA (warn), no contradicción (error).
 */
export function reconciliar(ext: ProcesoExtraction, db: ProcesoEnBd): Descuadre[] {
  const out: Descuadre[] = [];
  if (ext.confianza !== 'alta') return out;

  const citaDe = (tipo: string): string | null =>
    ext.hitos.find((h) => h.tipo === tipo && h.cita_literal?.trim())?.cita_literal ?? null;

  if (ext.fecha_examen) {
    const cita = citaDe('ejercicio_1');
    if (cita) {
      if (!db.exam_date) {
        out.push({ campo: 'exam_date', db: null, oficial: ext.fecha_examen, cita, severidad: 'warn' });
      } else if (!fechasCuadran(db.exam_date, ext.fecha_examen)) {
        out.push({ campo: 'exam_date', db: db.exam_date.slice(0, 10), oficial: ext.fecha_examen, cita, severidad: 'error' });
      }
    }
  }

  const plazas: Array<[keyof ProcesoEnBd & keyof ProcesoExtraction, string]> = [
    ['plazas_libres', 'plazas_libres'],
    ['plazas_promocion_interna', 'plazas_promocion_interna'],
  ];
  for (const [k, campo] of plazas) {
    const oficial = ext[k] as number | null;
    if (oficial == null) continue;
    const cita = ext.hitos.find((h) => h.cita_literal?.includes(String(oficial)))?.cita_literal ?? null;
    if (!cita) continue;                       // sin evidencia literal, no se acusa
    const actual = db[k] as number | null;
    if (actual == null) {
      out.push({ campo, db: null, oficial: String(oficial), cita, severidad: 'warn' });
    } else if (actual !== oficial) {
      out.push({ campo, db: String(actual), oficial: String(oficial), cita, severidad: 'error' });
    }
  }
  return out;
}

/** Descarta hitos con tipo fuera del vocabulario o sin cita: el LLM no inventa el modelo. */
export function hitosValidos(hitos: HitoExtraido[]): HitoExtraido[] {
  return (hitos ?? []).filter(
    (h) => h && TIPOS_VALIDOS.has(h.tipo) && /^\d{4}-\d{2}(-\d{2})?$/.test(h.fecha ?? '') && !!h.cita_literal?.trim(),
  );
}

/**
 * Cuánto documento se manda. NO es un número al azar (medido 16/07 con el BOCM de Marta):
 * las bases ocupan 97.329 chars y la cláusula que importa —"9. La celebración del primer ejercicio
 * se realizará en mayo de 2027"— está en la posición **34.901**. Con el corte inicial de 12.000 el
 * modelo NUNCA veía el dato que motivó todo el sistema y devolvía fecha_examen:null.
 * Haiku tiene 200k de contexto: un boletín entero cabe de sobra. Truncar barato = ser ciego.
 */
const MAX_CHARS_POR_DOC = 90_000;
const MAX_CHARS_CORPUS = 180_000;

/** Prompt: extraer los HECHOS DEL PROCESO con su cláusula literal. */
export function buildProcesoPrompt(slug: string, documentos: Array<{ titulo: string; texto: string }>): string {
  const corpus = documentos
    .map((d, i) => `\n--- DOCUMENTO ${i + 1}: ${d.titulo} ---\n${d.texto.slice(0, MAX_CHARS_POR_DOC)}`)
    .join('\n')
    .slice(0, MAX_CHARS_CORPUS);

  return `Eres analista de oposiciones españolas. Lee las bases/convocatoria oficiales y extrae los HECHOS DEL PROCESO de "${slug}".

REGLAS ESTRICTAS:
1. SOLO lo que el documento dice LITERALMENTE. Si no aparece, null. NO deduzcas, NO estimes, NO completes con tu conocimiento.
2. Cada hito DEBE llevar "cita_literal": la frase EXACTA del documento que lo respalda. Sin cita, no lo incluyas.
3. Fechas: "YYYY-MM-DD". Si el documento solo da el mes ("mayo de 2027"), usa "YYYY-MM" — NO inventes el día.
3-bis. CIFRAS: si das un número de plazas, esa cifra debe aparecer TAL CUAL en el texto (en dígitos o en letra, p.ej. "ciento siete (107) plazas"). Si no la encuentras escrita, pon null. NO la calcules ni la sumes ni la recuerdes de otra convocatoria.
3-ter. La fecha del examen suele estar en una BASE numerada, a mitad del documento (p.ej. "9. La celebración del primer ejercicio se realizará en..."). Búscala en TODO el texto, no solo al principio.
4. "tipo" SOLO de esta lista: oep_aprobada, convocatoria_publicada, bases_publicadas, programa_publicado, plazo_inicio, plazo_fin, lista_provisional, lista_definitiva, tribunal_constituido, ejercicio_1, ejercicio_2, plantilla_respuestas, resultados, reconocimiento_medico, modificacion_plazas, nombramientos.
5. "confianza": "alta" SOLO si los datos salen explícitos del documento. Si has tenido que interpretar, "media". Si el documento no habla del proceso, "baja".

Devuelve EXCLUSIVAMENTE JSON válido, sin texto fuera:
{"fecha_examen":"<YYYY-MM-DD|YYYY-MM|null>","plazas_libres":<n|null>,"plazas_promocion_interna":<n|null>,"hitos":[{"tipo":"<lista>","fecha":"<YYYY-MM-DD|YYYY-MM>","cita_literal":"<frase EXACTA>"}],"confianza":"alta|media|baja"}
${corpus}`;
}
