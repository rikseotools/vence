# Manual: Despliegues sin congelar a los usuarios

> **Para futuras sesiones.** Explica POR QUÉ un deploy puede congelar la app, las CAPAS de protección que hay, cómo verificar que NO congela, y los aprendizajes. Complementa `docs/runbooks/pusheo-revision-despliegue.md` (procedimiento operativo).
>
> Memorias: `project_deploy_freeze_chunks_s3` · `project_deteccion_alertas_completa`.

## 1. El problema: por qué un deploy congela la app

Next.js parte la app en **chunks** JS con nombre por hash de contenido (`/_next/static/chunks/<hash>.js`). Cada build genera hashes nuevos.

Un usuario que cargó la app **antes** del deploy tiene el HTML/bundle **viejo** en memoria. Al navegar (SPA client-side), Next.js hace `import()` dinámico de un chunk viejo. Si ese chunk **ya no existe en el origen** → **404** → **`ChunkLoadError`**. Sin manejo, la app se queda **congelada** (pantalla en blanco, nada carga). Caso real: **Nila y otros, 05/07/2026**.

**Por qué desaparecían los chunks viejos:** se servían desde el **contenedor ECS efímero** (Dockerfile `COPY .next/static`). Cada deploy REEMPLAZA el contenedor → los hashes viejos se van del origen.

**Aclaración importante:** el "version-check" (que difiere el reload en tests) controla *cuándo recarga* el usuario, **NO** si los chunks existen. Aunque no recargue, si pide un chunk que ya no está → 404. Por eso hace falta protección a nivel de **assets**, no solo de versión.

**Solo los deploys de FRONTEND** cyclan el contenedor del frontend → solo esos pueden congelar. Los de **backend** (crons, alertas, canarios) NO tocan los chunks → nunca congelan.

## 2. Las CAPAS de protección (defense in depth)

Ninguna capa sola es suficiente; juntas hacen que un deploy no rompa a nadie:

### Capa 1 — Version-check (`hooks/useVersionCheck.ts`)
Al cambiar de versión, fuerza `window.location.reload()` para traer el bundle nuevo. **DIFIERE** el reload en rutas de test (para no interrumpir un examen); lo aplica al salir de la ruta crítica. Reduce cuánta gente se queda en bundles viejos.

### Capa 2 — Assets inmutables en S3 con RETENCIÓN (el fix de raíz)
`/_next/static/*` se sirve vía CloudFront desde el bucket **`vence-frontend-static`**. El deploy (`scripts/deploy-frontend.sh` paso `[2b]`) hace `aws s3 sync` **SIN `--delete`** → los chunks de bundles viejos **nunca desaparecen** (modelo inmutable tipo Vercel). Así un usuario en un bundle anterior **sigue encontrando sus chunks**. Self-check: si un chunk no llegó a S3, el deploy ABORTA.

### Capa 3 — Origin group CloudFront: S3 primario + ALB fallback  ⚠️ NO ACTIVA (ver §5)
La idea era que `/_next/static/*` apuntara a un **origin group** [S3 → ALB] con fallback. **NO se pudo montar** por un choque de `Host` header (causa confirmada en §5). Actualmente el behavior sirve **solo desde el ALB** (contenedor) — el estado original que funciona. Los usuarios quedan protegidos por Capas 1+4.

### Capa 4 — Auto-reload de `ChunkLoadError` (red de seguridad cliente)
`lib/observability/client.ts` detecta `ChunkLoadError` (predicado `isChunkLoadError`) y hace `window.location.reload()` (trae bundle nuevo). Anti-bucle: no re-recarga si ya lo hizo en <30s (sessionStorage). Convierte cualquier residual en, como mucho, **una recarga** — nunca un congelamiento.

> **Regla mental:** Capa 2 (retención S3) sería lo IDEAL (chunk viejo carga → cero interrupción). **Hoy las Capas 2 y 3 NO están activas** (choque de `Host` header, §5); los usuarios están protegidos por las Capas **1 (version-check) + 4 (auto-reload)**, que evitan el congelamiento a coste de, como mucho, una recarga. `chunk_load_error` real = **0** en 24h → la protección efectiva funciona.

## 3. Cómo verificar que un deploy NO congela

```bash
# a) chunk_load_error reales (0 = nadie congelado). OJO: el evento existe desde
#    el deploy del 05/07; antes no se capturaba.
node -e "... SELECT count(*) FROM observable_events WHERE event_type='chunk_load_error' AND ts>=now()-interval '6 hours' ..."

# b) Retención S3: un chunk de un bundle VIEJO (solo en S3, no en el contenedor)
#    debe cargar 200 vía CloudFront. Si da 404 → la Capa 2 NO está sirviendo de S3
#    (ver aprendizaje §5). Test con un objeto solo-S3:
curl -s -o /dev/null -w "%{http_code}" "https://www.vence.es/_next/static/chunks/<hash-viejo>.js"

# c) Canario sintético externo (backend/src/canary-synthetic-external): cada 5min
#    descarga un chunk vía CloudFront → si da !=200, alerta a venceoposiciones.
```

**Veredicto:** `chunk_load_error` bajo/cero + canario sintético en verde = usuarios protegidos. Si además los chunks solo-S3 dan 200 → la Capa 2 (retención) funciona de verdad (lo ideal).

## 4. El flujo del deploy (resumen)

`scripts/deploy-frontend.sh`: build (podman) → push ECR → **[2b] sync `.next/static` a S3 (retención)** + self-check → task def por digest → rolling → estable → smoke (home + auth + **un chunk carga vía CloudFront**). Guardrail `__tests__/guardrails/deploy-scripts.test.ts` impide quitar el sync a S3. Detalle: `docs/runbooks/pusheo-revision-despliegue.md`.

## 5. Aprendizajes (para no tropezar dos veces)

- **El monitor/panel eran server-céntricos** → decían "verde" mientras usuarios se congelaban. Por eso ahora hay captura de errores de CLIENTE (`chunk_load_error`, etc.) + canario sintético EXTERNO. La verdad del usuario NO está en los logs de servidor.
- **La retención de assets es la clave**, no el version-check. Servir `_next/static` del contenedor efímero es la trampa; S3 con retención (sin `--delete`) es la solución canónica de OpenNext que aquí se había saltado.
- **Defense in depth funciona:** cuando la Capa 2 (S3) falló silenciosamente (ver siguiente punto), las Capas 3 (ALB fallback) + 4 (auto-reload) mantuvieron a los usuarios sin congelar (0 `chunk_load_error`). Nunca depender de una sola capa.
- **⚠️ CAUSA RAÍZ CONFIRMADA CloudFront↔S3 (05/07):** el behavior `/_next/static/*` usa la **origin-request-policy `33f36d7e-f396-46d9-90e0-52428a34d9dc`** con `HeaderBehavior: allViewerAndWhitelistCloudFront` → **reenvía el `Host` del visitante (`www.vence.es`) al origen**. El **ALB lo necesita** para enrutar por host; pero un origen **S3 recibe `Host: www.vence.es`**, no reconoce el bucket → error → 404 (`x-cache: Error from cloudfront`), aunque el GET directo a S3 dé 200. **Un mismo behavior NO puede alimentar ALB (necesita Host del visitante) y S3 (necesita Host del bucket) a la vez** — por eso el origin group falló. **NO era OAC** (probé bucket público + sin OAC, mismo 404): es el `Host`.
  - **El fix real de la Capa 2** (pendiente, sesión dedicada off-peak): **servir los assets desde un subdominio propio `assets.vence.es`** (distribución CloudFront que solo habla con S3, sin reenviar `Host`) + `assetPrefix` en Next. Desacopla por construcción → el bug de Host es imposible, y descarga al contenedor. **Plan paso a paso ejecutable: [`docs/roadmap/assets-cdn-subdominio.md`](../roadmap/assets-cdn-subdominio.md)** (incluye por qué/qué mejora, recursos AWS reutilizables ya verificados, orden de cutover, rollback y gotchas de CORS).
  - **Incidente 05/07 (aprendizaje operativo):** al depurar esto en caliente apunté el behavior directamente al origen S3 → rompió TODOS los chunks (incluidos los actuales) unos minutos → **rollback inmediato** al `vence-alb-origin` restauró el serving (impacto real: **0 `chunk_load_error`**, la caché de navegador/CloudFront amortiguó; solo algún `http_network_error`). **Lección: NO tocar el behavior de `_next/static` en horario con tráfico**; probar en un path/objeto aislado. El diagnóstico correcto es subir **un objeto único solo-S3 y pedirlo por CloudFront** (aísla del fallback del ALB, que enmascara el problema con los chunks actuales).
  - **Diseño alternativo más limpio** que evita el choque de Host: separar las CDNs — servir `_next/static` desde un `assets.vence.es` (o el dominio nativo de CloudFront del bucket) con su propio behavior/OAC, y dejar `www.vence.es` solo para el ALB. Evaluar en la sesión del fix.
- **Guardrails que quedaron:** el guardrail del sync a S3 + el self-check en el deploy + el canario sintético + `RULE_CANARY_SYNTHETIC_EXTERNAL_FAILED`. Si alguien revierte el sync o rompe los assets, salta antes de afectar usuarios.
- **SIGPIPE en el deploy script:** `find | head` / `aws s3 sync | tail` bajo `set -o pipefail` rompen con exit 141 (head/tail cierran el pipe). Usar `find -print -quit`, redirigir a fichero, o `|| true`.
