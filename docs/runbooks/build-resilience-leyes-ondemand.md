# Runbook — Fiabilidad del build: migrar `/leyes/[law]` a on-demand (fin del SSG masivo)

> **Estado:** DISEÑO (no implementado). **Cuándo aplicar:** cuando el usuario diga *"arregla la flakiness del build"*, *"el build falla / OOM / CONNECT_TIMEOUT"*, o al retomar esta tarea. **Relacionado:** `docs/maintenance/cache-revalidation.md` (el patrón force-dynamic + warming ya está establecido ahí desde 30/04/2026).

## El problema (cuantificado)

El build de frontend falla **de forma intermitente** con dos síntomas distintos, ambos observados el 12/07/2026 en despliegues seguidos:
1. **`CONNECT_TIMEOUT` a RDS** durante el prerender de `/leyes/[law]` → el build entero muere.
2. **`SIGKILL` (OOM)** en `next build` → sin memoria.

**Causa raíz (una sola):** `app/leyes/[law]/page.tsx` tiene `generateStaticParams()` que devuelve **TODOS los slugs de leyes activas** → el build prerenderiza **1.278 páginas** en cada deploy, cada una con varias queries a RDS.
- **RDS-timeout:** 1.278 × N queries en build-time. Una sola que dé `CONNECT_TIMEOUT` tumba el build → la fiabilidad del build queda **acoplada a la carga de RDS**.
- **OOM:** Next mantiene las 1.278 páginas en memoria durante el build → SIGKILL en un runner ajustado.

**`/leyes/[law]` es la ÚNICA ruta de alto volumen que sigue en SSG real.** Todas las demás dinámicas (`/teoria/[law]/[articleNumber]`, `/oposiciones/[filtro]`, `/[oposicion]/test/tema/[numero]` ×3) ya devuelven `generateStaticParams() → []` (on-demand). Es un **outlier que se quedó atrás** en la migración del 30/04/2026.

## Por qué NO es una chapuza ni arquitectura nueva

**El proyecto ya resolvió exactamente este problema** (`cache-revalidation.md`, 30/04/2026): migró temario, test y landings de SSG (~3600 páginas) a **`force-dynamic` + cache warming** por los MISMOS síntomas (statement timeout, builds de 30+ min que fallaban). El fix aquí es **hacer `/leyes/[law]` consistente con el resto** — no inventar nada.

## SEO: por qué es seguro (con el precedente del propio proyecto)

`cache-revalidation.md` línea 660 (sobre la migración force-dynamic): *"SEO intacto: Google recibe HTML completo con metadata, canonical URLs, Schema.org — igual que con SSG."*

- **On-demand NO significa página en blanco:** Next renderiza el HTML COMPLETO en el primer request (SSR) y lo cachea. Googlebot siempre recibe HTML idéntico al de SSG. El único cambio es que el primer hit se genera en request-time en vez de en build-time.
- **`dynamicParams = true`** (default): las páginas no listadas en `generateStaticParams` se generan on-demand, **NO dan 404**. ⚠️ NUNCA poner `dynamicParams = false` — 404 masivo = desastre SEO.
- **Riesgo real y su mitigación:** un primer hit en frío con RDS lento podría tardar/500. Se mitiga con (a) **warming post-deploy de las SEO-críticas** y (b) los caches de datos que ya existen (`laws`/`teoria` versionedCache) → la query de la página ya sale de cache, no de RDS crudo.

## Diseño (3 piezas)

### Pieza 1 — quitar el SSG masivo
`app/leyes/[law]/page.tsx`:
```ts
export async function generateStaticParams() { return [] }   // era: getAllActiveSlugs() → 1.278
export const dynamicParams = true       // explícito: nada da 404 (default, pero lo fijamos)
export const revalidate = 86400         // ISR 24h como landings/temarios (o false + revalidación por dato, ver Pieza 2)
```
Resultado: **build prerenderiza 0 páginas de leyes → 0 queries RDS en build + sin OOM.** La página se genera on-demand + se cachea.

**Opción hot-set (recomendada para SEO):** en vez de `[]`, devolver las **~30-50 leyes de más tráfico** (desde Google Search Console, `npm run gsc:seo`) para que las importantes sí se prerenderen en build. El resto on-demand. Compromiso: 40× menos páginas en build, SEO de las top garantizado.

### Pieza 2 — revalidación disparada por el DATO (no por el deploy)
Las páginas de ley cambian solo cuando el BOE reforma la ley. El monitor BOE ya detecta esos cambios → debe disparar `revalidatePath('/leyes/<slug>')` de esa ley concreta (ya existe `/api/purge-cache` que hace `revalidatePath`; `purge-all-cache.js` cubre todas las leyes). Así el cache lo invalida el dato que lo alimenta, no la cadencia de deploy. Con esto se puede usar `revalidate = false` (permanente) en vez de 24h.

### Pieza 3 — warming post-deploy de las SEO-críticas
`scripts/warm-cache-post-deploy.js` hoy calienta solo `/leyes` (el índice), NO las `/leyes/[law]` individuales. Añadir las top-N leyes (GSC) al set de warming → tras cada deploy quedan calientes antes del tráfico real → cero riesgo de cold-hit para las que rankean. `purge-all-cache.js` ya sabe listar todas las leyes; reutilizar esa lógica acotada a top-N.

## Capas de seguridad (conforme la memoria)
- **Guardarraíl:** test que verifica `dynamicParams === true` y que `generateStaticParams` NO devuelve las 1.278 (`__tests__/guardrails/leyes-ondemand.test.ts`). Anti-regresión del 404 masivo.
- **Canary:** verificar que las top-N leyes SEO responden **200 + HTML con `<title>`/canonical** tras deploy (extender el warming a que falle si una top responde ≠200).
- **Simulación:** en local/preview, medir tiempo del primer hit en frío de `/leyes/constitucion-espanola` (debe ser aceptable, <1-2s con el cache de datos).
- **Observabilidad:** vigilar `http_5xx`/`http_timeout` en `/leyes/[law]` tras el deploy (ya cubierto por `RULE_HTTP_5XX_SPIKE`); si sube, algún cold-hit falla → warming insuficiente.
- **Rollback:** revertir `generateStaticParams` a `getAllActiveSlugs()` (vuelve a SSG). El build volvería a ser frágil pero funcional. O `TOPIC_MV_ENABLED`-style flag si se quiere gradual.

## Verificación (checklist de PR)
1. `generateStaticParams` acotado (o `[]`) + `dynamicParams = true` explícito.
2. Build local: confirmar que NO prerenderiza 1.278 páginas (`.next` build output: `/leyes/[law]` como ƒ/ISR, no ● SSG de 1.278).
3. SEO spot-check: `curl -s https://<preview>/leyes/constitucion-espanola | grep -E '<title>|canonical'` → HTML completo.
4. Warming: las top-N leyes en el set de `warm-cache-post-deploy.js`; el workflow no reporta fallos.
5. CloudFront: el deploy ya invalida `/*` (frontend-deploy.yml) → no hay que tocar nada.
6. Tras deploy: 0 spike de 5xx en `/leyes/[law]` (observabilidad) durante 1h.

## Impacto esperado
- **Build:** de ~1.278 prerenders RDS-dependientes → 0 (o ~40 del hot-set). Fin de `CONNECT_TIMEOUT` y OOM por esta causa. Build más rápido.
- **SEO:** intacto (mismo HTML; top calientes; nada 404).
- **Runtime:** primer hit de una ley long-tail se genera on-demand (cacheado luego). Las 1.278 páginas dejan de ser "estáticas para siempre" y pasan a frescas-cuando-cambia-el-BOE (Pieza 2).

## Fuera de scope (pero relacionado, a vigilar)
- `/ayuda/[slug]` también hace SSG real, pero es un set pequeño (artículos de ayuda) → no causa la flakiness. Dejar como está salvo que crezca.
- Los 2 scripts pre-build (`check-help-articles`, `sync-theme-names`) pegan a RDS pero son 1 query cada uno → menores; si el build sigue frágil, darles el mismo reintento/skip-si-no-DB que ya tienen parcialmente.
