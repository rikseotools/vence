# Migración de formato `article_number` (deuda histórica)

> **Estado:** pendiente — sesión dedicada (2-3 días). Investigado el 19/05/2026, no aplicado.

## Resumen

`articles.article_number` tiene **dos formatos mezclados en BD** para disposiciones (DA/DT/DD/DF):

- **Canónico (correcto):** `DA1`, `DT9`, `DF4`, `DAunica`, etc.
- **Largo legacy:** `DA_adicional_primera`, `DA_final_cuarta`, `DA_transitoria_quinta`, etc.

El normalizador actual (`normalizeArticleNumber` en `lib/boe-extractor.ts:545`) convierte el formato largo al canónico, pero hay **230+ artículos en BD con el formato largo histórico** (importaciones previas al normalizador).

El test `__tests__/integration/topicScopeIntegrity.test.ts` detecta 529 article_numbers no normalizados (límite tolerado: 500). Test marcado `.skip()` con TODO apuntando a este documento.

## Por qué NO se ha migrado

### 11 tablas guardan article_number como STRING (no como FK al UUID)

| Tabla / Vista | Columna | Riesgo |
|---|---|---|
| `articles` | `article_number` | Fuente |
| `topic_scope` | `article_numbers[]` | Refs de temarios → 100 refs en formato largo |
| `content_scope` | `article_numbers[]` | Similar a topic_scope |
| `test_questions` | `article_number` | **Estadísticas históricas de cada respuesta de usuario** |
| `hot_articles` | `article_number` | Cálculo de top artículos |
| `user_learning_analytics` | `article_number` + `recommended_focus_articles[]` | Analytics usuario |
| `article_update_logs` | `article_number` | Audit trail histórico |
| `ai_api_usage` | `article_number` | Métricas de IA |
| `ai_verification_errors` | `article_number` | Errores verificación |
| `legal_modifications` | `article_numbers[]` | Modificaciones BOE |
| `admin_disputes_dashboard` (vista) | `article_number` | Probablemente VIEW derivada |

Migrar solo `articles` deja las demás inconsistentes. Migrar las 11 en cascada en una transacción es **complejo y propenso a errores**.

### URLs públicas usan article_number como path

```
app/teoria/[law]/[articleNumber]
app/api/teoria/[law]/[articleNumber]
```

Renombrar `DA_adicional_primera` → `DA1` produce **404** en:
- Bookmarks de usuarios
- Enlaces compartidos en chats/foros/email
- URLs indexadas en Google (impacto SEO)
- Enlaces internos en el código

### Código asume formato específico en varios puntos

- `lib/procedimientoAdministrativoSSR.ts`: `.eq('article_number', articleNumber)` en queries
- `lib/ley39SSR.ts`: `.in('article_number', articleNumbers)`
- `lib/lawFetchers.ts`: `parseInt(article_number)` — **`parseInt('DA1')` = NaN** → rompería filtros numéricos si la migración mezclara strings numéricos y `DA*`
- `lib/api/topic-progress/user-answers.ts`: lectura por string

### Cache layer

- ISR de Vercel cachea páginas `/teoria/[law]/[articleNumber]` con TTL 1h-24h.
- `unstable_cache` con tag `articles` cachea respuestas de la query layer.
- Una migración sin invalidación coordinada deja inconsistencias varias horas.

## Plan de migración recomendado (cuando se aborde)

### Opción A — Migrar masivamente con redirects (2-3 días)

1. **Audit completo** de todas las refs (no solo las 11 tablas — buscar en código cualquier hardcoded del formato largo).
2. **Generar mapping** `legacy → canónico` para todos los 230+ artículos afectados.
3. **Transacción única** que actualiza las 11 tablas en cascada usando el mapping.
4. **Migration 301 redirects** para las URLs públicas (siguiente capa Next.js o tabla de redirects).
5. **Invalidar todos los caches** (ISR + `unstable_cache` `articles` + Redis).
6. **Verificación post-migración**: ambos tests pasan (`topicScopeIntegrity` + `temarioDataQuality`).
7. **Monitoreo SEO** durante 1-2 semanas (Search Console).

### Opción B — Dual-format support (1-2 días) — alternativa más segura

Modificar el resolver de `[articleNumber]` en `app/teoria/[law]/[articleNumber]/page.tsx` para que acepte **ambos formatos** como equivalentes:

- `/teoria/ley-39-2015/DA_adicional_primera` → carga el artículo canónico `DA1`.
- `/teoria/ley-39-2015/DA1` → carga el mismo.

Pros:
- No rompe URLs históricas ni necesita redirects.
- Las 11 tablas pueden migrarse paulatinamente sin urgencia.
- Robusto frente a cualquier formato futuro.

Contras:
- La normalización se hace en runtime, no en BD.
- El test `topicScopeIntegrity` sigue detectando la deuda hasta que se migre BD.

**Recomendación:** Opción B primero (mitiga el riesgo de URLs), luego Opción A paulatina en sesiones dedicadas.

## Cómo reactivar el test

El test está marcado `describe.skip(...)` en `__tests__/integration/topicScopeIntegrity.test.ts` (el bloque que verifica formato normalizado, no los demás bloques del archivo).

Tras la migración:
1. Eliminar `.skip` del describe correspondiente.
2. Bajar el límite `expect(errors.length).toBeLessThan(500)` a `0`.
3. Verificar que pasa en CI.

## Vinculación con otros tests

- **`temarioDataQuality.test.ts`** (50 refs rotas): parte de las refs rotas son refs en topic_scope a formato largo que ya no encuentran el artículo en `articles` tras un rename parcial. Se beneficiará del mismo fix.
- **`temarioEpigrafeIntegrity.test.ts`** (27 vs 25 descripciones): independiente, aborde por separado.

## Historial de la decisión

- **2026-05-19**: investigado durante cleanup de tests obsoletos. Detectado el alcance real (11 tablas + URLs públicas + parseInt hardcoded). Decidido aplazar a sesión dedicada.
