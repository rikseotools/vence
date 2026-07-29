/**
 * Guardrail: los scripts de deploy no deben perder los pasos críticos que
 * evitan romper producción. En concreto, el sync de assets a S3 con RETENCIÓN
 * (sin --delete) es lo que impide el congelamiento de la app tras un deploy
 * (ChunkLoadError por chunks viejos 404). Ver memoria project_deploy_freeze_chunks_s3.
 *
 * Si alguien edita el deploy y quita el sync a S3, este test falla ANTES de que
 * un deploy vuelva a congelar usuarios.
 */
import { readFileSync } from 'fs'
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
    // Anti-stale: el build sale del working tree; si tu rama no contiene origin/main,
    // desplegar dejaría caer trabajo de otra sesión (clobber). Exigir ancestría.
    it(`${name}: aborta si HEAD no contiene origin/main (anti clobber stale)`, () => {
      expect(s).toMatch(/git fetch origin main/)
      expect(s).toMatch(/merge-base --is-ancestor origin\/main HEAD/)
      expect(s).toMatch(/SKIP_MAIN_SYNC/)
    })
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

  it.each(scripts)('%s: los cancelados tienen su propia rama, que manda RESINCRONIZAR', (rel) => {
    const src = readFileSync(join(process.cwd(), rel), 'utf8')
    expect(src).toMatch(/CANCELLED=\$\(/)
    expect(src).toMatch(/\$\{CANCELLED:-0\}/)
    // el mensaje tiene que decir qué hacer, no solo que pasó
    expect(src).toMatch(/CANCELADO[\s\S]{0,400}reset --hard origin\/main/)
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
describe('deploy — auto-sync con origin/main', () => {
  const scripts = ['scripts/deploy-frontend.sh', 'scripts/deploy-backend.sh']
  const src = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

  it.each(scripts)('%s: existe y se puede desactivar (NO_AUTO_SYNC=1)', (rel) => {
    const s = src(rel)
    expect(s).toContain('AUTO-SINCRONIZACIÓN CON origin/main')
    expect(s).toMatch(/\$\{NO_AUTO_SYNC:-0\}/)
  })

  it.each(scripts)('%s: corre ANTES del gate de CI (si no, validaría un SHA que no despliega)', (rel) => {
    const s = src(rel)
    expect(s.indexOf('AUTO-SINCRONIZACIÓN CON origin/main')).toBeLessThan(s.indexOf('GATE CI (Fase 2'))
  })

  it.each(scripts)('%s: recalcula SHA y FULL_SHA tras resincronizar', (rel) => {
    const s = src(rel)
    const ini = s.indexOf('AUTO-SINCRONIZACIÓN CON origin/main')
    const bloque = s.slice(ini, s.indexOf('GATE CI (Fase 2', ini))
    expect(bloque).toMatch(/reset --hard origin\/main/)
    expect(bloque).toMatch(/SHA=\$\(git rev-parse HEAD \| cut -c1-8\)/)
    expect(bloque).toMatch(/FULL_SHA=\$\(git rev-parse HEAD\)/)
  })

  it.each(scripts)('%s: NO resincroniza con árbol sucio ni con commits propios sin pushear', (rel) => {
    const s = src(rel)
    const ini = s.indexOf('AUTO-SINCRONIZACIÓN CON origin/main')
    const bloque = s.slice(ini, s.indexOf('GATE CI (Fase 2', ini))
    // guarda 1: árbol limpio
    expect(bloque).toMatch(/git status --porcelain --untracked-files=no/)
    // guarda 2: HEAD ya contenido en origin/main (nada propio que perder)
    expect(bloque).toMatch(/merge-base --is-ancestor HEAD origin\/main/)
  })
})

/**
 * Las task defs DERIVADAS de la imagen del frontend (tareas programadas que
 * corren ese mismo bundle) tienen que re-pinearse en CADA deploy. El pineado por
 * digest inmutable — que el postmortem #115 introdujo para el servicio — solo es
 * seguro si se refresca: si no, la retención de ECR purga el digest apuntado y la
 * tarea muere en el pull, ANTES del entrypoint, sin logs ni alerta.
 *
 * Incidente 27→29/07/2026: el worker de PDFs estuvo 2 días muerto exactamente así.
 *
 * Los DOS caminos de deploy (script manual y workflow de GHA) deben invocar el
 * MISMO script, o volverán a divergir.
 */
describe('re-pineado de task defs derivadas (los 2 caminos de deploy)', () => {
  const repin = readFileSync(join(ROOT, 'scripts/deploy/repin-derived-taskdefs.sh'), 'utf-8')
  const workflow = readFileSync(join(ROOT, '.github/workflows/frontend-deploy.yml'), 'utf-8')

  it('el script compartido existe y declara las familias derivadas', () => {
    expect(repin).toMatch(/DERIVED_TASKDEF_FAMILIES=\(/)
    expect(repin).toMatch(/vence-temario-pdf-worker/)
  })

  it('el deploy MANUAL lo invoca', () => {
    expect(frontend).toMatch(/repin-derived-taskdefs\.sh/)
    expect(frontend).toMatch(/IMAGE_PINNED=/)
  })

  it('el workflow de GHA lo invoca (mismo script, sin duplicar la lógica)', () => {
    expect(workflow).toMatch(/scripts\/deploy\/repin-derived-taskdefs\.sh/)
    expect(workflow).toMatch(/IMAGE_PINNED/)
  })

  it('re-pinea al digest recién desplegado, no a un tag mutable', () => {
    // Un tag (`:latest`, `:sha`) reintroduce el anti-patrón del postmortem #115.
    expect(repin).toMatch(/IMAGE_PINNED/)
    expect(repin).not.toMatch(/image\s*=\s*.*:latest/)
  })

  it('avisa en rojo si alguna task def derivada no se pudo re-pinear', () => {
    // Un fallo silencioso aquí devuelve el sistema al punto ciego original.
    expect(repin).toMatch(/exit 1/)
    expect(frontend).toMatch(/REPIN_OK/)
  })
})
