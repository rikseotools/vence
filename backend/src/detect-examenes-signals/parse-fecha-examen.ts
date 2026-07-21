/**
 * Parser puro de `convocatoria_notas.llm_extraction.fecha_examen` → fecha ISO única.
 *
 * El detector de notas guarda la fecha tal cual la interpreta el LLM, y eso incluye
 * MUCHAS formas ambiguas que NO se pueden convertir en un día accionable sin humano:
 *   - rangos:            "19-21 de junio de 2026"
 *   - varias fechas:     "14 de mayo de 2026 y 15 de marzo de 2026"
 *   - arrays crudos:     '["14/07/2026", "15/07/2026"]'
 *   - solo mes/año:      "Octubre 2025", "Octubre 2025 (primer ejercicio)"
 *   - texto extra:       "19-21 de junio de 2026 (primera fase); ..."
 *
 * La política es CONSERVADORA a propósito: si el valor no es UNA fecha de día único
 * inequívoca, devolvemos null y la nota se queda en la tabla para triaje manual — NO
 * emitimos una señal con una fecha inventada. Mejor no avisar que avisar mal (la
 * bandeja que grita se aprende a ignorar; así murió `hash_change`).
 *
 * Acepta EXACTAMENTE (match del string completo, sin cola):
 *   - ISO:            2026-07-04
 *   - DD/MM/YYYY:     4/07/2026
 *   - DD-MM-YYYY:     12-05-2025   (ojo: distinto de un rango "19-21 de ...")
 *   - "D de MES de A": 4 de julio de 2026
 */

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** Compone una fecha ISO validando que día/mes/año existan de verdad. */
function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  // Validación real de calendario (rechaza 31/02, etc.) sin depender de locale.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Devuelve la fecha ISO (YYYY-MM-DD) si `raw` es una fecha de día único inequívoca,
 * o null en cualquier otro caso (ambiguo, rango, varias, mes-solo, basura).
 */
export function parseFechaExamen(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (s === '' || s.toLowerCase() === 'null') return null;

  // Rechazo temprano de formas multi-fecha / con cola de texto:
  // arrays JSON, la conjunción " y ", separadores de rango explícitos, o cualquier
  // paréntesis/;/coma que delate texto adicional.
  if (/[[\]]/.test(s)) return null;
  if (/\by\b/i.test(s)) return null;
  if (/[;,()]/.test(s)) return null;

  // ISO: 2026-07-04
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return toIso(+m[1], +m[2], +m[3]);

  // DD/MM/YYYY: 4/07/2026
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return toIso(+m[3], +m[2], +m[1]);

  // DD-MM-YYYY: 12-05-2025 (un solo día; el rango "19-21 de ..." NO llega aquí
  // porque lleva " de " y no casa este patrón puramente numérico).
  m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (m) return toIso(+m[3], +m[2], +m[1]);

  // "D de MES de YYYY": 4 de julio de 2026
  m = /^(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})$/i.exec(s);
  if (m) {
    const mes = MESES[m[2].toLowerCase()];
    if (!mes) return null;
    return toIso(+m[3], mes, +m[1]);
  }

  return null;
}
