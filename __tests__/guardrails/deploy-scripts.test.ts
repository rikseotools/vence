/**
 * Guardrail: los scripts de deploy no deben perder los pasos críticos que
 * evitan romper producción. En concreto, el sync de assets a S3 con RETENCIÓN
 * (sin --delete) es lo que impide el congelamiento de la app tras un deploy
 * (ChunkLoadError por chunks viejos 404). Ver memoria project_deploy_freeze_chunks_s3.
 *
 * Si alguien edita el deploy y quita el sync a S3, este test falla ANTES de que
 * un deploy vuelva a congelar usuarios.
 */
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const frontend = readFileSync(join(ROOT, 'scripts/deploy-frontend.sh'), 'utf-8')
const backend = readFileSync(join(ROOT, 'scripts/deploy-backend.sh'), 'utf-8')

describe('deploy-frontend.sh — no perder el fix del congelamiento (assets en S3)', () => {
  it('sincroniza _next/static a S3', () => {
    expect(frontend).toMatch(/aws s3 sync/)
    expect(frontend).toMatch(/_next\/static/)
    expect(frontend).toMatch(/vence-frontend-static/)
  })

  it('los assets son inmutables (cache-control de 1 año)', () => {
    expect(frontend).toMatch(/cache-control\s+["']?public,\s*max-age=31536000,\s*immutable/)
  })

  it('NUNCA usa --delete en el sync (retención: los chunks viejos deben persistir)', () => {
    // Buscamos --delete SOLO en las líneas del sync a S3 (no en otras).
    const syncLines = frontend
      .split('\n')
      .filter((l) => l.includes('s3 sync') || (l.includes('--') && l.includes('cache-control')))
    for (const l of syncLines) expect(l).not.toMatch(/--delete/)
    // Doble check: el bucket de assets nunca aparece junto a --delete.
    expect(frontend).not.toMatch(/vence-frontend-static[\s\S]{0,200}--delete/)
  })

  it('verifica que el chunk llegó a S3 (self-check que aborta si el sync falla)', () => {
    expect(frontend).toMatch(/head-object/)
    expect(frontend).toMatch(/ABORTO el deploy/)
  })

  it('el smoke comprueba que un chunk carga vía CloudFront', () => {
    expect(frontend).toMatch(/_next\/static\/chunks/)
    expect(frontend).toMatch(/CHUNK_CODE/)
  })
})

describe('deploy-backend.sh — deploy repetible y verificado (no ad-hoc)', () => {
  it('existe y hace build + push + update-service', () => {
    expect(backend).toMatch(/podman build/)
    expect(backend).toMatch(/ecr get-login-password/)
    expect(backend).toMatch(/ecs update-service/)
  })

  it('pinea la imagen por digest (inmutable, no :latest a ciegas)', () => {
    expect(backend).toMatch(/--digestfile/)
    expect(backend).toMatch(/REG.*@.*DIGEST|IMG_DIGEST/)
  })

  it('espera estabilidad y hace smoke a /health', () => {
    expect(backend).toMatch(/wait services-stable/)
    expect(backend).toMatch(/\/health/)
    expect(backend).toMatch(/HEALTH_CODE.*200|"200"/)
  })

  it('documenta el rollback', () => {
    expect(backend).toMatch(/[Rr]ollback/)
  })
})

// Anti-regresión del incidente 11/07/2026: el digest del task def se re-resolvía por
// tag (`describe-images --image-ids imageTag=$TAG`) DESPUÉS del push, lo que devolvía
// el digest EQUIVOCADO de forma intermitente (consistencia eventual de ECR / carrera
// entre deploys concurrentes) → prod quedaba con la imagen VIEJA aunque el deploy
// dijera OK. El digest debe capturarse DIRECTO del push (--digestfile), determinista.
describe('ambos scripts — digest del push, NO re-resuelto por tag (incidente 11/07)', () => {
  for (const [name, s] of [['frontend', frontend], ['backend', backend]] as const) {
    it(`${name}: captura el digest con --digestfile`, () => {
      expect(s).toMatch(/podman push[^\n]*--digestfile/)
      expect(s).toMatch(/DIGEST=\$\(cat "\$DIGESTFILE"\)/)
    })
    it(`${name}: NO re-resuelve el digest con describe-images imageTag`, () => {
      // Flag CLI real (no la prosa del comentario que documenta el bug).
      expect(s).not.toMatch(/--image-ids imageTag=/)
    })
    it(`${name}: aborta si el push no devuelve digest (no pinea a ciegas)`, () => {
      expect(s).toMatch(/-z "\$DIGEST"[\s\S]{0,80}(ABORTO|exit 1)/)
    })
    // Anti-clobber (incidente 11/07): el smoke DEBE verificar que /health.deploy ==
    // el SHA construido → prod sirve lo que este deploy embarcó, no la imagen de otra
    // sesión. Sin esto, un deploy podía "triunfar" sirviendo código viejo.
    it(`${name}: verifica que el SHA vivo == el construido (anti-clobber)`, () => {
      expect(s).toMatch(/DEPLOYED_SHA=\$\(curl[\s\S]{0,120}\.get\('deploy'/)
      expect(s).toMatch(/DEPLOYED_SHA" = "\$SHA"/)
      expect(s).toMatch(/CLOBBEREADO/)
    })
    // Concurrencia (incidente 11/07): los ficheros temporales del task-def eran paths
    // FIJOS (/tmp/vence-td-new.json) → dos deploys concurrentes se pisaban el JSON entre
    // write y register → uno registraba la imagen del OTRO (SHA equivocado en prod).
    it(`${name}: usa mktemp para el task-def json (no path /tmp fijo)`, () => {
      expect(s).toMatch(/TDNEW=\$\(mktemp\)/)
      expect(s).toMatch(/register-task-definition --cli-input-json "file:\/\/\$\{TDNEW\}"/)
    })
    it(`${name}: NO registra desde un /tmp/vence-*.json FIJO`, () => {
      expect(s).not.toMatch(/--cli-input-json file:\/\/\/tmp\/vence-/)
    })
    // El transform pasa las rutas por ENTORNO (process.env.TDNEW), no por ${TDNEW}
    // interpolado en el node -e (evita corrupción por expansión shell) + valida que
    // el fichero no salga vacío antes de register (incidente 11/07: TDNEW vacío →
    // "Invalid JSON received" críptico en register).
    it(`${name}: pasa rutas al node por entorno y valida TDNEW no-vacío`, () => {
      expect(s).toMatch(/TDLIVE="\$TDLIVE" TDNEW="\$TDNEW"[^\n]*node -e/)
      expect(s).toMatch(/process\.env\.TDNEW/)
      expect(s).toMatch(/\[ -s "\$TDNEW" \][\s\S]{0,200}exit 1/)
    })
    // El cuerpo del `node -e "..."` NO puede tener comillas dobles: cierran la cadena
    // shell antes de tiempo y truncan el JS EN SILENCIO (incidente 11/07: un comentario
    // con "..." cortó el transform antes del writeFileSync → TDNEW vacío → deploy roto).
    it(`${name}: el bloque node -e no contiene comillas dobles (truncan el JS)`, () => {
      const m = s.match(/node -e "\n([\s\S]*?)\n"\n/)
      expect(m).toBeTruthy()
      expect(m![1]).not.toMatch(/"/)
    })
  }
})

// Coordinación de N sesiones simultáneas (incidente 11/07: dos sesiones desplegando
// vence-frontend a la vez). El fix de raíz: serializar con flock + no desplegar código
// stale + convertir el fallo críptico env/secret de ECS en un error claro.
describe('ambos scripts — coordinación de sesiones paralelas (incidente 11/07)', () => {
  for (const [name, s] of [['frontend', frontend], ['backend', backend]] as const) {
    // flock SERIALIZA deploys concurrentes al mismo servicio ECS. Se libera solo al
    // morir el proceso (fd) → sin locks zombi. Sin esto, dos update-service se pisan.
    it(`${name}: serializa con flock sobre un lock compartido (no deploys concurrentes)`, () => {
      expect(s).toMatch(/\/tmp\/vence-deploy\.lock/)
      expect(s).toMatch(/exec 9>/)
      expect(s).toMatch(/flock -n 9/)
      // La espera es ACOTADA (nunca infinita), pero el cuánto es parametrizable: el 28/07 un build
      // de frontend pasó de 30 min y un backend en cola detrás moría por timeout antes de que el
      // otro acabara — condenado por construcción. Ahora son 45 min y se ajusta con
      // DEPLOY_LOCK_WAIT, así que se aceptan las dos formas: literal o variable con default.
      expect(s).toMatch(/flock -w (\d+|"\$\{DEPLOY_LOCK_WAIT:-\d+\}") 9/)
    })
    // El anti-stale («HEAD debe contener origin/main») desapareció de los DOS scripts en T-385:
    // ninguno construye ya el working tree, así que la ancestría de HEAD dejó de decir nada. Su
    // sustituto, MÁS fuerte, está en «construye origin/main en un árbol propio». No se relajó:
    // se volvió imposible de incumplir.

    // Dedupe env/secret: ECS rechaza un name presente en environment Y secrets.
    // Detectarlo en el transform con mensaje claro > el error críptico de register.
    it(`${name}: detecta colisión env↔secret antes de registrar el task def`, () => {
      expect(s).toMatch(/COLISION env/)
      expect(s).toMatch(/secrets\|\|\[\]/)
    })
  }
})

describe('ambos scripts — nada de backticks dentro de `node -e "…"` (incidente 27/07)', () => {
  // El task def se construye con un bloque `node -e "…"` entre comillas DOBLES, así que bash
  // interpreta cualquier backtick como SUSTITUCIÓN DE COMANDO. El 27/07 un comentario JS
  // documentaba un detector con backticks (`seguimiento_fuente_ciega`) y el deploy escupía
  // "seguimiento_fuente_ciega: orden no encontrada" cinco veces. Aquella vez solo fue ruido —los
  // backticks caían en comentarios—, pero el mismo patrón con `$(...)` dentro ejecutaría lo que
  // hubiera ahí mientras se registra la task def de producción. Comillas simples en esos bloques.
  const bloquesNodeE = (script: string): string[] => {
    const out: string[] = []
    const re = /node -e "/g
    let m: RegExpExecArray | null
    while ((m = re.exec(script)) !== null) {
      // hasta la comilla doble que cierra el bloque, al principio de una línea
      const resto = script.slice(m.index + m[0].length)
      const fin = resto.search(/\n"/)
      out.push(fin === -1 ? resto : resto.slice(0, fin))
    }
    return out
  }

  it.each([
    ['deploy-frontend.sh', frontend],
    ['deploy-backend.sh', backend],
  ])('%s: ningún backtick dentro de un node -e con comillas dobles', (_nombre, script) => {
    for (const bloque of bloquesNodeE(script)) {
      const conBacktick = bloque.split('\n').filter((l) => l.includes('`'))
      expect(conBacktick).toEqual([])
    }
  })

  // Hermana de la anterior: el MISMO fallo con otro carácter. Dentro de comillas
  // dobles bash también expande el dólar, así que documentar un coste como "~$8
  // por día" convierte el bloque en "variable sin asignar" y con `set -u` ABORTA
  // el deploy — de todas las sesiones, no solo la tuya (pasado el 27/07/2026).
  // Van tres incidentes de la misma familia: comillas dobles (11/07, truncaban
  // el JS en SILENCIO), acentos graves (arriba) y esto. Escribir importes como
  // "8 USD" y citar con comillas simples.
  it.each([
    ['deploy-frontend.sh', frontend],
    ['deploy-backend.sh', backend],
  ])('%s: ningún parámetro posicional ($1..$9) dentro de un node -e', (_nombre, script) => {
    for (const bloque of bloquesNodeE(script)) {
      const conDolar = bloque.split('\n').filter((l) => /\$[0-9]/.test(l))
      expect(conDolar).toEqual([])
    }
  })

  it('el detector encuentra los bloques de verdad (si no, el test miente en silencio)', () => {
    // Sanity: ambos scripts construyen su task def con node -e; si dejaran de hacerlo, este
    // guardarraíl pasaría por vacío y nadie se enteraría.
    expect(bloquesNodeE(backend).length).toBeGreaterThan(0)
    expect(bloquesNodeE(frontend).length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// T-169 (27/07/2026) — el gate de CI debe distinguir `cancelled` de `failure`.
//
// GitHub cancela el run en curso cuando llega un push más nuevo (concurrency
// cancel-in-progress). Con varias sesiones trabajando eso pasa constantemente, y el gate
// lo metía en el mismo saco que un fallo real: abortaba el deploy diciendo "CI en ROJO"
// cuando no había ni un solo check en `failure`. Bloqueó tres deploys el mismo día — y el
// runbook YA lo documentaba como aprendizaje ("distinguirlos es una línea al leer los
// check-runs") sin que el script lo aplicara. Un aprendizaje que solo vive en la
// documentación se vuelve a pagar; por eso esto es un test.
describe('gate de CI — `cancelled` no es `failure`', () => {
  const scripts = ['scripts/deploy-frontend.sh', 'scripts/deploy-backend.sh']

  it.each(scripts)('%s: FAILED cuenta solo failure/timed_out, nunca cancelled', (rel) => {
    const src = readFileSync(join(process.cwd(), rel), 'utf8')
    const linea = src.split('\n').find((l) => l.includes('FAILED=$('))
    expect(linea).toBeDefined()
    expect(linea).toContain('failure')
    expect(linea).toContain('timed_out')
    expect(linea).not.toContain('cancelled')
  })

  // Lo que este test protege de verdad es que el mensaje diga QUÉ HACER, no solo que pasó. La
  // acción correcta ya no es la misma en los dos scripts, así que se comprueba por separado en
  // vez de exigir un texto que en uno de ellos sería un consejo EQUIVOCADO:
  //   · frontend — construye el working tree → hay que resincronizarlo;
  //   · backend  — construye origin/main en un árbol efímero (T-385) → no hay nada que
  //     resincronizar, basta con relanzar cuando el CI del origin/main nuevo esté verde.
  it.each(scripts)('%s: los cancelados tienen su propia rama, con acción concreta', (rel) => {
    const src = readFileSync(join(process.cwd(), rel), 'utf8')
    expect(src).toMatch(/CANCELLED=\$\(/)
    expect(src).toMatch(/\$\{CANCELLED:-0\}/)
    // Desde T-385 los dos construyen origin/main en un árbol propio, así que en ninguno hay
    // nada que resincronizar: la acción correcta es RELANZAR cuando el CI del origin/main nuevo
    // esté verde. Exigir el texto viejo fijaría un consejo equivocado.
    expect(src).toMatch(/CANCELADO[\s\S]{0,400}RELANZA/)
    expect(src).not.toMatch(/CANCELADO[\s\S]{0,400}reset --hard/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Auto-sincronización con origin/main antes del gate de CI (27/07/2026).
//
// El build sale del working tree, así que el anti-stale aborta si el árbol no contiene
// todo origin/main. Con varias sesiones pusheando, cualquier push ajeno durante la ventana
// «verificar CI → construir» tumbaba el deploy: tres abortos seguidos ese día. Cuando no
// hay nada propio que perder, resincronizar es seguro por construcción — pero SOLO
// entonces, y recalculando el SHA o el build se pinearía al commit viejo y el anti-clobber
// del final daría un falso positivo. Eso es lo que fija este test.
/**
 * BACKEND — construye `origin/main` en un árbol PROPIO (T-385, 31/07/2026).
 *
 * Este bloque SUSTITUYE, para el backend, a los cuatro invariantes del auto-sync y al anti-stale.
 * Y hay que leerlo así: el invariante nuevo es **más fuerte**, no más laxo.
 *
 *   · Antes: «construyo el working tree, y compruebo con tres mecanismos distintos —auto-sync,
 *     ancestría de HEAD, árbol limpio— que se parezca a origin/main». Tres aproximaciones a una
 *     cosa, cada una con su modo de fallo, todas sobre un directorio COMPARTIDO por 2-10 sesiones.
 *   · Ahora: «construyo EXACTAMENTE el commit de origin/main cuyo CI acabo de verificar, en un
 *     worktree recién creado que nadie puede tocar». No hay nada que aproximar.
 *
 * Lo que se protege aquí es que ese cambio no se deshaga por accidente: si alguien devolviera el
 * build al working tree, el deploy volvería a depender de que un recurso compartido esté quieto —
 * que es lo que costó, todo el 31/07, un guard nuevo (T-364), un lanzador bloqueado por el
 * scratch ajeno (T-366), un lanzador muerto tras 20 vueltas y un push a siete intentos.
 */
describe.each(['backend', 'frontend'])('%s — construye origin/main en un árbol propio (T-385)', (cual) => {
  const s = readFileSync(join(ROOT, `scripts/deploy-${cual}.sh`), 'utf8')
  const helper = readFileSync(join(ROOT, 'scripts/lib/deploy-worktree.sh'), 'utf8')

  it('el commit a desplegar sale de origin/main, no de HEAD', () => {
    expect(s).toMatch(/FULL_SHA=\$\(git rev-parse origin\/main/)
    expect(s).toMatch(/git fetch origin main/)
  })

  it('construye desde el árbol EFÍMERO, nunca desde el árbol de trabajo', () => {
    // El contexto del `podman build` es lo único que cambia entre los dos: el backend construye
    // el subdirectorio `backend/` y el frontend la raíz. Lo que NO puede cambiar es que salga
    // del árbol efímero — si vuelve a ser `.` o `./backend`, el deploy vuelve a depender de que
    // un directorio compartido esté quieto, que es todo lo que esta tarea quita.
    const contexto = cual === 'backend' ? /"\$BUILD_DIR\/backend"/ : /"\$BUILD_DIR"/
    expect(s).toMatch(contexto)
    expect(s).not.toMatch(/^\s*-t "\$IMG" \.\s*$/m)
    expect(s).not.toMatch(/podman build[^\n]*\s\.\/backend\s*$/m)
  })

  it('NO toca el árbol de nadie: sin `reset --hard` fuera de los comentarios', () => {
    const codigo = s.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')
    expect(codigo).not.toMatch(/git reset --hard/)
  })

  it('el árbol efímero se borra SIEMPRE, también si el build revienta', () => {
    expect(s).toMatch(/trap _al_salir EXIT/)
    expect(s).toMatch(/borrar_arbol_de_build/)
  })

  // En bash un segundo `trap … EXIT` REEMPLAZA al primero en silencio. Hay dos cosas que cerrar
  // —la fila de deploy_runs (T-404) y el árbol efímero— y registrarlas por separado habría hecho
  // que la segunda anulara a la primera sin que nadie se enterara.
  it('hay UNA sola trampa de salida (dos se anularían entre sí en silencio)', () => {
    const traps = s.split('\n').filter((l) => /^\s*trap\s/.test(l))
    expect(traps).toHaveLength(1)
  })

  it('el .env.local se carga ANTES de construir (de ahí sale el GITHUB_PAT del gate)', () => {
    // Un worktree nuevo no trae ficheros gitignorados: si el PAT se leyera del árbol de build,
    // el gate de CI no podría preguntar nada y abortaría siempre.
    //
    // Se ancla en la INVOCACIÓN real (`BUILD_DIR="$(crear_arbol_de_build`), no en el nombre a
    // secas: el nombre aparece antes en un comentario y el test comparaba contra ESE — o sea,
    // pasaba o fallaba por dónde estuviera la prosa. Un guardarraíl que mide comentarios no
    // mide nada.
    const carga = s.indexOf('. ./.env.local')
    const construye = s.indexOf('BUILD_DIR="$(crear_arbol_de_build')
    expect(carga).toBeGreaterThan(-1)
    expect(construye).toBeGreaterThan(-1)
    expect(carga).toBeLessThan(construye)
  })

  it('ante un CI cancelado ya NO manda resincronizar el árbol (no hay nada que resincronizar)', () => {
    expect(s).toMatch(/CANCELADO[\s\S]{0,400}RELANZA/)
    expect(s).not.toMatch(/CANCELADO[\s\S]{0,400}reset --hard/)
  })

  describe('el helper', () => {
    it('crea el worktree detached y forzado (el commit puede estar ya en otro árbol)', () => {
      expect(helper).toMatch(/git worktree add --detach --force/)
    })
    it('limpia el registro con prune (un build interrumpido dejaría entradas fantasma)', () => {
      expect(helper).toMatch(/git worktree prune/)
    })
    it('NO registra su propio trap (lo compone quien llama, o se anularían)', () => {
      expect(helper).not.toMatch(/^\s*trap\s/m)
    })

    // ── El fallo que se comió el primer intento, y que solo apareció al EJECUTARLO ──────────
    // `crear_arbol_de_build` se invoca por sustitución de comandos —`BUILD_DIR="$(…)"`— que corre
    // en un SUBSHELL: la variable global que asigna ahí muere con él. La limpieza, que solo
    // miraba esa global, la encontraba vacía, salía con 0 sin borrar nada y el `|| true` se
    // tragaba el silencio. Medido: dos árboles quedaron en `git worktree list` y en /tmp después
    // de haber «limpiado». En producción sería un worktree y un directorio colgados por deploy.
    it('la limpieza acepta la ruta por ARGUMENTO (la global se pierde en el subshell)', () => {
      expect(helper).toMatch(/borrar_arbol_de_build\(\)\s*\{\s*\n\s*local dir="\$\{1:-\$VENCE_BUILD_WT\}"/)
    })

    it('y el deploy se la PASA (si no, el arreglo del helper no sirve de nada)', () => {
      expect(s).toMatch(/borrar_arbol_de_build "\$\{BUILD_DIR:-\}"/)
    })
  })
})

/**
 * El auto-sync con `origin/main` (y sus cuatro invariantes) EXISTIÓ hasta T-385 y ya no existe
 * en ninguno de los dos scripts. Se deja escrito aquí en vez de borrarlo sin más, porque la
 * diferencia importa: **no se relajó, se volvió innecesario**.
 *
 * Servía para que el WORKING TREE —que era lo que se construía— se pareciera a `origin/main`, a
 * base de `git reset --hard` sobre un directorio que podía ser de otra sesión. Con el árbol de
 * build efímero el commit se lee directamente y se construye ahí: no hay nada que sincronizar.
 * Lo que ahora protege ese terreno es el bloque «construye origin/main en un árbol propio».
 */
describe('deploy — el auto-sync ya no existe (T-385)', () => {
  it.each(['scripts/deploy-frontend.sh', 'scripts/deploy-backend.sh'])(
    '%s: no queda ni `reset --hard` ni `NO_AUTO_SYNC` en el CÓDIGO', (rel) => {
      const codigo = readFileSync(join(process.cwd(), rel), 'utf8')
        .split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')
      expect(codigo).not.toMatch(/git reset --hard/)
      expect(codigo).not.toMatch(/NO_AUTO_SYNC/)
      expect(codigo).not.toMatch(/ALLOW_DIRTY/)
    })
})

/**
 * Las TAREAS PROGRAMADAS que salen de este mismo árbol pero de otro stage del
 * Dockerfile (worker de PDFs = stage `worker`) tienen que reconstruirse y
 * re-pinearse en CADA deploy.
 *
 * Incidente 27→29/07/2026, dos fallos encadenados que este bloque fija:
 *   1. La imagen del worker vivía de prestado en el repo del FRONTEND, cuya
 *      retención conserva solo 10 imágenes con ~6 pushes/día → se purgó y la
 *      tarea murió 2 días en el pull, sin logs ni alerta.
 *   2. Re-pinearla a la imagen del frontend NO la arregla: esa es el stage
 *      `runner` (sin devDependencies) y el worker arranca con `tsx`.
 *
 * Los DOS caminos de deploy (script manual y workflow de GHA) deben invocar el
 * MISMO script, o volverán a divergir.
 */
describe('tareas programadas derivadas (los 2 caminos de deploy)', () => {
  const repin = readFileSync(join(ROOT, 'scripts/deploy/repin-derived-taskdefs.sh'), 'utf-8')
  const workflow = readFileSync(join(ROOT, '.github/workflows/frontend-deploy.yml'), 'utf-8')
  const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf-8')

  /** Entradas `familia|stage|repo` declaradas en el script. */
  const entradas = [...repin.matchAll(/^\s*"([\w-]+)\|([\w-]+)\|([\w-]+)"/gm)].map((m) => ({
    familia: m[1], stage: m[2], repo: m[3],
  }))

  it('el script declara al menos una tarea derivada con familia|stage|repo', () => {
    expect(entradas.length).toBeGreaterThan(0)
    expect(entradas.map((e) => e.familia)).toContain('vence-temario-pdf-worker')
  })

  it('cada stage declarado EXISTE en el Dockerfile', () => {
    // Un stage inventado haría fallar el build en cada deploy.
    for (const e of entradas) {
      expect(dockerfile).toMatch(new RegExp(`AS ${e.stage}\\b`))
    }
  })

  it('NINGUNA usa el repo del frontend (su retención las purgaría) — causa raíz del incidente', () => {
    for (const e of entradas) {
      expect(e.repo).not.toBe('vence-frontend')
    }
  })

  it('construye su propio stage: NUNCA reutiliza la imagen del frontend', () => {
    // El stage `runner` no tiene devDependencies → sin tsx el worker no arranca.
    expect(repin).toMatch(/--target/)
    expect(repin).not.toMatch(/vence-frontend@/)
  })

  it('pinea por DIGEST del push, no por tag mutable (postmortem #115)', () => {
    expect(repin).toMatch(/IMAGE_PINNED="\$\{REGISTRY\}\/\$\{REPO\}@\$\{DIGEST\}"/)
    // Y aborta si el push no devolvió digest, en vez de pinear a ciegas.
    expect(repin).toMatch(/NO se pinea a ciegas/)
  })

  it('capta el digest de forma distinta por builder (--digestfile es SOLO de podman)', () => {
    // El deploy manual usa podman y el de CI usa docker. `docker push --digestfile`
    // NO existe: el push falla, y como el step de CI va con continue-on-error el
    // deploy saldría VERDE sin re-pinear nada — exactamente el fallo silencioso que
    // todo este mecanismo existe para evitar.
    const digestfileLines = repin.split('\n').filter((l) => l.includes('--digestfile'))
    expect(digestfileLines.length).toBeGreaterThan(0)
    for (const l of digestfileLines) expect(l).not.toMatch(/docker/)
    // Tiene que haber una rama por builder.
    expect(repin).toMatch(/case "\$BUILDER" in/)
    expect(repin).toMatch(/podman\)/)
    // Y la rama de docker saca el digest del propio push, no de un re-lookup por tag.
    expect(repin).toMatch(/sha256:\[0-9a-f\]\{64\}/)
    expect(repin).not.toMatch(/describe-images[\s\S]{0,80}imageTag/)
  })

  it('COMPRUEBA que el digest existe en el registry antes de pinear', () => {
    // Post-condición que hace irrelevante CÓMO se obtuvo el digest — y por tanto
    // protege también a la rama de builder que no se puede ejecutar en local.
    // Medido el 29/07: `inspect .RepoDigests` devuelve el digest del manifiesto
    // LOCAL, que NO es el que el registry almacena; pinearlo reproduce el
    // incidente original (la tarea muere en el pull).
    expect(repin).toMatch(/describe-images[\s\S]{0,120}imageDigest="\$DIGEST"/)
    expect(repin).toMatch(/NO se pinea \(moriría en el pull\)/)
    // La comprobación va ANTES de construir la imagen pineada.
    expect(repin.indexOf('imageDigest="$DIGEST"')).toBeLessThan(
      repin.indexOf('IMAGE_PINNED="${REGISTRY}'),
    )
  })

  it('el workflow de CI declara el builder que su rama sabe manejar', () => {
    const m = workflow.match(/BUILDER:\s*(\w+)/)
    expect(m).not.toBeNull()
    // Si mañana alguien pone otro builder, esta aserción obliga a mirar el script.
    expect(['docker', 'podman']).toContain(m![1])
  })

  it('el deploy MANUAL lo invoca', () => {
    expect(frontend).toMatch(/repin-derived-taskdefs\.sh/)
  })

  it('el workflow de GHA lo invoca (mismo script, sin duplicar la lógica)', () => {
    expect(workflow).toMatch(/scripts\/deploy\/repin-derived-taskdefs\.sh/)
  })

  it('avisa en rojo si alguna no se pudo actualizar', () => {
    // Un fallo silencioso aquí devuelve el sistema al punto ciego original.
    expect(repin).toMatch(/exit 1/)
    expect(frontend).toMatch(/REPIN_OK/)
  })

  it('toda tarea derivada tiene liveness declarada (o no nos enteraríamos de que muere)', () => {
    // La prevención es específica del proveedor y puede fallar; la detección no.
    const registry = readFileSync(
      join(ROOT, 'backend/src/cron-schedule/external-jobs.registry.ts'), 'utf-8',
    )
    const declarados = [...registry.matchAll(/^\s*name:\s*'([^']+)'/gm)].map((m) => m[1])
    for (const e of entradas) {
      // La familia de la task def lleva el prefijo `vence-`; el job, no.
      expect(declarados).toContain(e.familia.replace(/^vence-/, ''))
    }
  })
})

// ── Verificación de release en navegador (Vence Sim) ─────────────────────────────────────────
//
// El smoke de HTTP no ve un fallo de PINTADO: los controles del examen se sirvieron rotos
// (tapados por la cabecera) con la home devolviendo 200 y el token 401, o sea, con el smoke en
// verde. Por eso el deploy llama además a una verificación en navegador. Y esa verificación
// tiene que seguir siendo AGNÓSTICA: la nube se resuelve en el script del proveedor, no dentro
// del verificador — si no, mudarse a koigrid obligaría a reescribirlo.
const verifier = readFileSync(join(ROOT, 'scripts/verify-release.sh'), 'utf-8')

describe('verificación de release — enganchada al deploy y agnóstica del proveedor', () => {
  it('el deploy del frontend la invoca', () => {
    expect(frontend).toMatch(/verify-release\.sh/)
  })

  it('el deploy le pasa la URL y la identidad por entorno (contrato, no acoplamiento)', () => {
    expect(frontend).toMatch(/VERIFY_BASE_URL=/)
    expect(frontend).toMatch(/SIM_AUTH_SECRET=/)
    expect(frontend).toMatch(/SMOKE_USER_ID=/)
  })

  it('NO tumba el despliegue por sí sola (un rojo de entorno no puede bloquear un release)', () => {
    expect(frontend).toMatch(/verify-release\.sh"?\s*\|\|\s*true/)
  })

  it('el verificador NO habla con ninguna nube concreta', () => {
    // Lo que lo hace portable: ni AWS CLI, ni SSM, ni ECS dentro del verificador.
    expect(verifier).not.toMatch(/\baws\s+(ssm|ecs|s3|cloudfront)\b/)
  })

  it('el verificador corre los journeys marcados para release, no una lista escrita a mano', () => {
    expect(verifier).toMatch(/--post-deploy/)
    // Pasar nombres de journey a mano sería un silo que envejece al añadir journeys: lo que
    // se corre lo declara cada journey con `postDeploy`, no este script.
    expect(verifier).not.toMatch(/run\.ts\s+(?!--)[a-z]/)
  })

  it('sin navegador o sin URL se salta limpiamente en vez de fallar', () => {
    expect(verifier).toMatch(/SALTADA/)
    expect(verifier).toMatch(/exit 0/)
  })

  it('hay al menos un journey declarado para verificar el release', () => {
    const journeys = readdirSync(join(ROOT, 'scripts/sim/journeys'))
      .filter(f => f.endsWith('.ts'))
      .map(f => readFileSync(join(ROOT, 'scripts/sim/journeys', f), 'utf-8'))
    expect(journeys.some(src => /postDeploy:\s*true/.test(src))).toBe(true)
  })
})

/**
 * El aviso de vuelta a las OTRAS sesiones (T-285).
 *
 * La política del proyecto es AGRUPAR deploys: una sola sesión despliega por todas, porque cada
 * deploy cuesta build + minutos de Fargate. Eso solo funciona si quien despliega **avisa** a las
 * sesiones cuyo trabajo iba dentro: son tareas ya terminadas, pausadas con `--tras-deploy`, que
 * no se pueden cerrar hasta que su commit está vivo.
 *
 * Ese aviso lo dispara el propio script de deploy llamando a `backlog.cjs deployed <sha>`. Si
 * alguien lo quita —o le cambia la superficie— el sistema entero deja de avisar EN SILENCIO: las
 * tareas se quedan dormidas para siempre y nadie lo nota, porque no hay error, solo ausencia.
 * Por eso se vigila por lectura de código: es un cableado, no un comportamiento observable.
 */
describe('deploy — avisa a las sesiones que esperaban ese deploy (T-285)', () => {
  it('el deploy de frontend despierta las tareas que esperaban SU superficie', () => {
    expect(frontend).toMatch(/backlog\.cjs["']?\s+deployed/)
    expect(frontend).toMatch(/--superficie\s+frontend/)
  })

  it('el deploy de backend despierta las tareas que esperaban SU superficie', () => {
    expect(backend).toMatch(/backlog\.cjs["']?\s+deployed/)
    expect(backend).toMatch(/--superficie\s+backend/)
  })

  it('el aviso es best-effort: no puede tumbar un deploy que ya salió bien', () => {
    // `|| true` (o equivalente): un fallo escribiendo el aviso no puede marcar como fallido
    // un deploy cuyo smoke ya pasó — el remedio sería peor que la enfermedad.
    for (const [nombre, src] of [['frontend', frontend], ['backend', backend]] as const) {
      // El nombre entra en el mensaje del matcher, no como 2º arg de expect()
      // (eso es Vitest; en Jest se ignora y el fallo sale sin contexto).
      const linea = src.split('\n').find((l) => /backlog\.cjs["']?\s+deployed/.test(l))
      expect(`${nombre}: ${linea ?? '(sin llamada a backlog deployed)'}`).toMatch(/\|\|\s*true/)
    }
  })

  it('la llamada va DESPUÉS del smoke (no se avisa de un deploy que no verificó)', () => {
    for (const [nombre, src] of [['frontend', frontend], ['backend', backend]] as const) {
      const iAviso = src.search(/backlog\.cjs["']?\s+deployed/)
      const iSmoke = src.search(/smoke/i)
      expect({ script: nombre, smoke: iSmoke > -1 }).toEqual({ script: nombre, smoke: true })
      expect({ script: nombre, avisoTrasSmoke: iAviso > iSmoke }).toEqual({ script: nombre, avisoTrasSmoke: true })
    }
  })
})

/**
 * El aviso NO puede depender del script de quien despliega (T-290).
 *
 * Fallo real del 29/07, la misma noche que se estrenó el mecanismo: cada sesión despliega desde su
 * PROPIO worktree, y el de quien desplegó era anterior al commit que añadió la llamada a
 * `backlog.cjs deployed`. El deploy salió perfecto y no avisó a nadie — T-266 se quedó esperando un
 * frontend que ya estaba vivo. Sin error, solo ausencia: el modo de fallo que este sistema existe
 * para evitar, reproducido por el propio sistema.
 *
 * El arreglo es que `list` RECONCILIE contra el sha vivo de `/health` (pull) en vez de fiarlo todo
 * al aviso del deployer (push). Esto vigila que ese segundo camino siga cableado: si alguien lo
 * quita, volvemos a depender de que el worktree del que despliega esté al día, que es una condición
 * que no se cumple casi nunca y que nadie nota hasta que una tarea lleva días dormida.
 */
describe('backlog — el despertar no depende del worktree de quien despliega (T-290)', () => {
  const backlogCli = readFileSync(join(ROOT, 'scripts/backlog.cjs'), 'utf-8')

  it('`list` reconcilia contra el sha VIVO, no solo espera el aviso del deploy', () => {
    const list = backlogCli.slice(backlogCli.indexOf("cmd === 'list'"), backlogCli.indexOf("cmd === 'next'"))
    expect(list).toMatch(/shasVivos/)
    expect(list).toMatch(/despertarPorDeploy/)
  })

  it('no toca la red si no hay ninguna tarea esperando deploy (coste cero en el caso normal)', () => {
    const list = backlogCli.slice(backlogCli.indexOf("cmd === 'list'"), backlogCli.indexOf("cmd === 'next'"))
    // La consulta de pendientes va ANTES que la llamada a la red, y la envuelve.
    expect(list.indexOf('wake_on_deploy_sha IS NOT NULL')).toBeLessThan(list.indexOf('shasVivos'))
  })

  it('la reconciliación es fail-open: sin red o sin git, `list` sigue funcionando', () => {
    const list = backlogCli.slice(backlogCli.indexOf("cmd === 'list'"), backlogCli.indexOf("cmd === 'next'"))
    const trozo = list.slice(list.indexOf('shasVivos') - 400, list.indexOf('shasVivos') + 400)
    expect(trozo).toMatch(/try\s*\{/)
    expect(trozo).toMatch(/catch/)
  })

  it('los dos caminos comparten UNA implementación (push y pull no pueden divergir)', () => {
    // `deployed` (lo llama el deploy) y `list` (reconciliación) deben usar la misma función:
    // dos copias acabarían despertando con criterios distintos, y el desacuerdo sería invisible.
    const usos = backlogCli.match(/despertarPorDeploy\(/g) || []
    expect(usos.length).toBeGreaterThanOrEqual(3) // definición + los dos llamantes
    expect(backlogCli.match(/async function despertarPorDeploy/g) || []).toHaveLength(1)
  })

  it('"no sé qué hay vivo" NUNCA despierta (null no puede leerse como desplegado)', () => {
    const fn = backlogCli.slice(backlogCli.indexOf('async function despertarPorDeploy'))
    expect(fn).toMatch(/if \(!sha\) return false/)
  })
})

/**
 * «No despliegues desde donde trabajas» (T-365, 31/07/2026) EXISTIÓ hasta T-385 F3 y ya no existe
 * en NINGUNO de los tres caminos de despliegue. Se deja escrito aquí en vez de borrarlo sin más,
 * porque la diferencia importa: **no se relajó, se volvió innecesaria**.
 *
 * La guarda (`scripts/lib/guardia-worktree.sh`, BORRADO en T-385 F3) protegía el árbol de quien
 * lanzaba el deploy de un `git reset --hard origin/main` que este mismo script ejecutaba encima.
 * Con los tres caminos de solo lectura sobre el git local —los dos scripts de deploy construyen en
 * un árbol efímero propio (F1/F2) y `deploy-cuando-verde.sh` lee `origin/main` con `git rev-parse`
 * en vez de resetear (F3)— no hay ningún árbol que proteger: se puede lanzar CUALQUIERA de los tres
 * desde CUALQUIER worktree, incluido uno con trabajo sin commitear.
 *
 * Con ella cayeron TAMBIÉN dos guardas que solo existían para no perder trabajo en ese mismo reset:
 * el aborto por árbol sucio y `lib/deploy/commitsSinEmpujar.cjs` (árbol limpio con commits sin
 * empujar, T-443 punto 6) — las dos vivían SOLO en `deploy-cuando-verde.sh`, y con él ambas se
 * volvieron igual de innecesarias. Su simulación (`sim-reset-commits.cjs`) y su test dedicado
 * (`guardiaWorktreePrincipalInservible.test.ts`, T-436/T-437) se borraron con ellas: probaban un
 * comportamiento que ya no existe en ningún sitio, no un caso menos frecuente.
 */
describe('deploy — el árbol del lanzador ya no importa para NADA (T-385 F3)', () => {
  const CAMINOS = ['deploy-frontend.sh', 'deploy-backend.sh', 'deploy-cuando-verde.sh']
  // Sin comentarios: el propio fichero EXPLICA la historia citando `git reset --hard`, `árbol
  // SUCIO`, etc. — lo que no puede quedar es el CÓDIGO, no la palabra.
  const cuandoVerde = readFileSync(join(ROOT, 'scripts/deploy-cuando-verde.sh'), 'utf-8')
    .split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')

  it.each(CAMINOS)('%s: sin la guarda de worktree ni el fichero que la implementaba', (nombre) => {
    const src = readFileSync(join(ROOT, 'scripts', nombre), 'utf-8')
    expect(src).not.toContain('lib/guardia-worktree.sh')
    expect(src).not.toMatch(/guardia_worktree/)
  })

  it('el fichero de la guarda ya no existe en el repo (no solo se dejó de invocar)', () => {
    const todosLosScripts = readdirSync(join(ROOT, 'scripts/lib'))
    expect(todosLosScripts).not.toContain('guardia-worktree.sh')
  })

  it('deploy-cuando-verde.sh: sin `reset --hard`, sin el aborto por árbol sucio, sin commitsSinEmpujar', () => {
    expect(cuandoVerde).not.toMatch(/git reset --hard/)
    expect(cuandoVerde).not.toMatch(/árbol SUCIO/)
    expect(cuandoVerde).not.toMatch(/status --porcelain --untracked-files=no/)
    expect(cuandoVerde).not.toMatch(/commitsSinEmpujar/)
    expect(cuandoVerde).not.toMatch(/DEPLOY_RESET_OK/)
  })

  it('deploy-cuando-verde.sh: el SHA de origin/main se LEE, no se materializa en el árbol', () => {
    expect(cuandoVerde).toMatch(/SHA=\$\(git rev-parse origin\/main\)/)
  })

  it('ni commitsSinEmpujar.cjs ni su simulación siguen en el repo (protegían un reset que ya no existe)', () => {
    const libDeploy = readdirSync(join(ROOT, 'lib/deploy'))
    expect(libDeploy).not.toContain('commitsSinEmpujar.cjs')
    const scriptsDeploy = readdirSync(join(ROOT, 'scripts/deploy'))
    expect(scriptsDeploy).not.toContain('sim-reset-commits.cjs')
  })
})
