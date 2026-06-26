/**
 * Veredicto de frescura de inscripción: compara la fecha de fin de inscripción
 * que trae una señal (PAG, plazo abierto) con la que el catálogo tiene para la
 * oposición casada. **Solo clasifica — NO escribe nada en el catálogo.**
 *
 * Por qué anotar y no auto-escribir (decisión 26/06):
 *   1. Los matches del sensor pag_empleo son SIEMPRE publicadas (is_active=true,
 *      el matcher filtra por is_active). La NORMA FIJA exige verificar la fuente
 *      oficial antes de tocar datos públicos (landings) → no auto-volcar.
 *   2. El matcher casa por familia+región+grupo y NO distingue escalas dentro de
 *      un cuerpo: la señal de la "Escala de Agentes de Tributos" (Agencia
 *      Tributaria Canaria, plazo→27/07) casó con el "Cuerpo Administrativo
 *      general de Canarias" (que cerró el 23/04). Auto-volcar la fecha de la
 *      señal habría corrompido el registro con datos de OTRA convocatoria.
 *
 * Por eso el sensor escribe el veredicto en `admin_notes` de la señal: el triaje
 * humano ve al instante qué matches son accionables (hueco/conflicto) y cuáles
 * son consistentes (ruido), sin riesgo de corromper el catálogo. El humano aplica
 * el cambio verificado contra BOE (como se hizo con IIPP y con ULE C1 el 26/06).
 */

export type FreshnessVerdict = 'irrelevant' | 'consistent' | 'gap' | 'conflict';

export interface FreshnessResult {
  verdict: FreshnessVerdict;
  /** true = requiere ojos humanos (verificar fuente + actualizar catálogo). */
  actionable: boolean;
  /** Nota legible para `admin_notes` de la señal. */
  note: string;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param catalogDeadline `inscription_deadline` actual de la oposición casada
 *        ('YYYY-MM-DD' o null), o cualquier string que empiece por la fecha.
 * @param signalDeadline  fecha de fin de inscripción detectada por la señal.
 */
export function classifyInscriptionFreshness(
  catalogDeadline: string | null | undefined,
  signalDeadline: string | null | undefined,
): FreshnessResult {
  const sd = signalDeadline ? signalDeadline.slice(0, 10) : null;
  if (!sd || !YMD.test(sd)) {
    return {
      verdict: 'irrelevant',
      actionable: false,
      note: 'señal sin fecha de inscripción usable',
    };
  }
  const cd = catalogDeadline ? catalogDeadline.slice(0, 10) : null;

  if (cd === sd) {
    return {
      verdict: 'consistent',
      actionable: false,
      note: `inscripción consistente con catálogo (fin ${sd})`,
    };
  }
  if (cd === null) {
    return {
      verdict: 'gap',
      actionable: true,
      note: `🔶 catálogo SIN fecha de inscripción; la señal dice fin ${sd} — verificar fuente oficial y actualizar estado/fechas`,
    };
  }
  return {
    verdict: 'conflict',
    actionable: true,
    note: `🔶 fecha distinta: catálogo ${cd} vs señal ${sd} — posible otra convocatoria/escala o nuevo ciclo; verificar fuente antes de tocar el catálogo`,
  };
}
