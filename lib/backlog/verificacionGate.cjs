// lib/backlog/verificacionGate.cjs — ¿se puede CERRAR esta tarea, o su código aún no está vivo?
// Fase 1 de [T-392].
//
// ── EL FALLO QUE CIERRA ──────────────────────────────────────────────────────────────────────
// Hoy `done` significa «he escrito el código» y se lee como «funciona». Entre esas dos cosas hay
// un push, un deploy y una comprobación, y ninguna es automática. El 31/07 eso costó tres cierres
// malos en el mismo día; el peor, [T-363] —que decide **cuándo se le cobra a alguien**— cerrada
// con el código en `main`, sin desplegar y sin verificar. Lo cazó Manuel preguntando.
//
// La puerta que ya existía (`detectarTrabajoPendiente`) mira **el texto** del outcome: caza al que
// confiesa. Esta mira **los hechos**, que es lo que no se puede maquillar: si los commits de la
// tarea tocan una superficie SERVIDA y el `sha` vivo todavía no los incluye, la tarea no está
// terminada por definición, diga lo que diga el outcome.
//
// ── LA REGLA QUE LO SALVA DE SER BUROCRACIA ──────────────────────────────────────────────────
// La mitad de las fichas de este repo son documentación, tooling local o barridos de datos:
// **no se despliegan**, así que exigirles una fase de verificación sería un sello. Y un sello se
// aprende a estampar — que es como muere un guardarraíl (T-375, T-403).
//
// Por eso la pregunta no es «¿toca código?» sino **«¿llega esto al usuario solo tras un
// deploy?»**. Y no se declara, se DERIVA: un fichero de `lib/` está servido si algo bajo
// `app/`, `components/`, `contexts/`, `hooks/` o `backend/src/` lo importa (directa o
// transitivamente). Así, `lib/backlog/pushGuard.cjs` —que solo usa un hook de git— no arrastra a
// nadie a esperar un deploy que no significa nada para él.

/** Directorios que SOLO llegan al usuario tras un deploy, con su superficie. */
const SERVIDO_DIRECTO = [
  { re: /^app\//, superficie: 'frontend' },
  { re: /^components\//, superficie: 'frontend' },
  { re: /^contexts\//, superficie: 'frontend' },
  { re: /^hooks\//, superficie: 'frontend' },
  { re: /^public\//, superficie: 'frontend' },
  { re: /^middleware\.ts$/, superficie: 'frontend' },
  { re: /^next\.config\.js$/, superficie: 'frontend' },
  { re: /^backend\/src\//, superficie: 'backend' },
]

/**
 * Rutas que NUNCA son servidas aunque su nombre se parezca: son de la propia caja de
 * herramientas. Se listan explícitamente porque el análisis de imports no las distingue —
 * `scripts/` importa de `lib/` constantemente y eso no las hace llegar a nadie.
 */
const NUNCA_SERVIDO = [
  /^scripts\//,
  /^docs\//,
  /^__tests__\//,
  /\.(test|spec)\.[a-z]+$/,
  /^\.husky\//,
  /^\.github\//,
  /^data\//,
  /^supabase\/migrations\//,   // se aplican aparte, no viajan en la imagen
  /^CLAUDE\.md$/,
  /\.md$/,
]

const esNuncaServido = (f) => NUNCA_SERVIDO.some((re) => re.test(f))

/**
 * Superficie servida de UN fichero, o `null` si no llega al usuario por deploy.
 *
 * @param fichero      ruta relativa al repo
 * @param importadoEn  para ficheros ambiguos (`lib/`, `db/`, `utils/`): superficies desde las que
 *                     algo lo importa, ya calculadas fuera (I/O). `[]` = nadie servido lo usa.
 */
function superficieDe(fichero, importadoEn = []) {
  const f = String(fichero || '').trim()
  if (!f || esNuncaServido(f)) return null
  const directo = SERVIDO_DIRECTO.find((s) => s.re.test(f))
  if (directo) return directo.superficie
  // Ambiguo (lib/, db/, utils/, package.json…): manda quién lo usa, no dónde vive.
  if (importadoEn.includes('backend')) return 'backend'
  if (importadoEn.includes('frontend')) return 'frontend'
  return null
}

/**
 * Decide si cerrar exige haber verificado en producción.
 *
 * @param cambios      [{ fichero, importadoEn }] de los commits que mencionan la tarea
 * @param desplegado   { frontend: bool|null, backend: bool|null } — ¿el sha vivo YA los incluye?
 *                     `null` = no se pudo averiguar (y entonces NO se bloquea: ver abajo)
 *
 * @returns { exige, superficies, servidos, motivo }
 *
 * **Fail-open si no se sabe.** Si no se puede leer el sha vivo (sin red, health caído), no se
 * bloquea: «no lo sé» no puede convertirse en un veredicto que impida trabajar — es el mismo
 * principio que el resto del andamiaje. Lo que sí se hace es DECIRLO.
 */
function exigeVerificacion(cambios, desplegado = {}) {
  const servidos = []
  const superficies = new Set()
  for (const c of cambios || []) {
    const sup = superficieDe(c && c.fichero, (c && c.importadoEn) || [])
    if (!sup) continue
    servidos.push({ fichero: c.fichero, superficie: sup })
    superficies.add(sup)
  }
  if (!superficies.size) {
    return { exige: false, superficies: [], servidos: [], motivo: 'no toca ninguna superficie servida: se cierra sin esperar deploy' }
  }

  const pendientes = [...superficies].filter((s) => desplegado[s] === false)
  const desconocidas = [...superficies].filter((s) => desplegado[s] !== true && desplegado[s] !== false)
  if (pendientes.length) {
    return {
      exige: true,
      superficies: [...superficies],
      servidos,
      motivo: `toca ${servidos.length} fichero(s) servido(s) de ${pendientes.join(' y ')} y el sha vivo todavía NO los incluye`,
    }
  }
  if (desconocidas.length) {
    return {
      exige: false,
      superficies: [...superficies],
      servidos,
      motivo: `toca ${pendientes.length ? '' : ''}${desconocidas.join(' y ')} pero no se ha podido leer el sha vivo — no se bloquea (fail-open)`,
    }
  }
  return {
    exige: false,
    superficies: [...superficies],
    servidos,
    motivo: `toca ${superficies.size} superficie(s) servida(s) y el sha vivo YA las incluye: se puede verificar y cerrar`,
  }
}

module.exports = { exigeVerificacion, superficieDe, SERVIDO_DIRECTO, NUNCA_SERVIDO }
