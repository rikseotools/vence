// lib/flota/bucle.cjs — las decisiones del supervisor CONTINUO. (T-486, 06/08)
//
// ── POR QUÉ EXISTE, MEDIDO ──────────────────────────────────────────────────────────────────
// Pregunta de Manuel: *«¿por qué el supervisor no les da tareas continuamente? así no es
// productivo»*. Tenía razón y la causa era que **no existía ningún programador**: `repartir` se
// ejecutaba a mano, así que la flota trabajaba exactamente mientras alguien estuviera mirándola.
// Medido ese día: w2, w3 y w4 terminaron su turno y estuvieron ~30 min encendidos sin hacer nada.
//
// Hay DOS arreglos y hacen falta los dos, porque atacan momentos distintos:
//   · **dentro** del turno → el encargo ahora dice ENCADENA (`lib/flota/encargo.cjs`): al cerrar
//     una tarea, coger otra mientras quede contexto. Aprovecha el arranque ya pagado.
//   · **entre** turnos → esto: cuando un trabajador termina de verdad (contexto agotado), alguien
//     tiene que empezarle uno nuevo. Ese alguien es este bucle.
//
// ── LO QUE ESTE FICHERO DECIDE, Y LO QUE NO ─────────────────────────────────────────────────
// NO decide a quién ni qué se reparte: eso ya lo sabe `flota.cjs repartir`, y el bucle lo INVOCA
// en vez de reimplementarlo (una segunda copia de la criba acabaría entregando cosas distintas
// según quién repartiera). Aquí viven solo las decisiones del bucle en sí: cuándo volver a pasar,
// cuándo NO tocar nada, y cuándo un turno lleva demasiado tiempo abierto.
//
// ── FALLA CERRADO, y esto es lo contrario que el resto del andamiaje ─────────────────────────
// Casi todo aquí es fail-OPEN: si la BD no responde, se deja pasar, porque hay una persona
// delante que puede juzgar. Un bucle desatendido no tiene a nadie: repartir a ciegas significa
// lanzar turnos sin saber quién está ocupado ni qué está cogido, y eso duplica trabajo en vez de
// crearlo. Sin señal, NO se reparte.
'use strict'

/** Cada cuánto pasa el bucle, en segundos. Diez minutos: un turno dura bastante más que eso. */
const CADA_S = 600

/**
 * Con nada que repartir, se espera MÁS. No es cortesía: cada pasada abre conexiones a RDS y una
 * ronda de SSH por máquina, y con la flota llena eso es puro ruido. Techo a 1 h para que un
 * trabajador que se libera no espere media tarde.
 */
const CADA_MAX_S = 3600

/**
 * Un turno más largo que esto es sospechoso. Calibrado con el caso REAL del 06/08: un `git commit`
 * de w1 se quedó **2 h** con un worker de jest al 99,8% de CPU (bucle infinito en un test, no
 * lentitud: los otros tres workers ociosos y la carga clavada en 1,00). Nadie se enteró, y el
 * trabajo sin commitear estuvo dos horas en riesgo.
 *
 * 90 min y no menos: un turno legítimo con tests completos y varias tareas encadenadas puede
 * pasar de una hora, y un aviso que salta con trabajo normal se aprende a ignorar.
 */
const ATASCADO_MIN = 90

/**
 * Cuánto esperar hasta la siguiente pasada.
 *
 * ⚠️ «CERO ENCARGOS» SIGNIFICABA DOS COSAS OPUESTAS, y por eso el ritmo iba al revés (T-642,
 * 07/08/2026). Se espaciaba siempre que no se repartía nada, tanto si **no había trabajo** —donde
 * espaciar es correcto— como si **la flota estaba llena**, que es justo cuando hay que volver
 * pronto: un turno termina cuando quiere, y al terminar el trabajador se queda parado hasta la
 * siguiente pasada. Medido ese día: 5 → 8 → 11 → 17 → **25 min** con los tres trabajadores
 * ocupados; cuando sus turnos murieron, tardaron media hora en volver. **Cuanto mejor iba todo,
 * más tarde se enteraba de que había dejado de ir.**
 *
 * Ahora la espera crece con la CALMA, no con la ocupación.
 *
 * @param {{repartidos:number, ocupados?:number, cada?:number, anterior?:number}} p
 * @returns segundos
 */
function siguientePausa({ repartidos, ocupados = 0, cada = CADA_S, anterior = null, fallo = false }) {
  // ⚠️ UNA PASADA QUE FALLA NO ES CALMA — ES AVERÍA, Y HAY QUE VOLVER PRONTO (T-693, 08/08/2026).
  // Antes el fallo caía en la rama de abajo y espaciaba como si no hubiera nada que hacer. El
  // 08/08 la máquina estaba tan ahogada que el supervisor no pudo ni lanzar un `node`
  // (`spawnSync ETIMEDOUT`) y su reacción fue **esperar 60 minutos más**, con 8 entregas paradas
  // y la máquina ya libre diez minutos después. Cuanto peor iba el sistema, más tarde volvía a
  // mirar. El back-off por calma y el reintento por avería son cosas distintas.
  if (fallo) return cada
  if (repartidos > 0) return cada                       // hay movimiento: ritmo normal
  // Flota llena: no se reparte porque no HACE FALTA, no porque no haya nada. Ritmo normal, que
  // es cuando pueden estar acabando.
  if (ocupados > 0) return cada
  const base = anterior && anterior > 0 ? anterior : cada
  return Math.min(CADA_MAX_S, Math.round(base * 1.5))   // de verdad no hay nada que hacer: espaciar
}

// ── EL DATO DEL RITMO DEJA DE VIAJAR EN PROSA (T-693) ────────────────────────────────────────
// `siguientePausa` estaba BIEN desde [T-642]; lo que fallaba es que `ocupados` **no le llegaba**.
// El bucle lo sacaba raspando el texto del subproceso con `/·\s*(\d+)\s+ocupado/`, y `repartir`
// tiene DOS finales: uno dice `1 encargo(s) repartido(s) · 3 ocupado(s)` —que casa— y el otro
// `nada que repartir: 4 trabajador(es) vivo(s), todos con tarea` —que **no lleva esa palabra**—.
// Resultado: `ocupados = 0`, el bucle creía que no había nadie trabajando y espaciaba hasta 60 min
// con los cuatro ocupados. Un valor que gobierna el ritmo del sistema no puede depender de cómo
// esté redactada una frase en español.
//
// Ahora `repartir` emite SIEMPRE una última línea marcada y el bucle la lee. Productor y lector
// viven en este mismo módulo a propósito: si se separan, vuelven a divergir.
const MARCA_PASADA = '##flota-pasada'

/** La línea que `repartir` imprime al terminar, pase lo que pase. */
function lineaPasada({ repartidos = 0, ocupados = 0 } = {}) {
  return `${MARCA_PASADA} ${JSON.stringify({ repartidos: Number(repartidos) || 0, ocupados: Number(ocupados) || 0 })}`
}

/**
 * Lee el resultado de una pasada de la salida del subproceso.
 *
 * Cae a la lectura VIEJA (raspar el texto) si no encuentra la marca, para que un supervisor nuevo
 * hablando con un `repartir` viejo —o al revés, mientras los clones se ponen al día— siga
 * funcionando en vez de leer ceros. Degradar, no reventar; y `fuente` lo dice para poder medirlo.
 *
 * @returns {{repartidos:number, ocupados:number, fuente:'marca'|'texto'|'ninguna'}}
 */
function leerPasada(salida) {
  const txt = String(salida || '')
  const m = txt.match(new RegExp(`${MARCA_PASADA}\\s+(\\{[^\\n]*\\})`))
  if (m) {
    try {
      const d = JSON.parse(m[1])
      return { repartidos: Number(d.repartidos) || 0, ocupados: Number(d.ocupados) || 0, fuente: 'marca' }
    } catch { /* marca corrupta: se sigue con el camino viejo */ }
  }
  const r = txt.match(/(\d+)\s+encargo\(s\) repartido/)
  const o = txt.match(/·\s*(\d+)\s+ocupado/)
  if (!r && !o) return { repartidos: 0, ocupados: 0, fuente: 'ninguna' }
  return { repartidos: r ? Number(r[1]) : 0, ocupados: o ? Number(o[1]) : 0, fuente: 'texto' }
}

/**
 * Lee la salida del registro del núcleo y cuenta las muertes por falta de memoria. (T-647)
 *
 * ── POR QUÉ ESTO TIENE QUE EXISTIR ──────────────────────────────────────────────────────────
 * El 07/08 hubo **20 OOM en 6 h** en la máquina de la flota, matando turnos de trabajadores y al
 * propio supervisor, y **no lo vio nadie**: se encontró por casualidad, mirando por qué el
 * supervisor había cambiado de PID. Todo lo demás de esta casa se mira en el panel de salud; esto
 * solo estaba en `journalctl`, o sea en ningún sitio.
 *
 * @param texto  salida de `journalctl` (líneas «Out of memory: Killed process N (nombre)»)
 * @returns {{muertes:number, victimas:Object<string,number>}}
 */
function muertesPorMemoria(texto) {
  const victimas = {}
  let muertes = 0
  for (const m of String(texto || '').matchAll(/Killed process \d+ \(([^)]+)\)/g)) {
    muertes++
    victimas[m[1]] = (victimas[m[1]] || 0) + 1
  }
  return { muertes, victimas }
}

/**
 * ¿Hay YA otro supervisor repartiendo, y no soy yo? (T-642, 07/08/2026)
 *
 * ── POR QUÉ HACÍA FALTA ─────────────────────────────────────────────────────────────────────
 * Este fichero ya avisa, arriba, de que dos programadores para una sola flota entregan cosas
 * distintas según quién corra — y por eso [T-617] colapsó los dos que había EN EL CÓDIGO. Lo que
 * nadie impedía es tener dos PROCESOS del bueno: el 07/08 el supervisor llevaba horas corriendo
 * como servicio en el VPS mientras alguien lanzaba otro desde el portátil, cada uno con su reloj
 * y su ronda de SSH sobre los mismos cuatro trabajadores. Nada lo dijo: el síntoma de dos
 * repartidores no es un error, es trabajo repetido que parece normal.
 *
 * ── POR QUÉ SE MIRA EL RASTRO Y NO UN CANDADO ───────────────────────────────────────────────
 * Un `flock` es local y los dos supervisores estaban en MÁQUINAS distintas: no habría visto nada.
 * El rastro de cada pasada (`flota_bucle_pasada`) ya existe, es común a todas las máquinas y trae
 * lo único que hace falta para juzgar — quién la hizo y cuánto dijo que iba a esperar. Es «lease,
 * no lock»: si el otro muere, su rastro caduca solo y el siguiente arranca sin que nadie limpie.
 *
 * @param {{ultima:{host:string, ts:string|Date, pausaS:number}|null, yo:string, ahora?:Date, margenS?:number}} p
 * @returns {{hay:boolean, motivo:string|null}}
 *
 * La ventana NO es un número inventado: es la espera que el otro ANUNCIÓ, más un margen. Un
 * supervisor en calma puede tardar una hora en volver, y con una ventana fija corta se le daría
 * por muerto justo cuando está más tranquilo.
 */
function otroSupervisorVivo({ ultima, yo, ahora = new Date(), margenS = 300 } = {}) {
  if (!ultima || !ultima.host || !ultima.ts) return { hay: false, motivo: null }
  if (String(ultima.host) === String(yo)) return { hay: false, motivo: null }
  // Se despidió: soltó el sitio. Sin esto, reiniciar el servicio tras un despliegue —el caso
  // NORMAL— quedaba bloqueado hasta que caducara la ventana del que acababa de morir.
  if (ultima.parado) return { hay: false, motivo: null }
  const edadS = (new Date(ahora).getTime() - new Date(ultima.ts).getTime()) / 1000
  if (!Number.isFinite(edadS) || edadS < 0) return { hay: false, motivo: null }
  const ventana = (Number(ultima.pausaS) > 0 ? Number(ultima.pausaS) : CADA_S) + margenS
  if (edadS > ventana) return { hay: false, motivo: null }
  return {
    hay: true,
    motivo: `ya hay un supervisor repartiendo desde «${ultima.host}» (última pasada hace ${Math.round(edadS / 60)} min, anunció volver en ${Math.round(Number(ultima.pausaS || CADA_S) / 60)})`,
  }
}

/**
 * ¿Se puede repartir en esta pasada?
 *
 * @param {{hayBd:boolean, hayTrabajadores:boolean}} p
 * @returns {{ok:boolean, motivo:string|null}}
 */
function puedeRepartir({ hayBd, hayTrabajadores }) {
  // Sin BD no se sabe quién está ocupado ni qué está cogido: repartir sería adivinar, y adivinar
  // reparte lo mismo dos veces. Es la excepción deliberada al fail-open de la casa.
  if (!hayBd) return { ok: false, motivo: 'sin base de datos: repartir a ciegas duplica trabajo' }
  if (!hayTrabajadores) return { ok: false, motivo: 'ninguna máquina declara trabajadores que reciban reparto' }
  return { ok: true, motivo: null }
}

/**
 * Turnos que llevan demasiado tiempo abiertos. NO los mata: avisar y matar son decisiones
 * distintas, y matar un turno puede tirar trabajo sin commitear — que es justo lo que ya costó
 * una ficha propia (T-577). El bucle informa; quien decide es una persona.
 *
 * @param {Array<{trabajador:string, inicio:string|Date|null}>} turnos
 * @param {{ahora?:Date, limiteMin?:number}} opts
 * @returns {Array<{trabajador:string, minutos:number}>}
 */
function turnosAtascados(turnos, { ahora = new Date(), limiteMin = ATASCADO_MIN } = {}) {
  const t = new Date(ahora).getTime()
  return (turnos || [])
    .filter((x) => x && x.inicio)
    .map((x) => ({ trabajador: x.trabajador, minutos: Math.floor((t - new Date(x.inicio).getTime()) / 60000) }))
    .filter((x) => x.minutos >= limiteMin)
    .sort((a, b) => b.minutos - a.minutos)
}

/**
 * Resumen de una pasada, para el log y para el evento de observabilidad. Un bucle que no deja
 * rastro es indistinguible de un bucle muerto — y un supervisor muerto no lo nota nadie, porque
 * su síntoma es justamente que no pasa nada.
 */
function resumenPasada({ repartidos, atascados = [], motivoSalto = null, pausaS }) {
  if (motivoSalto) return `⏸️  pasada sin repartir — ${motivoSalto}; reintento en ${Math.round(pausaS / 60)} min`
  const at = atascados.length ? ` · ⚠️ ${atascados.map((a) => `${a.trabajador} lleva ${a.minutos} min`).join(', ')}` : ''
  return `🔁 ${repartidos} encargo(s)${at} · siguiente pasada en ${Math.round(pausaS / 60)} min`
}

module.exports = {
  MARCA_PASADA, lineaPasada, leerPasada,
  CADA_S, CADA_MAX_S, ATASCADO_MIN,
  siguientePausa, puedeRepartir, turnosAtascados, resumenPasada, otroSupervisorVivo, muertesPorMemoria,
}
