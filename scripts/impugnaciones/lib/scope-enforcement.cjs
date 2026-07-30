// scripts/impugnaciones/lib/scope-enforcement.cjs
//
// ENFORCEMENT de la "Regla previa OBLIGATORIA" de docs/runbooks/verificar-epigrafes-scope.md:
// siempre que un usuario (impugnación O feedback) hable de TEMARIO / epígrafe / scope / "no
// entra" / "es de otro tema", la BD de SU oposición debe estar en orden ANTES de resolver
// (Paso 1: epígrafe clonado del oficial → Paso 2: scope↔epígrafe). El código lo comprueba para
// que NO se salte por depender de la memoria de Claude — misma filosofía que el push-guard del
// backlog y las herramientas obligatorias de la cola.
//
// Motivo (caso 24/07, Sara García): se estuvo a punto de rechazar una impugnación de scope como
// "falso positivo" SIN Paso 1. La oposición tenía el scope "verified_correct" (Paso 2) pero el
// epígrafe `never_sourced` (Paso 1 saltado) → el scope se había verificado contra una referencia
// sin validar = FALSO VERDE. Usado por revisar-impugnacion.cjs y revisar-feedback.cjs.

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Frases que delatan una queja de temario/epígrafe/scope (sobre `norm(text)`, sin acentos).
const SCOPE_TRIGGER = /\b(temario|tema|epigrafe|scope|no entra|no aparece|no esta|no figura|falta|fuera del temario|otro tema|otro bloque|no corresponde|deberia entrar|primera parte|1a parte|segunda parte|entra en el|deberia estar|no deberia)\b/i;

/**
 * VERSIÓN DE SOFTWARE — el otro disparador, añadido el 30/07/2026.
 *
 * *«¿Vais a actualizar la parte de informática a Windows 11? Solo está Windows 10»* es una
 * pregunta de TEMARIO con todas las letras, y el patrón de arriba no la tocaba: no dice
 * «temario» ni «no entra». Se respondió investigando por libre, sin abrir el runbook de
 * epígrafes… que tiene la respuesta escrita en su §5-bis desde hace semanas.
 *
 * Y es de las caras de equivocarse: **la versión NO se deduce**. Solo la fija la nota del
 * órgano de selección o la convocatoria, y **la nota puede publicarse DESPUÉS**, así que la
 * respuesta correcta muchas veces es «está sin fijar, lo vigilamos», no una versión.
 */
const VERSION_SOFTWARE_TRIGGER =
  /\b(windows\s*\d+|office\s*(?:365|20\d\d)|microsoft\s*365|word\s*(?:365|20\d\d)|excel\s*(?:365|20\d\d)|outlook\s*(?:365|20\d\d)|version(?:es)?\s+(?:de\s+)?(?:windows|office|word|excel|outlook)|que\s+version)\b/i;

/**
 * @param s          cliente postgres
 * @param text       texto del usuario (descripción de la impugnación o mensajes del feedback)
 * @param oposicion  position_type del usuario (target_oposicion)
 * @param force      forzar el disparo (p.ej. dispute_type==='tema_incorrecto')
 * @returns string   bloque de aviso para imprimir (vacío si no aplica)
 */
async function scopeEnforcement(s, { text, oposicion, force }) {
  const esVersion = VERSION_SOFTWARE_TRIGGER.test(norm(text));
  const triggered = !!force || SCOPE_TRIGGER.test(norm(text)) || esVersion;
  if (!triggered) return '';

  // La duda de VERSIÓN tiene su propio procedimiento y su propia trampa, así que se avisa
  // aparte del bloque de scope: aquí lo que hay que abrir es §5-bis del runbook, no auditar
  // el scope del tema.
  const avisoVersion = esVersion
    ? '\n─── ⚠️ PREGUNTA DE VERSIÓN DE SOFTWARE (Windows/Office) ───\n'
      + '   La versión SE AVERIGUA, NO SE DEDUCE. Solo la fijan dos fuentes:\n'
      + '     1) la NOTA del órgano de selección   2) la convocatoria/programa\n'
      + '   Si ninguna la fija, está SIN FIJAR: se dice tal cual y se sigue vigilando.\n'
      + '   NO existe un criterio de «la más moderna» (borrado el 30/07: invita a contar como\n'
      + '   oficial una versión que nadie ha publicado).\n'
      + '   ⚠️ La nota puede publicarse DESPUÉS de la convocatoria → hay que vigilar hasta el examen.\n'
      + '   → docs/runbooks/verificar-epigrafes-scope.md §5-bis  ·  node scripts/leer-notas-oposicion.cjs <slug>\n'
      + '   → Ojo: puede haber DOS convocatorias vivas con versión distinta (caso Madrid, T-063).\n'
    : '';
  if (esVersion && !SCOPE_TRIGGER.test(norm(text)) && !force && !oposicion) return avisoVersion;
  if (!oposicion) {
    return '\n─── ⚠️ CHECK SCOPE/EPÍGRAFE (§Regla previa OBLIGATORIA — la queja va de temario) ───\n'
      + '   ⚠️ El usuario NO tiene target_oposicion → identifica la oposición a mano y comprueba su verificación\n'
      + '      (Paso 1 epígrafe + Paso 2 scope) antes de resolver — verificar-epigrafes-scope.md.';
  }
  const epi = await s.unsafe(
    `SELECT COALESCE(ev.state,'never_sourced') st, count(*)::int n
     FROM topics t LEFT JOIN topic_epigrafe_verification ev ON ev.topic_id=t.id
     WHERE t.position_type=$1 AND t.is_active GROUP BY 1 ORDER BY 2 DESC`, [oposicion]);
  const sco = await s.unsafe(
    `SELECT COALESCE(sv.state,'never_verified') st, count(*)::int n
     FROM topics t LEFT JOIN topic_scope_verification sv ON sv.topic_id=t.id
     WHERE t.position_type=$1 AND t.is_active GROUP BY 1 ORDER BY 2 DESC`, [oposicion]);
  const neverSourced = epi.find((r) => r.st === 'never_sourced')?.n || 0;
  const scopeOpen = sco.filter((r) => ['verified_issues', 'never_verified', 'stale'].includes(r.st)).reduce((a, r) => a + r.n, 0);
  const fmt = (rows) => rows.map((r) => `${r.st}=${r.n}`).join(', ') || '(sin datos)';
  let out = avisoVersion + '\n─── ⚠️ CHECK SCOPE/EPÍGRAFE (§Regla previa OBLIGATORIA — la queja va de temario) ───\n';
  out += `   Oposición del usuario: ${oposicion}\n`;
  out += `   Paso 1 (epígrafe oficial clonado): ${fmt(epi)}\n`;
  out += `   Paso 2 (scope↔epígrafe):           ${fmt(sco)}\n`;
  // ⚠️ CERO temas ≠ todo en orden. Si la oposición no tiene NINGÚN tema activo, las dos consultas
  // devuelven cero filas → neverSourced=0 y scopeOpen=0 → el semáforo caía en el `else` y pintaba
  // 🟢 «Paso 1 y Paso 2 en orden», que es exactamente lo contrario de la realidad: no hay temario
  // contra el que comprobar nada. Cazado el 28/07 resolviendo la impugnación `1c71e908` (Rocío,
  // `administrativo_de_administracion_general_administracion_local`: 0 temas, 0 topic_scope), donde
  // el dossier dio luz verde sobre la nada. Un verificador que aprueba por ausencia de datos es
  // peor que no tenerlo: da por firme una base que no existe.
  const temasActivos = epi.reduce((a, r) => a + r.n, 0);
  if (temasActivos === 0) {
    out += `   🛑 Esa oposición NO TIENE TEMARIO en la plataforma (0 temas activos), así que la queja no puede\n`
      + `      ser "esta pregunta está en el tema equivocado": no hay temas donde estarlo. Comprueba el\n`
      + `      target_oposicion del usuario y en qué modo de test le salió la pregunta (practice, por leyes…).\n`
      + `      Si la oposición está catalogada pero vacía, es demanda de contenido, no un defecto de scope.`;
    return out;
  }
  if (neverSourced > 0) {
    out += `   🛑 PASO 1 SIN HACER (${neverSourced} temas never_sourced). NO resuelvas aún: clona el epígrafe LITERAL del\n`
      + `      programa_url de la convocatoria a topics.epigrafe y verifica (verify-epigrafe-literality.cjs), LUEGO re-\n`
      + `      verifica el scope. Resolver ahora = comprobar el scope contra una referencia sin validar (falso verde).`;
  } else if (scopeOpen > 0) {
    out += `   ⚠️ El epígrafe está clonado, pero el SCOPE tiene ${scopeOpen} temas sin cerrar (issues/never_verified/stale)\n`
      + `      → revisa el tema implicado contra su epígrafe antes de resolver.`;
  } else {
    out += '   🟢 Paso 1 y Paso 2 en orden para esta oposición → puedes analizar la queja sobre base firme.';
  }
  // Se engancha AQUÍ y no en los llamadores para que salga igual en impugnaciones y en
  // feedback: dos sitios donde imprimirlo son dos sitios donde se puede olvidar.
  // Y va después del semáforo a propósito: el 🟢 de arriba es el que más engaña — el
  // Decreto 53/1989 estaba "en orden" y aun así el scope pedía la mitad de la ley.
  out += await estructuraVsScope(s, { text, oposicion });
  return out;
}

// ¿el texto del usuario es una queja de temario/epígrafe/scope? (parte pura, testeable)
const isScopeComplaint = (text) => SCOPE_TRIGGER.test(norm(text));

// ───────────────────────────────────────────────────────────────────────────────────────
// ESTRUCTURA vs SCOPE (T-223, 28/07/2026)
//
// El bloque de arriba comprueba el ESTADO de verificación. Eso no bastó: el 28/07 una
// usuaria (Luisa) avisó de que del Decreto 53/1989 del T9 de `auxiliar_administrativo_sms`
// solo entraban unos artículos. Se le respondió que no, razonando sobre la PROSA del
// epígrafe ("el decreto entero es el reglamento de funcionamiento"). Tenía razón exacta:
// su rango era, clavados, los Capítulos II y III que el epígrafe nombra por su RÚBRICA
// («funciones y organización del EAP»).
//
// La pieza que faltaba no era criterio, era un DATO en pantalla: los capítulos de la ley
// junto al scope. Quien resuelve no debería tener que deducir la estructura de una norma
// leyendo prosa — y cuando esa estructura NO está en BD, lo peligroso es no enterarse.
// Por eso el caso "sin estructura" se grita en vez de omitirse.
// ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Normas citadas en el texto del usuario, como `número/año`. Pura.
 *
 * Solo interesa el par número/año: es lo que identifica la norma sin depender de cómo la
 * llame cada uno («decreto 53/1989», «Decreto 53/89», «el 53/1989»). Se acepta el año de
 * dos cifras porque los usuarios lo escriben así.
 */
function extraerReferenciasNorma(text) {
  const t = String(text || '');
  const out = new Set();

  // Año de CUATRO cifras: se acepta suelto ("la 39/2015"), porque así lo escriben y el
  // año ya desambigua por sí solo.
  for (const m of t.matchAll(/\b(\d{1,4})\s*\/\s*((?:19|20)\d{2})\b/g)) {
    out.add(`${Number(m[1])}/${m[2]}`);
  }

  // Año de DOS cifras: solo si delante va la palabra de la norma. Sin esa exigencia,
  // "acerté 3/10 preguntas" o "el día 5/12" se leerían como leyes — y como 3/2010 y
  // 5/2012 existen de verdad, el dossier acabaría enseñando la estructura de una norma
  // que el usuario nunca mencionó. Un bloque que a veces habla de otra ley es peor que
  // no tenerlo: enseña a ignorarlo.
  const NORMA = /\b(?:ley(?:es)?\s+organicas?|ley(?:es)?|real(?:es)?\s+decretos?(?:[-\s]leyes?)?|decretos?(?:\s+legislativos?)?|rdl?|rd|orden|reglamento|directiva)\s*\.?\s*(?:n[.º°]?\s*)?(\d{1,4})\s*\/\s*(\d{2})\b(?!\d)/gi;
  // Normalización propia: `norm()` no sirve aquí porque borra la BARRA junto con el resto
  // de la puntuación, y sin barra no hay referencia que extraer. Aquí solo hacen falta
  // minúsculas y quitar tildes ("Decreto"/"decreto", "Orden"/"orden").
  const suave = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const m of suave.matchAll(NORMA)) {
    const n2 = Number(m[2]);
    // Ventana igual que en las citas legales: dos cifras altas son del siglo XX.
    out.add(`${Number(m[1])}/${n2 > 50 ? 1900 + n2 : 2000 + n2}`);
  }
  return [...out];
}

/** ¿El artículo `n` cae dentro de la sección? Pura. */
const enSeccion = (sec, n) =>
  Number.isFinite(n) &&
  n >= (sec.article_range_start ?? -Infinity) &&
  n <= (sec.article_range_end ?? Infinity);

/**
 * Estructura de la ley enfrentada al scope del tema. Pura: recibe datos, devuelve texto.
 *
 * @param {object} p
 * @param {string} p.ley         nombre corto de la ley
 * @param {number|string} p.tema número de tema
 * @param {string[]|null} p.scope  `article_numbers` (null = la ley ENTERA)
 * @param {object[]} p.secciones filas de `law_sections` (vacío = sin estructura en BD)
 * @param {string} [p.epigrafe]  epígrafe del tema, para poder cotejar rúbricas a ojo
 */
function formatEstructuraVsScope({ ley, tema, scope, secciones, epigrafe }) {
  const nums = (scope || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const resumen = scope === null || scope === undefined
    ? 'LEY ENTERA (article_numbers NULL)'
    : `${nums.length} arts (${nums.length ? `${nums[0]}-${nums[nums.length - 1]}` : '—'})`;

  let out = `\n   📐 ESTRUCTURA vs SCOPE — ${ley} · T${tema}\n`;
  out += `      scope actual: ${resumen}\n`;
  if (epigrafe) out += `      epígrafe:     "${String(epigrafe).slice(0, 200)}"\n`;

  if (!secciones || !secciones.length) {
    // El caso peligroso. Sin estructura no se puede mapear "funciones y organización" a
    // unos artículos, y el hueco es INVISIBLE si no se dice.
    out += `      🛑 SIN ESTRUCTURA EN BD (law_sections vacío para esta ley) — [T-140]\n`
      + `         NO deduzcas los capítulos de la prosa del epígrafe: es justo el error del\n`
      + `         28/07 (Decreto 53/1989, usuaria Luisa) que dio un "no" a quien tenía razón.\n`
      + `         Baja el índice de la fuente oficial (BOE/boletín autonómico) y mapea\n`
      + `         epígrafe → capítulos → artículos ANTES de responder.`;
    return out;
  }

  const ordenadas = [...secciones].sort(
    (a, b) => (a.order_position ?? 0) - (b.order_position ?? 0) || (a.article_range_start ?? 0) - (b.article_range_start ?? 0),
  );
  const fuera = [];
  for (const sec of ordenadas) {
    const dentro = nums.filter((n) => enSeccion(sec, n));
    const total = (sec.article_range_end ?? 0) - (sec.article_range_start ?? 0) + 1;
    const cubre = scope === null || scope === undefined ? total : dentro.length;
    const etiqueta = `${sec.section_type || 'sección'} ${sec.section_number || '?'}`.trim();
    const rango = `${sec.article_range_start ?? '?'}-${sec.article_range_end ?? '?'}`;
    const marca = cubre === 0 ? '  ⟵ FUERA del scope' : cubre < total ? '  ⟵ PARCIAL' : '';
    out += `      ${etiqueta.padEnd(16)} ${String(rango).padEnd(9)} ${String(sec.title || '').slice(0, 52).padEnd(52)} ${cubre}/${total}${marca}\n`;
    if (cubre === 0) fuera.push(etiqueta);
  }
  out += `      → Comprueba que cada bloque escopado lo pide el epígrafe, y que ninguno que sí\n`
    + `        pida se haya quedado fuera. Si el epígrafe nombra materias ("funciones",\n`
    + `        "organización"), cásalas con las RÚBRICAS de arriba, no con la prosa.`;
  if (fuera.length) out += `\n      (bloques hoy fuera del scope: ${fuera.join(', ')})`;
  return out;
}

/**
 * Busca en la oposición del usuario las leyes que ha citado y añade su estructura.
 * Best-effort: si algo falla o no cita ninguna norma, no estorba (devuelve '').
 */
async function estructuraVsScope(s, { text, oposicion }) {
  if (!oposicion) return '';
  const refs = extraerReferenciasNorma(text);
  if (!refs.length) return '';
  try {
    const filas = await s.unsafe(
      `SELECT l.id law_id, l.short_name ley, t.topic_number tema, t.epigrafe, ts.article_numbers
         FROM topic_scope ts
         JOIN topics t ON t.id = ts.topic_id
         JOIN laws   l ON l.id = ts.law_id
        WHERE t.position_type = $1 AND t.is_active
          AND (l.short_name ILIKE ANY($2) OR l.name ILIKE ANY($2))
        ORDER BY t.topic_number
        LIMIT 6`,
      [oposicion, refs.map((r) => `%${r}%`)],
    );
    if (!filas.length) return '';
    let out = '';
    for (const f of filas) {
      const secs = await s.unsafe(
        `SELECT section_type, section_number, title, article_range_start, article_range_end, order_position
           FROM law_sections WHERE law_id = $1 AND is_active ORDER BY order_position`,
        [f.law_id],
      );
      out += formatEstructuraVsScope({
        ley: f.ley, tema: f.tema, scope: f.article_numbers, secciones: secs, epigrafe: f.epigrafe,
      });
    }
    return out;
  } catch (e) {
    // Nunca tumbar el dossier por esto: sin el bloque se resuelve peor, sin dossier no se
    // resuelve. Pero que se vea que faltó.
    return `\n   ⚠️ (no se pudo cargar la estructura de la ley: ${e.message})`;
  }
}

module.exports = {
  norm, SCOPE_TRIGGER, scopeEnforcement, isScopeComplaint,
  extraerReferenciasNorma, formatEstructuraVsScope, enSeccion, estructuraVsScope,
};
