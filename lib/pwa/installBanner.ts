/**
 * Banner de instalación de la PWA — DECISIÓN pura (sin React, sin DOM, sin red).
 *
 * ## Por qué existe
 *
 * La PWA de Vence funciona y hay gente usándola instalada, pero **nadie invita a
 * instalarla**: el banner vivía dentro de `PushNotificationManager` y se lo llevó por delante
 * la retirada del sistema de push (03/05/2026). Con él se fue también `pwaTracker.ts`, así
 * que la medición está congelada desde el 21/05 y el panel muestra 0 instalaciones, que no es
 * un dato sino un cero falso.
 *
 * Aquí va SOLO la decisión (¿se enseña o no?), separada del componente a propósito: es la
 * parte con reglas —y por tanto la que puede estar mal— y así se prueba entera sin navegador.
 *
 * ## Las reglas, y de dónde salen
 *
 * - **Solo móvil.** En escritorio no se ofrece (decisión de Manuel): el valor de la PWA es el
 *   icono en el móvil y entrar directo.
 * - **Solo a quien NO la tiene.** Si ya corre en `standalone`, enseñarle "instálala" es ruido
 *   y hace dudar de que esté instalada.
 * - **Solo si el navegador la ofrece.** Sin `beforeinstallprompt` capturado no hay nada que
 *   pulsar, y un botón que no instala es peor que no tener botón.
 * - **Descartable, y el descarte se respeta.** «Ahora no» y la ✕ son la misma intención con
 *   distinta prisa, pero NO duran lo mismo: la ✕ es "quítamelo de delante" (vuelve pronto),
 *   «Ahora no» es "no me interesa hoy" (tarda más). Un banner que reaparece al recargar es la
 *   forma más rápida de que alguien deje de leer lo que le pones delante.
 */

/** Qué se decide, y por qué. El motivo se emite en la telemetría: sin él no se puede depurar. */
export type MotivoBanner =
  | 'mostrar'
  /** Ya la tiene instalada (corre en modo standalone). */
  | 'ya_instalada'
  /** Escritorio: el banner es solo para móvil. */
  | 'no_movil'
  /** El navegador no ha ofrecido instalar (iOS Safari, o criterios no cumplidos). */
  | 'sin_prompt'
  /** El usuario lo descartó y el descarte sigue vigente. */
  | 'descartado'
  /** iOS Safari: no hay prompt, pero SÍ se puede instalar a mano (se enseñan las instrucciones). */
  | 'mostrar_ios'

/**
 * Qué banner toca. En iOS no existe `beforeinstallprompt` (WebKit no lo implementa), así que
 * un botón "Instalar" ahí no puede hacer nada: lo que sí funciona es enseñar los dos pasos de
 * Safari (Compartir → Añadir a pantalla de inicio).
 *
 * Sale de los datos, no de una intuición: de los 114 móviles a los que no se les ofreció nada
 * en las primeras 17 h, 48 eran iPhone/iPad y **ninguno** instaló la app. Los 66 restantes
 * (Android) ya la tenían, ya la habían visto o ya la habían descartado — ahí no hay hueco.
 */
export type VarianteBanner = 'prompt' | 'ios'

export interface EntradaBanner {
  /** ¿La app corre ya como instalada? (`display-mode: standalone`) */
  yaInstalada: boolean
  /** ¿Es un móvil? El banner no se ofrece en escritorio. */
  esMovil: boolean
  /** ¿Se capturó `beforeinstallprompt` y hay algo que lanzar? */
  promptDisponible: boolean
  /** ¿Es Safari en iOS? Ahí no hay prompt pero sí se puede instalar a mano. */
  esIosSafari?: boolean
  /** Marca de tiempo (ms) hasta la que el usuario no quiere verlo. `null` = nunca lo descartó. */
  silenciadoHasta: number | null
  /** Ahora, en ms. Se inyecta para que la decisión sea determinista y testeable. */
  ahora: number
}

const DIA = 24 * 60 * 60 * 1000

/**
 * Cuánto se calla el banner según cómo lo cierres.
 *
 * La ✕ es un gesto de "ahora no me molestes" y «Ahora no» es un "no me interesa": tratarlos
 * igual sería ignorar lo que el usuario acaba de decir. Ninguno es para siempre — la PWA se
 * entiende mejor después de usar la web unos días, así que insistir con calma tiene sentido;
 * insistir cada sesión, no.
 */
export const SILENCIO_MS: Record<'cerrar' | 'ahora_no', number> = {
  cerrar: 3 * DIA,
  ahora_no: 30 * DIA,
}

/** Hasta cuándo callar el banner tras un descarte. Pura. */
export function silenciarHasta(accion: 'cerrar' | 'ahora_no', ahora: number): number {
  return ahora + SILENCIO_MS[accion]
}

/**
 * ¿Se enseña el banner? Devuelve el motivo SIEMPRE, también cuando sí se enseña.
 *
 * El orden de las comprobaciones no es casual: primero lo que es un hecho del dispositivo
 * (instalada, móvil) y después lo que depende del usuario o del navegador. Así el motivo que
 * sale es el más informativo: si alguien ya la tiene instalada, saber además que la descartó
 * hace tres semanas no aporta nada.
 */
export function decidirBanner(
  e: EntradaBanner,
): { mostrar: boolean; motivo: MotivoBanner; variante: VarianteBanner } {
  if (e.yaInstalada) return { mostrar: false, motivo: 'ya_instalada', variante: 'prompt' }
  if (!e.esMovil) return { mostrar: false, motivo: 'no_movil', variante: 'prompt' }

  // El silencio se respeta ANTES de elegir variante: da igual cómo se instale, si dijo que no
  // hace dos días no se le vuelve a poner delante.
  const silenciado = e.silenciadoHasta != null && e.ahora < e.silenciadoHasta

  if (!e.promptDisponible) {
    // iOS: no hay nada que lanzar, pero sí que enseñar. Fuera de iOS, sin prompt no hay banner.
    if (!e.esIosSafari) return { mostrar: false, motivo: 'sin_prompt', variante: 'prompt' }
    if (silenciado) return { mostrar: false, motivo: 'descartado', variante: 'ios' }
    return { mostrar: true, motivo: 'mostrar_ios', variante: 'ios' }
  }

  if (silenciado) return { mostrar: false, motivo: 'descartado', variante: 'prompt' }
  return { mostrar: true, motivo: 'mostrar', variante: 'prompt' }
}

/**
 * ¿Es un móvil? Mismo criterio de user-agent que `lib/tts/telemetry.ts` — a propósito: dos
 * definiciones distintas de "móvil" en la misma app acaban divergiendo.
 *
 * Se acepta el UA como parámetro (en vez de leer `navigator`) para poder simular dispositivos
 * en los tests sin montar un DOM.
 */
export function esMovil(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent)
}

/**
 * ¿Safari en iOS? Solo Safari puede "Añadir a pantalla de inicio": en Chrome/Firefox de iPhone
 * esa opción NO existe, así que enseñarles esos pasos sería mandarlos a buscar un botón que no
 * van a encontrar. A ellos no se les enseña nada (v1); si algún día pesan, el mensaje correcto
 * es otro ("ábrelo en Safari").
 */
export function esIosSafari(userAgent: string): boolean {
  const esIos = /iPhone|iPad|iPod/i.test(userAgent)
  if (!esIos) return false
  // Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS), Opera (OPiOS) sobre iOS: no pueden instalar.
  return !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV/i.test(userAgent)
}

/** Clave de `localStorage`. Con prefijo del proyecto para no chocar con nada más. */
export const CLAVE_SILENCIO = 'vence_pwa_banner_silenciado_hasta'

/**
 * Lee el silencio guardado. Tolera basura: si alguien manipuló la clave a mano o quedó un
 * valor de una versión anterior, se trata como "nunca descartado" en vez de reventar. Un
 * banner de más es un incordio; una excepción en el layout se lleva la página por delante.
 */
export function leerSilencio(bruto: string | null): number | null {
  if (!bruto) return null
  const n = Number(bruto)
  return Number.isFinite(n) && n > 0 ? n : null
}
