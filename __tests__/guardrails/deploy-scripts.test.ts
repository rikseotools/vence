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
  }
})
