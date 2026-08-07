// lib/flota/saludMaquina.cjs
//
// ¿Puede la máquina de la flota hacer el trabajo que se le manda? — [T-677]
//
// ── EL HUECO QUE CIERRA (medido el 07/08/2026) ──────────────────────────────────────────────
// La flota ya vigila si un trabajador puede autenticarse, si su clon está al día, si produce y si
// su turno arranca. Nada miraba la MÁQUINA. Resultado, medido en `flota-1` mientras el panel
// pintaba a los cuatro trabajadores en verde y «ejecutando»:
//
//   · 702 MB disponibles de 7.751 (9 %), sin swap configurado.
//   · load average 19,69 en 4 núcleos… con la CPU al 97,7 % OCIOSA.
//   · los cuatro turnos en estado `D` (espera ininterrumpible de disco).
//   · CUATRO builds de Node a la vez: 1.574 + 1.383 + 1.295 + 1.213 MB = 5,5 GB.
//     Los cuatro Claude Code juntos ocupaban menos de 1 GB: el peso no son ellos, son sus builds.
//
// O sea: los trabajadores no estaban trabajando, estaban esperando disco. Y el síntoma visible
// era sutil —un turno de 2 h 31 min que no terminaba— porque **nadie mide esto**.
//
// ── POR QUÉ LA CARGA SOLA NO VALE, Y POR QUÉ LA MEMORIA SOLA TAMPOCO ────────────────────────
// Una carga alta con CPU ocupada es una máquina TRABAJANDO: eso no es una avería. Lo que delata
// el ahogo es la combinación —carga muy por encima de los núcleos **con la CPU ociosa**—, porque
// significa que los procesos están encolados esperando E/S. Y la memoria sola tampoco basta: un
// Linux sano usa casi toda la RAM en caché. Lo que importa es `available`, no `free`.

/** Núcleos, memoria y carga con los que se juzga. Todo en MB y en múltiplos de núcleo. */
const UMBRALES = {
  // Con menos de este porcentaje de memoria disponible, el page cache se queda sin sitio y cada
  // lectura de node_modules vuelve al disco. Medido: al 9 % la máquina estaba en `D` permanente.
  memoriaApretadaPct: 20,
  memoriaAhogadaPct: 12,
  // Carga por núcleo. Un 2× sostenido ya es cola; un 4× con la CPU ociosa es atasco de E/S.
  cargaApretadaPorNucleo: 2,
  cargaAhogadaPorNucleo: 4,
  // Por encima de este % de CPU ociosa, una carga alta NO es cálculo: es espera.
  cpuOciosaPct: 60,
  // Builds de Node simultáneos. Cada uno de este repo pesa ~1,3-1,6 GB: dos ya son media máquina.
  buildsApretado: 2,
  buildsAhogado: 3,
}

/**
 * Clasifica la salud de una máquina de la flota.
 *
 * @param {object} m
 * @param {number} m.memTotalMb      memoria total
 * @param {number} m.memDisponibleMb `available` de `free -m` (NO `free`: un Linux sano usa casi toda la RAM)
 * @param {number} m.swapTotalMb     swap configurada (0 = no hay red de seguridad)
 * @param {number} m.load1           load average de 1 minuto
 * @param {number} m.nucleos
 * @param {number} m.cpuOciosaPct    % de CPU idle
 * @param {number} m.buildsNode      procesos de build (node bajo npm) simultáneos
 * @param {number} [m.turnosEnEsperaIo] turnos en estado D (opcional: refuerza, no decide)
 * @returns {{estado:'ok'|'apretada'|'ahogada', motivos:string[], señales:object}}
 */
function clasificarMaquina(m) {
  const memPct = m.memTotalMb > 0 ? (m.memDisponibleMb / m.memTotalMb) * 100 : 100
  const cargaPorNucleo = m.nucleos > 0 ? m.load1 / m.nucleos : 0
  // La carga solo ACUSA cuando la CPU no está ocupada: si está calculando, la máquina trabaja.
  const cargaEsEspera = m.cpuOciosaPct >= UMBRALES.cpuOciosaPct

  const motivos = []
  let estado = 'ok'
  const subir = (nuevo) => {
    if (nuevo === 'ahogada' || (nuevo === 'apretada' && estado === 'ok')) estado = nuevo
  }

  if (memPct <= UMBRALES.memoriaAhogadaPct) {
    motivos.push(`solo ${Math.round(memPct)} % de memoria disponible (${m.memDisponibleMb} MB de ${m.memTotalMb})`)
    subir('ahogada')
  } else if (memPct <= UMBRALES.memoriaApretadaPct) {
    motivos.push(`memoria justa: ${Math.round(memPct)} % disponible`)
    subir('apretada')
  }

  if (cargaEsEspera && cargaPorNucleo >= UMBRALES.cargaAhogadaPorNucleo) {
    motivos.push(
      `carga ${m.load1.toFixed(1)} en ${m.nucleos} núcleos (${cargaPorNucleo.toFixed(1)}×) con la CPU ` +
      `${Math.round(m.cpuOciosaPct)} % ociosa: no está calculando, está esperando disco`,
    )
    subir('ahogada')
  } else if (cargaEsEspera && cargaPorNucleo >= UMBRALES.cargaApretadaPorNucleo) {
    motivos.push(`carga ${m.load1.toFixed(1)} (${cargaPorNucleo.toFixed(1)}× núcleos) con la CPU ociosa`)
    subir('apretada')
  }

  if (m.buildsNode >= UMBRALES.buildsAhogado) {
    motivos.push(`${m.buildsNode} builds de Node a la vez (cada uno pesa ~1,3-1,6 GB en este repo)`)
    subir('ahogada')
  } else if (m.buildsNode >= UMBRALES.buildsApretado) {
    motivos.push(`${m.buildsNode} builds de Node simultáneos`)
    subir('apretada')
  }

  // La swap no cambia el veredicto (una máquina sin swap puede estar perfectamente), pero cuando
  // ya hay ahogo explica por qué no hay amortiguador y el OOM killer entra de golpe.
  if (m.swapTotalMb === 0 && estado !== 'ok') {
    motivos.push('sin swap: no hay amortiguador, el siguiente pico lo resuelve el OOM killer')
  }

  return {
    estado,
    motivos,
    señales: {
      memDisponiblePct: Math.round(memPct),
      cargaPorNucleo: Number(cargaPorNucleo.toFixed(2)),
      cpuOciosaPct: Math.round(m.cpuOciosaPct),
      buildsNode: m.buildsNode,
      sinSwap: m.swapTotalMb === 0,
      turnosEnEsperaIo: m.turnosEnEsperaIo ?? null,
    },
  }
}

/**
 * Un turno que sigue VIVO pero cuyo andamiaje lleva mucho sin dar señal.
 *
 * Es la pregunta que el panel no hacía y que motivó todo esto: el semáforo mira si hay proceso
 * (correcto) y la antigüedad del latido se imprime AL LADO, sin cruzarse. Un proceso vivo con el
 * latido congelado es la firma de un turno que no progresa — el caso medido: `w1` con 8,5 h sin
 * latir y un `claude -p` de 2 h 31 min que no terminaba.
 *
 * NO se juzga por la duración del turno sola: un turno largo puede ser trabajo legítimo. Lo que
 * acusa es que en todo ese rato el trabajador no haya ejecutado NI UN comando del andamiaje
 * (claim, heartbeat, backlog…), que es lo que renueva el latido.
 */
function turnoSinProgreso({ ejecutando, latidoMin, turnoMin }, limiteMin = 120) {
  if (!ejecutando) return { sospechoso: false, motivo: null }
  if (latidoMin == null) return { sospechoso: false, motivo: null }
  if (latidoMin < limiteMin) return { sospechoso: false, motivo: null }
  return {
    sospechoso: true,
    motivo:
      `lleva ${latidoMin} min sin que su andamiaje dé señal` +
      (turnoMin != null ? ` y su turno actual ya dura ${turnoMin} min` : '') +
      ': el proceso vive pero no está avanzando',
  }
}

module.exports = { clasificarMaquina, turnoSinProgreso, UMBRALES }
