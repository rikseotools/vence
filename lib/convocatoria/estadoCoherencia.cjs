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
const anio = (v) => { const d = dia(v); return d ? Number(d.slice(0, 4)) : null; };

/**
 * Año MÁS RECIENTE citado en un `boe_reference` en texto libre. Los boletines se referencian de
 * mil formas ("BOP Cádiz nº 28, de 11/02/2026", "BOE núm. 45 de 21 de febrero de 2024",
 * "BOJA 152/2017"), así que se buscan años de 4 cifras en rango plausible y se coge el mayor:
 * si el texto menciona varios (la OEP vieja y la convocatoria nueva), lo que fecha la convocatoria
 * descrita es el más reciente. Devuelve null si no cita ninguno.
 */
function anioMaxCitado(texto) {
  if (!texto) return null;
  const años = String(texto).match(/\b(19|20)\d{2}\b/g);
  if (!años) return null;
  const n = años.map(Number).filter((a) => a >= 1980 && a <= 2100);
  return n.length ? Math.max(...n) : null;
}

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
  // Una oposición NO ACTIVA no la ve nadie: es ficha de catálogo (radar), no landing servida.
  // Su estado puede contradecirse con sus fechas sin que ningún opositor lo lea, así que la
  // incidencia se REGISTRA pero no grita: `error` se reserva para lo que está EN PANTALLA.
  //
  // No es cosmética, es precisión. Medido el 28/07/2026: los 4 errores vivos de este detector eran
  // los 4 de oposiciones inactivas, y el catálogo tiene ~2.500 fichas cuyos plazos vencen a diario
  // → la banda de error se re-llenaría cada noche con cosas que no hay que arreglar hoy. Un
  // indicador que siempre marca algo deja de mirarse (misma lección que T-047, T-113 y T-208).
  //
  // Por defecto NO degrada: solo con `is_active === false` explícito. Si un llamador no trae el
  // campo, se comporta como antes — un dato ausente nunca debe apagar una alarma en silencio.
  const soloCatalogo = o.is_active === false;
  const add = (severidad, regla, mensaje) =>
    out.push({ severidad: soloCatalogo && severidad === 'error' ? 'warn' : severidad, regla, mensaje });

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

  // 5.bis. post-examen mientras la REFERENCIA DE BOLETÍN describe una convocatoria más nueva.
  //
  // Punto ciego que destapó Cádiz (T-211, 28/07/2026): `auxiliar-administrativo-diputacion-cadiz`
  // decía 'examen_realizado' con `exam_date` NULL mientras su propio `boe_reference` citaba
  // "BOP Cádiz nº 28, de 11/02/2026 (44 plz…)" — bases recién publicadas. La landing le decía a
  // 164 personas que su examen ya había pasado. Ninguna regla lo veía porque TODAS comparaban
  // fechas de convocatoria entre sí, y aquí la contradicción es entre el ESTADO y la referencia.
  //
  // Dos bandas, calibradas para no inundar (lección T-113/T-047):
  //  · `error` — la convocatoria se publicó DESPUÉS del examen que el estado da por celebrado.
  //    Imposible dentro de un mismo proceso: o el estado es viejo, o la referencia es de otro ciclo.
  //  · `warn`  — no hay `exam_date` que respalde el estado y la referencia cita un año ≥ el del
  //    examen/hoy. Es sospecha (el caso Cádiz), no certeza: puede ser un proceso realmente
  //    terminado cuya convocatoria salió este mismo año. Se mira, no se da por roto.
  if (POST_EXAMEN.has(e)) {
    const anioRef = anioMaxCitado(o.boe_reference);
    const anioPub = anio(o.boe_publication_date);
    const anioEx = anio(ex);
    const pub = anioPub != null ? dia(o.boe_publication_date) : null;
    if (pub && ex && pub > ex) {
      add('error', 'post_examen_convocatoria_posterior',
        `'${e}' pero la convocatoria se publicó DESPUÉS del examen (${pub} > ${ex}) → la referencia describe otro ciclo, o el estado se quedó viejo`);
    } else if (!ex && anioRef != null && anioRef >= Number(hoy.slice(0, 4))) {
      add('warn', 'post_examen_sin_fecha_ref_actual',
        `'${e}' SIN fecha de examen y con una referencia de boletín de ${anioRef} (${String(o.boe_reference).slice(0, 80)}) → parece una convocatoria NUEVA presentada como proceso terminado`);
    } else if (anioEx != null && anioRef != null && anioRef > anioEx) {
      add('warn', 'post_examen_ref_posterior',
        `'${e}' (examen de ${anioEx}) pero su referencia de boletín cita ${anioRef} → ¿la referencia es ya del ciclo siguiente?`);
    }
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
  anioMaxCitado,
  hoyMadrid,
  POST_EXAMEN,
  CATALOGADA_STALE_DAYS,
};
