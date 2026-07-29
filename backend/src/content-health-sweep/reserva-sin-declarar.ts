/**
 * backend/src/content-health-sweep/reserva-sin-declarar.ts
 *
 * ⚠️ COPIA de `lib/convocatoria/reservaSinDeclarar.cjs` (frontend). El backend NestJS es
 * un paquete AISLADO, mismo patrón que `shuffle/permute.ts` y `benign-signals.ts`.
 * La paridad la vigila el guardarraíl del content-sweep.
 *
 * ¿Estamos publicando una suma que puede ser falsa? Cuando una convocatoria tiene reserva
 * de discapacidad pero NO declara si va dentro del turno libre o aparte
 * (`plazas_discapacidad_incluidas IS NULL`), la vista SSOT tiene que dar un número y
 * supone que va aparte: SUMA. Si iba dentro, publicamos plazas que no existen.
 *
 * Origen: una usuaria vio 51 plazas en el catálogo del Ayuntamiento de Sevilla cuando la
 * convocatoria tiene 46 (29/07/2026).
 */

export interface FilaReserva {
  slug: string;
  plazas_libres: number | null;
  plazas_discapacidad: number | null;
  incluidas: boolean | null;
}

export interface HallazgoReserva {
  slug: string;
  severity: 'warn' | 'error';
  mensaje: string;
  plazas_en_duda: number;
}

/** Gravedad según cuánto puede desviarse el número publicado. */
export function severidadPorDesvio(
  plazasLibres: number | null,
  plazasDiscapacidad: number | null,
): 'warn' | 'error' | null {
  const libres = Number(plazasLibres) || 0;
  const reserva = Number(plazasDiscapacidad) || 0;
  if (!reserva) return null;
  const peso = libres > 0 ? reserva / libres : 1;
  return peso >= 0.1 || reserva >= 20 ? 'error' : 'warn';
}

export function detectarReservaSinDeclarar(filas: FilaReserva[] | null): HallazgoReserva[] {
  const hallazgos: HallazgoReserva[] = [];
  for (const f of filas || []) {
    if (f.incluidas !== null && f.incluidas !== undefined) continue;
    const reserva = Number(f.plazas_discapacidad) || 0;
    if (reserva <= 0) continue;
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
