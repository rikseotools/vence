/**
 * lib/convocatoria/reservaSinDeclarar.cjs — NÚCLEO PURO: ¿el total de plazas puede estar
 * inflado porque nadie declaró si la reserva de discapacidad va dentro o aparte?
 *
 * ## Por qué existe (29/07/2026, lo reportó Concha Porras)
 *
 * El catálogo enseñaba 51 plazas en el Ayuntamiento de Sevilla cuando la convocatoria
 * tiene 46: sumaba una reserva que va DENTRO del turno libre. El bug de código está
 * arreglado (todas las superficies usan `totalTurnoLibre`) y hay un guardarraíl que
 * impide repetirlo, pero eso solo cubre el caso en que el dato ESTÁ declarado.
 *
 * Queda el hueco de datos, que el propio núcleo T-214 avisaba y nadie vigilaba: cuando
 * `plazas_discapacidad_incluidas` es NULL no se sabe la relación, y la vista SSOT tiene
 * que dar un número, así que **elige suponer que van aparte y suma**. Si resulta que iban
 * dentro, ese total está inflado y nadie se entera.
 *
 * Medido el 29/07: **22 oposiciones activas** con reserva y el flag sin declarar, **228
 * plazas en duda**. Una cifra de plazas es lo primero que mira quien decide si
 * presentarse, así que una de más no es un detalle estético.
 *
 * ## Qué NO es
 *
 * No es "faltan datos": es "estamos publicando una suma que puede ser falsa". Por eso el
 * detector mira solo convocatorias **vivas de oposiciones activas y con reserva > 0** —
 * las que de verdad están enseñando el número a alguien.
 *
 * Se arregla verificando la convocatoria contra su boletín y declarando la columna, nunca
 * suponiendo. Runbook: `docs/runbooks/salud-contenido.md`.
 */

/** Gravedad según cuánto puede desviarse el número publicado. */
function severidadPorDesvio(plazasLibres, plazasDiscapacidad) {
  const libres = Number(plazasLibres) || 0;
  const reserva = Number(plazasDiscapacidad) || 0;
  if (!reserva) return null;
  // Peso de la reserva sobre lo publicado: si es >=10% del turno libre, el número que ve
  // el opositor puede estar bastante lejos de la realidad.
  const peso = libres > 0 ? reserva / libres : 1;
  return peso >= 0.1 || reserva >= 20 ? 'error' : 'warn';
}

/**
 * @param {Array<{slug:string, plazas_libres:number|null, plazas_discapacidad:number|null, incluidas:boolean|null}>} filas
 * @returns {Array<{slug:string, severity:'warn'|'error', mensaje:string, plazas_en_duda:number}>}
 */
function detectarReservaSinDeclarar(filas) {
  const hallazgos = [];
  for (const f of filas || []) {
    if (f.incluidas !== null && f.incluidas !== undefined) continue; // declarado: nada que decir
    const reserva = Number(f.plazas_discapacidad) || 0;
    if (reserva <= 0) continue; // sin reserva no hay suma posible
    const severity = severidadPorDesvio(f.plazas_libres, reserva);
    if (!severity) continue;
    const libres = Number(f.plazas_libres) || 0;
    hallazgos.push({
      slug: f.slug,
      severity,
      plazas_en_duda: reserva,
      mensaje:
        `${f.slug}: se publican ${libres + reserva} plazas suponiendo que las ${reserva} de reserva ` +
        `van APARTE, pero la convocatoria no lo declara. Si van dentro, son ${libres}. ` +
        `Verificar contra el boletín y declarar plazas_discapacidad_incluidas.`,
    });
  }
  return hallazgos.sort((a, b) => b.plazas_en_duda - a.plazas_en_duda);
}

module.exports = { detectarReservaSinDeclarar, severidadPorDesvio };
