// lib/backlog/marcaDesplegado.cjs
//
// Al despertar una tarea tras el deploy, marcar su `resume_check` como YA DESPLEGADO.
//
// ── EL DEFECTO QUE ARREGLA ([T-463], 01/08/2026) ────────────────────────────
// `pause --tras-deploy` guarda la espera DOS veces: en la columna `wake_on_deploy_sha` (que es
// lo que la máquina mira) y **en prosa**, dentro del `--falta` que escribe quien pausa
// (*«1) Desplegar FRONTEND. 2) Repetir la medición…»*). Cuando el deploy la despierta, se
// limpia la columna y **el texto se queda intacto**, así que la ficha sigue diciendo «falta
// desplegar» para siempre.
//
// Eso importa porque `list` es el ÚNICO sitio donde mira una persona, y allí **una tarea ya
// desplegada y una bloqueada se ven idénticas**. Medido el 01/08: **10 de 10 tareas** cuyo
// `resume_check` decía «desplegar» tenían el código YA VIVO —3 críticas y varias de dinero—,
// paradas entre 1 y 25 h sin que nadie pudiera saber que estaban listas. El propio código lo
// cantaba sin verlo: imprimía `⏰ T-450 DESPERTADA — ya se puede verificar: 1) Desplegar
// FRONTEND…`, contradiciéndose en la misma línea.
//
// ── POR QUÉ UN PREFIJO Y NO BORRAR EL PASO DEL DEPLOY ───────────────────────
// Borrar es tentador y es peor. El texto es de otra sesión, viene en formatos libres, y quitar
// «1) Desplegar FRONTEND» de *«1) Desplegar FRONTEND. 2) Repetir la medición…»* deja un «2)»
// huérfano y puede llevarse contexto por delante. Además, [T-428] existe justo porque perder el
// cuerpo de una ficha en silencio ya ha costado trabajo real dos veces. Aquí se AÑADE, nunca se
// quita: lo que había sigue legible entero, y delante va una marca corta que resuelve la duda.
//
// La marca es corta A PROPÓSITO: `list` recorta el `resume_check` a 160 caracteres, así que un
// prefijo largo se comería la mitad del preview que se quiere hacer útil.

/** Marca que se antepone. Corta, para no comerse el preview de `list`. */
const MARCA = '✅ DESPLEGADO';

/**
 * ¿Este texto ya lleva la marca? Idempotencia: dos deploys seguidos (o un `deployed` repetido)
 * no pueden apilar dos marcas.
 */
function yaMarcado(resumeCheck) {
  return typeof resumeCheck === 'string' && resumeCheck.trimStart().startsWith(MARCA);
}

/**
 * ¿El texto habla de desplegar? Solo se marca en ese caso: si el pendiente no menciona el
 * deploy, la marca no aporta nada y solo gasta preview.
 */
function mencionaDeploy(resumeCheck) {
  return typeof resumeCheck === 'string' && /despleg|deploy/i.test(resumeCheck);
}

/**
 * Devuelve el `resume_check` con la marca de desplegado delante.
 *
 * @param {string|null|undefined} resumeCheck  texto actual (puede no existir)
 * @param {string|null|undefined} sha          sha desplegado (se recorta a 8)
 * @returns {string|null} texto nuevo, o `null` si no hay que tocar nada (así el llamador
 *                        puede saltarse el UPDATE en vez de reescribir por reescribir).
 */
function marcarDesplegado(resumeCheck, sha) {
  if (typeof resumeCheck !== 'string') return null;
  const texto = resumeCheck.trim();
  if (!texto) return null;
  if (yaMarcado(texto)) return null;
  if (!mencionaDeploy(texto)) return null;

  const corto = typeof sha === 'string' && sha.trim() ? ` ${sha.trim().slice(0, 8)}` : '';
  return `${MARCA}${corto} — falta SOLO verificar: ${texto}`;
}

module.exports = { MARCA, marcarDesplegado, yaMarcado, mencionaDeploy };
