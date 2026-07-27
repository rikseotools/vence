// lib/convocatoria/estadoCoherencia.cjs — núcleo PURO: ¿el `estado_proceso` de una oposición
// se contradice con sus PROPIAS fechas (o con lo que el front muestra)?
//
// Sin BD, sin red, sin reloj propio (el "hoy" se inyecta) → testeable en aislamiento.
//
// ## Por qué existe (27/07/2026)
//
// La lógica llevaba desde el 18/06 dentro de `scripts/audit-estados-convocatoria.cjs`, un CLI que
// corre a diario como cron y escupe su resultado a un log/email. Funcionaba, pero vivía en un
// SILO: sus hallazgos (1 error + 34 avisos el 27/07) NO entraban en `content_health_findings`, así
// que no aparecían ni en el badge del nav ni en `/admin/contenido`, que es donde se mira todo lo
// demás. Un detector que nadie ve es un detector que no existe.
//
// Al extraer el núcleo aquí, la MISMA lógica alimenta las tres superficies sin duplicarse:
//   · `scripts/audit-estados-convocatoria.cjs`  (CLI / cron, informe legible + gate)
//   · `scripts/health-sweep.cjs`                (barrido CLI → findings)
//   · `backend/src/content-health-sweep`        (@Cron en producción → findings)
//
// Patrón de la casa: la lógica en .cjs (lo requieren los scripts con `node` pelado) y un wrapper
// tipado en `estadoCoherencia.ts` para la app y el backend. Igual que `seguimientoUrlSalud`.
//
// ## Qué NO hace
//
// No consulta boletines ni adivina el estado correcto: solo detecta CONTRADICCIONES INTERNAS
// (deterministas, sin IA). Decidir el estado real exige fuente oficial y es trabajo humano —
// ver `docs/runbooks/verificar-convocatorias.md`.

/** Estados posteriores al examen: no pueden tener el examen en el futuro. */
const POST_EXAMEN = new Set(['examen_realizado', 'resultados', 'nombramientos']);
/** Días sin verificar el radar tras los que la fecha de una catalogada visible deja de ser fiable. */
const CATALOGADA_STALE_DAYS = 30;

const dia = (v) => (v ? String(v).slice(0, 10) : null);

/** Espejo de `isInscripcionAbierta()` (lib/oposiciones/inscripcion.ts): el front filtra por FECHAS. */
function abiertaPorFechas(o, hoy) {
  const start = dia(o.inscription_start);
  const dl = dia(o.inscription_deadline);
  return !!start && !!dl && start <= hoy && dl >= hoy;
}

/** Espejo de `isShowableCatalogada()`: catalogada (is_active=false) + abierta + con url oficial. */
function catalogadaVisible(o, hoy) {
  return !o.is_active && abiertaPorFechas(o, hoy) && !!o.seguimiento_url;
}

/**
 * Devuelve las incoherencias de UNA oposición. `hoy` en formato 'YYYY-MM-DD' (Europe/Madrid:
 * el front deriva "abierta hoy" en Madrid, auditar en UTC compararía con el día equivocado
 * de madrugada).
 *
 * Cada incidencia: { severidad: 'error'|'warn', regla, mensaje }.
 *  · `error` = contradicción CLARA (el dato es imposible tal cual está).
 *  · `warn`  = sospecha o dato incompleto (puede ser legítimo, hay que mirarlo).
 */
function detectarIncoherenciasEstado(o, hoy) {
  const out = [];
  const add = (severidad, regla, mensaje) => out.push({ severidad, regla, mensaje });

  const e = o.estado_proceso;
  const dl = dia(o.inscription_deadline);
  const ex = dia(o.exam_date);
  const start = dia(o.inscription_start);

  if (!e) {
    add('warn', 'estado_vacio', 'estado_proceso vacío');
    return out;
  }

  // 1. inscripcion_abierta: el plazo NO puede haber vencido ni faltar
  if (e === 'inscripcion_abierta') {
    if (!dl) add('warn', 'abierta_sin_cierre', "'inscripcion_abierta' SIN fecha de cierre (incompleto/sospechoso de stale)");
    else if (dl < hoy) add('error', 'abierta_plazo_vencido', `'inscripcion_abierta' con plazo VENCIDO (${dl} < ${hoy}) → debe avanzar a inscripcion_cerrada/posterior`);
  }

  // 2. convocada: si ya pasó el plazo, debió avanzar
  if (e === 'convocada' && dl && dl < hoy) {
    add('warn', 'convocada_plazo_vencido', `'convocada' pero el plazo de inscripción (${dl}) ya venció → ¿inscripcion_cerrada?`);
  }

  // 3. inscripcion_cerrada con el plazo aún en el futuro
  if (e === 'inscripcion_cerrada' && dl && dl > hoy) {
    add('warn', 'cerrada_plazo_futuro', `'inscripcion_cerrada' pero el plazo (${dl}) aún no ha vencido (contradicción)`);
  }

  // 4. pendiente_examen: el examen no puede haber pasado; debería tener fecha
  if (e === 'pendiente_examen') {
    if (!ex) add('warn', 'pendiente_sin_fecha', "'pendiente_examen' SIN fecha de examen");
    else if (ex < hoy && !o.exam_date_approximate) add('error', 'pendiente_examen_pasado', `'pendiente_examen' con examen YA PASADO (${ex} < ${hoy}) → debe ser examen_realizado/resultados`);
  }

  // 5. post-examen con examen futuro = imposible
  if (POST_EXAMEN.has(e) && ex && ex > hoy) {
    add('error', 'post_examen_futuro', `'${e}' pero el examen es FUTURO (${ex} > ${hoy}) → contradicción`);
  }

  // 6. start <= deadline
  if (start && dl && start > dl) {
    add('warn', 'start_despues_deadline', `inscription_start (${start}) posterior al deadline (${dl})`);
  }

  // 7. coherencia con el FRONT: home/SEO/banner filtran por FECHAS, no por estado_proceso.
  //    Si divergen, el dato está mal en algún lado (incidente 20/06/2026).
  if (o.is_active) {
    const abierta = abiertaPorFechas(o, hoy);
    if (e === 'inscripcion_abierta' && !abierta) {
      const motivo = !start ? 'sin inscription_start' : !dl ? 'sin deadline' : `plazo vencido (${dl})`;
      add('error', 'abierta_invisible_en_front', `estado 'inscripcion_abierta' pero NO abierta-por-fechas (${motivo}) → invisible en el front`);
    } else if (abierta && e !== 'inscripcion_abierta') {
      add('warn', 'abierta_por_fechas_otro_estado', `abierta-por-fechas pero estado='${e}' → aparece en el front; reconciliar estado`);
    }
  } else if (catalogadaVisible(o, hoy)) {
    // 8. catalogadas visibles en /oposiciones/inscripcion-abierta: son superficie de usuario.
    if (e !== 'inscripcion_abierta') {
      add('warn', 'catalogada_visible_otro_estado', `CATALOGADA visible en el front (abierta) pero estado='${e}' → reconciliar`);
    }
    const lc = dia(o.seguimiento_last_checked);
    if (!lc) {
      add('warn', 'catalogada_sin_verificar', 'CATALOGADA visible en el front pero el radar NUNCA la verificó (seguimiento_last_checked NULL) → fecha sin garantía');
    } else {
      const days = Math.floor((Date.parse(hoy) - Date.parse(lc)) / 86400000);
      if (days > CATALOGADA_STALE_DAYS) {
        add('warn', 'catalogada_radar_stale', `CATALOGADA visible en el front pero el radar no la verifica hace ${days}d (>${CATALOGADA_STALE_DAYS}) → posible fecha stale`);
      }
    }
  }

  return out;
}

/** 'YYYY-MM-DD' de hoy en Europe/Madrid (el front deriva "abierta hoy" en Madrid). */
function hoyMadrid(now) {
  return (now || new Date()).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

module.exports = {
  detectarIncoherenciasEstado,
  abiertaPorFechas,
  catalogadaVisible,
  hoyMadrid,
  POST_EXAMEN,
  CATALOGADA_STALE_DAYS,
};
