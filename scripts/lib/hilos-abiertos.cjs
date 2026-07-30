/**
 * scripts/lib/hilos-abiertos.cjs — NÚCLEO PURO: ¿esta persona tiene MÁS conversaciones
 * abiertas, y alguna es un duplicado de otra?
 *
 * ## Por qué existe (30/07/2026, caso Chema)
 *
 * Cada hilo de feedback es una conversación con su pregunta y su cierre: se responde
 * dentro del hilo donde se preguntó y solo a lo que se preguntó ahí. Juntar dos asuntos en
 * un mensaje deja a la persona con la respuesta donde no preguntó y con el otro hilo mudo.
 *
 * Chema abrió tres: uno pidiendo el Parque Móvil del Estado y DOS IDÉNTICOS, con tres
 * minutos de diferencia, sobre los temas incompletos de Policía Municipal de Madrid. El
 * dossier ya volcaba su historial, pero en una línea plana, sin ids, sin decir cuáles
 * seguían sin responder y sin marcar el duplicado: estaba delante y no se vio. Los dos
 * hilos de Policía Municipal llevaban un día esperando.
 *
 * Aquí se decide, sin base de datos, qué hay que enseñar y con qué aviso.
 */

/** Texto comparable: sin mayúsculas, sin acentos ni signos, con los espacios colapsados. */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ¿Son el mismo asunto? Se exige coincidencia del texto normalizado, no parecido: dos
 * dudas sobre el mismo tema son hilos legítimos distintos, y cerrar uno «por parecido»
 * dejaría una pregunta real sin responder. El duplicado que interesa es el de quien pulsa
 * dos veces o reescribe lo mismo a los minutos.
 */
function mismoAsunto(a, b) {
  const na = normalizar(a);
  const nb = normalizar(b);
  return na.length > 0 && na === nb;
}

/**
 * @param {{id:string, type?:string, status?:string, message?:string, created_at?:string|Date, adminMsgs?:number}[]} feedbacks
 *        TODOS los feedbacks de la persona, el actual incluido.
 * @param {string} idActual  el que se está atendiendo
 * @returns {{otros:Array, sinResponder:Array, duplicados:Array<Array>, aviso:string|null}}
 */
function analizarHilos(feedbacks, idActual) {
  const todos = (feedbacks || []).map((f) => ({ ...f, id: String(f.id) }));
  const actual = String(idActual || '');
  const otros = todos.filter((f) => !f.id.startsWith(actual) && !actual.startsWith(f.id));

  // Sin responder = ningún mensaje nuestro en el hilo. `status` no sirve: un feedback
  // `pending` puede estar respondido y sin cerrar (lo dice el propio manual).
  const sinResponder = otros.filter((f) => (f.adminMsgs ?? 0) === 0);

  // Grupos de texto idéntico (entre todos, incluido el actual: el duplicado puede ser él).
  const grupos = [];
  const vistos = new Set();
  for (const f of todos) {
    if (vistos.has(f.id)) continue;
    const iguales = todos.filter((g) => !vistos.has(g.id) && mismoAsunto(f.message, g.message));
    if (iguales.length > 1) {
      iguales.forEach((g) => vistos.add(g.id));
      // El primero por fecha es al que se responde; el resto se cierra en silencio.
      grupos.push(
        iguales.slice().sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)),
      );
    }
  }

  let aviso = null;
  if (sinResponder.length || grupos.length) {
    const lineas = [];
    if (sinResponder.length) {
      lineas.push(
        `    → 🧵 Esta persona tiene ${sinResponder.length} hilo(s) MÁS sin responder. Cada uno se`,
        '       contesta en SU hilo y solo con lo suyo (no juntes asuntos en un mensaje):',
        ...sinResponder.map(
          (f) =>
            `         · ${f.id.slice(0, 8)} [${f.type || '?'}] ${String(f.message || '').replace(/\s+/g, ' ').slice(0, 60)}`,
        ),
      );
    }
    if (grupos.length) {
      lineas.push('    → 🔁 DUPLICADOS (mismo texto): responde al PRIMERO y cierra el resto en');
      lineas.push('       silencio (finalStatus:resolved sin message). Dos avisos iguales parecen un fallo:');
      grupos.forEach((g) => {
        lineas.push(`         · responder: ${g[0].id.slice(0, 8)}  |  cerrar: ${g.slice(1).map((x) => x.id.slice(0, 8)).join(', ')}`);
      });
    }
    aviso = lineas.join('\n');
  }

  return { otros, sinResponder, duplicados: grupos, aviso };
}

module.exports = { analizarHilos, mismoAsunto, normalizar };
