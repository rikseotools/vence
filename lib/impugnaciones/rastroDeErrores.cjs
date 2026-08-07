// Núcleo PURO del bloque «RASTRO DE ERRORES» del dossier de feedback (T-649).
//
// POR QUÉ EXISTE (caso Lourdes, feedback `e790c7bf`, 06-07/08/2026):
// escribió que la app «se queda colgada… cuando termino un test y quiero hacer otro». Se le
// contestó que era el configurador de artículos ([T-623]) y **replicó que no**: *«en ningún
// momento he configurado un test con muchos artículos»*. La causa real era otra
// (`/api/v2/answer-and-save` saturado, [T-315]).
//
// Lo que falló NO fue el análisis, fue la EVIDENCIA que el dossier ponía delante: leía solo
// `user_interactions` (12 clics) y **jamás miraba `observable_events`**, que es donde estaban
// sus errores. Sin ese rastro, la causa se elige por parecido con la avería que uno tiene en la
// mano — y ese día [T-623] se acababa de abrir.
//
// Las DOS reglas que este núcleo hace visibles, y que son las que se saltaron:
//
//   1. **ANTES y DESPUÉS del mensaje no valen lo mismo.** Solo lo ANTERIOR puede explicar lo que
//      la persona cuenta. En el caso real los dos `http_4xx 494` del configurador —la evidencia
//      con la que se le respondió— ocurrieron a las 17:50 y 17:55, o sea **DESPUÉS** de escribir
//      ella a las 17:45; el error del momento que describía (17:05, al terminar un test) era
//      `answerSaveQueue syncOne network`. Mezclados en una lista por fecha, el que encaja con la
//      ficha abierta se lee igual de bien que el que encaja con sus palabras.
//   2. **«No hay rastro» tiene que poder decirse.** Si la ventana sale vacía, el dossier lo dice
//      con todas las letras en vez de callar, porque un bloque mudo se lee como «no miré» y
//      empuja otra vez a suponer. (Principio de la casa: «no lo sé» tiene que poder decirse.)
//
// Puro a propósito: sin IO, sin SQL y sin `Date.now()` implícito — el instante de referencia es
// siempre el `created_at` del feedback, así que el mismo caso se reproduce igual dentro de un año.

const HORA_MS = 60 * 60 * 1000;

// Ventana de referencia. Asimétrica a propósito:
//  · 3 h ANTES — un usuario escribe un rato después de sufrir el fallo (Lourdes tardó 40 min), y
//    una sesión de estudio entera cabe en tres horas. Más ancho empieza a traer ruido de otro día.
//  · 30 min DESPUÉS — no sirve para explicar lo que reporta, pero SÍ para ver si sigue pasando
//    mientras escribe. Se muestra aparte y etiquetado, nunca mezclado.
const VENTANA_ANTES_MS = 3 * HORA_MS;
const VENTANA_DESPUES_MS = 0.5 * HORA_MS;

const fecha = (ev) => new Date(ev.created_at || ev.ts);

/** Ventana [desde, hasta] alrededor del instante en que la persona escribió. */
function ventanaRastro(creado) {
  const t = new Date(creado).getTime();
  return { desde: new Date(t - VENTANA_ANTES_MS), hasta: new Date(t + VENTANA_DESPUES_MS) };
}

/**
 * Qué convierte dos eventos en «el mismo fallo». El `component` de `metadata` es lo que de
 * verdad identifica el defecto en el cliente (`answerSaveQueue syncOne network` dice mucho más
 * que `client_error`), así que manda sobre el tipo; el endpoint y el status lo hacen en servidor.
 */
function firmaEvento(ev) {
  const meta = ev.metadata && typeof ev.metadata === 'object' ? ev.metadata : {};
  const componente = meta.component || null;
  const endpoint = ev.endpoint || meta.url || null;
  return {
    componente,
    endpoint,
    http_status: ev.http_status || meta.status || null,
    firma: [ev.event_type, componente || '', endpoint || '', ev.http_status || meta.status || ''].join('|'),
  };
}

/**
 * Agrupa los eventos en dos cubos (antes / después del mensaje) y, dentro de cada uno, por firma.
 * Devuelve grupos ordenados por «lo que más se repite primero», que es donde suele estar el fallo
 * de verdad y no el ruido de una vez.
 */
function agruparRastro(eventos, creado) {
  const t = new Date(creado).getTime();
  const cubos = { antes: new Map(), despues: new Map() };

  for (const ev of eventos || []) {
    const cuando = fecha(ev);
    if (Number.isNaN(cuando.getTime())) continue; // un evento sin fecha no se puede situar: no opina
    const { firma, componente, endpoint, http_status } = firmaEvento(ev);
    const cubo = cuando.getTime() <= t ? cubos.antes : cubos.despues;
    const g = cubo.get(firma) || {
      firma, event_type: ev.event_type, severity: ev.severity,
      componente, endpoint, http_status, n: 0, primero: cuando, ultimo: cuando,
    };
    g.n += 1;
    if (cuando < g.primero) g.primero = cuando;
    if (cuando > g.ultimo) g.ultimo = cuando;
    // `error` manda sobre `warn` cuando el mismo fallo emite las dos.
    if (ev.severity === 'error') g.severity = 'error';
    cubo.set(firma, g);
  }

  const ordenar = (m) => [...m.values()].sort((a, b) => b.n - a.n || b.ultimo - a.ultimo);
  return { antes: ordenar(cubos.antes), despues: ordenar(cubos.despues) };
}

const hhmm = (d) => new Date(d).toISOString().slice(11, 16);

function lineaGrupo(g) {
  const que = g.componente || g.endpoint || '(sin componente)';
  const status = g.http_status ? ` ${g.http_status}` : '';
  const cuando = g.n > 1 ? `${hhmm(g.primero)}→${hhmm(g.ultimo)}` : hhmm(g.primero);
  return `     ${String(g.n).padStart(3)}× ${cuando}  ${g.event_type}${status} · ${que}`;
}

/**
 * Las líneas que se imprimen en el dossier. Devuelve SIEMPRE contenido —incluso vacío— porque un
 * bloque que desaparece cuando no hay datos es indistinguible de un bloque que nadie miró.
 */
function lineasRastro(grupos, opciones = {}) {
  const { antes = [], despues = [] } = grupos || {};
  const { creado } = opciones;
  const out = ['\n─── 🩺 RASTRO DE ERRORES DE ESTA PERSONA (observable_events) ───'];

  if (!antes.length && !despues.length) {
    out.push('   (SIN RASTRO en su cuenta en la ventana del aviso: -3 h / +30 min)');
    out.push('   ⚠️ Que no haya rastro es un HALLAZGO, no un permiso para suponer: dilo tal cual');
    out.push('      («no vemos nada en tu cuenta que lo explique») en vez de atribuirlo a una avería conocida.');
    return out;
  }

  out.push(`   ANTES del mensaje${creado ? ` (${hhmm(new Date(new Date(creado).getTime() - VENTANA_ANTES_MS))}→${hhmm(creado)})` : ''} — lo ÚNICO que puede explicar lo que cuenta:`);
  if (antes.length) antes.forEach((g) => out.push(lineaGrupo(g)));
  else out.push('     (nada: ningún error suyo en las 3 h previas)');

  if (despues.length) {
    out.push('   DESPUÉS de escribir — NO explica su aviso (pero dice si sigue pasando):');
    despues.forEach((g) => out.push(lineaGrupo(g)));
  }

  out.push('   ▶ La causa que le cuentes tiene que salir de la columna ANTES. Si lo que encaja con');
  out.push('     una ficha abierta está solo en DESPUÉS —o no está—, no es su caso (caso Lourdes, T-649).');
  return out;
}

module.exports = {
  VENTANA_ANTES_MS, VENTANA_DESPUES_MS,
  ventanaRastro, firmaEvento, agruparRastro, lineasRastro,
};
