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

/** Un feedback en uno de estos estados ya está cerrado: no espera respuesta de nadie. */
const ESTADOS_TERMINALES = new Set(['resolved', 'dismissed', 'closed']);

/**
 * ¿Este hilo espera respuesta NUESTRA?
 *
 * ## El fallo que corrige (T-512, 03/08/2026)
 *
 * Antes se medía por «ningún mensaje nuestro en el hilo», descartando el estado a
 * propósito (*«`status` no sirve: un `pending` puede estar respondido y sin cerrar»*). Esa
 * mitad era cierta, pero al ignorar el estado ENTERO daba por vivos los hilos **cerrados**:
 * quien pregunta lo mismo en tres hilos y recibe la respuesta en uno deja los otros dos
 * cerrados y sin un solo mensaje nuestro dentro, o sea marcados «sin responder» **para
 * siempre**.
 *
 * Medido en el banco entero el 03/08: de los 99 hilos que el panel marcaba, **94 estaban
 * cerrados (29 personas) y solo 5 esperaban de verdad**. El 95 % era ruido, y del malo: el
 * panel manda a escribirle a alguien cuyo hilo se cerró hace mes y medio, que es
 * exactamente el mensaje que no hay que mandar (una respuesta que llega tarde es peor que
 * ninguna). Caso que lo destapó: Laura García, cinco hilos marcados y los cinco contestados
 * en su día **en otro hilo suyo** (ella repite la misma pregunta en varios a la vez).
 *
 * ## La señal que se usa ahora, y por qué esa
 *
 * `feedback_conversations.status = 'waiting_admin'` — **la misma que cuenta el panel de
 * admin** (`getAdminFeedbackCounts`, `waitingAdmin`). No se inventa un criterio nuevo: dos
 * puertas al mismo hecho con reglas distintas acaban contradiciéndose.
 *
 * Sin conversación no hay `status` que mirar, y ahí SÍ manda el del feedback: un feedback
 * vivo sin conversación es alguien a quien **no se le puede contestar** (es el hallazgo
 * `feedback_sin_conversacion` del barrido de salud), así que se enseña; uno cerrado, no.
 *
 * **Límite conocido, a propósito:** una conversación `closed` cuyo ÚLTIMO mensaje es del
 * usuario (una réplica: contestamos, el hilo se cerró y la persona volvió a escribir) NO se
 * marca aquí. Son 141 en el banco, casi todas viejas y ya atendidas, y quien vigila eso es
 * `vigia.cjs` con su clase RÉPLICA. Meterlo aquí volvería a llenar el panel de ruido.
 */
function esperaRespuesta(f) {
  if (f.convStatus) return String(f.convStatus) === 'waiting_admin';
  return !ESTADOS_TERMINALES.has(String(f.status || '').toLowerCase());
}

/**
 * @param {{id:string, type?:string, status?:string, convStatus?:string, message?:string, created_at?:string|Date}[]} feedbacks
 *        TODOS los feedbacks de la persona, el actual incluido. `convStatus` = estado de su
 *        conversación (`waiting_admin` si alguna lo está); ausente = no tiene conversación.
 * @param {string} idActual  el que se está atendiendo
 * @returns {{otros:Array, sinResponder:Array, duplicados:Array<Array>, aviso:string|null}}
 */
function analizarHilos(feedbacks, idActual) {
  const todos = (feedbacks || []).map((f) => ({ ...f, id: String(f.id) }));
  const actual = String(idActual || '');
  const otros = todos.filter((f) => !f.id.startsWith(actual) && !actual.startsWith(f.id));

  const sinResponder = otros.filter(esperaRespuesta);

  // Grupos de texto idéntico (entre todos, incluido el actual: el duplicado puede ser él).
  // Solo interesan si AL MENOS DOS siguen esperando: el consejo es «responde a uno y cierra
  // los demás», y no se cierra lo que ya está cerrado. Los tres hilos idénticos de Laura,
  // cerrados en junio, salían aquí mandando cerrar lo que llevaba mes y medio cerrado.
  const grupos = [];
  const vistos = new Set();
  for (const f of todos) {
    if (vistos.has(f.id)) continue;
    const iguales = todos.filter((g) => !vistos.has(g.id) && mismoAsunto(f.message, g.message));
    if (iguales.length > 1) {
      iguales.forEach((g) => vistos.add(g.id));
      if (iguales.filter(esperaRespuesta).length < 2) continue;
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

module.exports = { analizarHilos, esperaRespuesta, mismoAsunto, normalizar };
