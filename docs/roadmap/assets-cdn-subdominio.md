# Plan: CDN de assets estáticos en subdominio propio (`assets.vence.es`)

> **Estado:** PLANIFICADO (no ejecutado). Se ejecuta en sesión dedicada, off-peak.
> **Complementa:** `docs/runbooks/despliegue-proteccion-congelacion.md` (§2 Capa 2/3, §5 causa raíz del choque de Host).
> **Memoria:** `project_deploy_freeze_chunks_s3`.

## 1. Por qué se hace y qué mejora

### El problema que resuelve
Next.js parte la app en **chunks JS inmutables** (`/_next/static/chunks/<hash>.js`). Hoy se sirven desde el **contenedor ECS efímero**: cada deploy reemplaza el contenedor → los hashes viejos **desaparecen del origen** → un usuario que cargó la app antes del deploy pide un chunk viejo → **404 → `ChunkLoadError` → app congelada** (caso Nila y otros, 05/07/2026).

Hoy los usuarios están protegidos por **redes de seguridad** (version-check + auto-reload de `ChunkLoadError`) → **0 congelamientos medidos**. Pero eso resuelve el síntoma con **una recarga**, no la causa. La causa es *dónde viven los chunks*.

### Qué mejora (los tres ejes que pidió Manuel)

| Eje | Hoy (chunks en contenedor) | Con `assets.vence.es` |
|-----|---------------------------|----------------------|
| **Robustez** | El chunk viejo desaparece en cada deploy; sobrevive solo por redes de seguridad (recarga) | Chunk viejo **sigue existiendo** en S3 (retención) → deploy **sin interrupción por construcción** (modelo Vercel). Cero recargas. |
| **Escalabilidad** | Cada `_next/static` que hace miss en CloudFront **pega al contenedor** → el estático compite con el SSR por CPU/tasks | S3+CloudFront escala infinito y **descarga al contenedor** → puedes bajar tasks ECS / coste; el contenedor solo hace SSR |
| **Profesionalidad** | Patrón OpenNext estándar saltado | CDN de assets **separada** de la app — estándar de industria (Vercel/Netlify). Assets versionables e invalidables independientemente |

### Por qué un subdominio y no el mismo dominio
El **intento anterior falló** (incidente 05/07): montar `/_next/static` sobre un origin group [S3→ALB] **en el mismo behavior** que el ALB colisiona por el **`Host` header**. El behavior comparte la origin-request-policy `33f36d7e-...` (`allViewerAndWhitelistCloudFront`) que **reenvía `Host: www.vence.es`** al origen: el ALB lo necesita para enrutar, pero S3 lo rechaza (no reconoce el bucket) → 404. **Un mismo behavior no puede alimentar ALB y S3 a la vez.**

`assets.vence.es` **desacopla por construcción**: es una distribución que *solo* habla con S3, con su propia policy que **no reenvía Host** → CloudFront pone el Host del bucket. El bug es **imposible** porque no hay ALB en esa ruta. Robustez = desacoplar las dos responsabilidades que colisionaron.

## 2. Arquitectura objetivo

```
www.vence.es      → CloudFront (E1EH4WF1H7ZGLA) → ALB → contenedor ECS   (SSR/dinámico, /_next/image, /public)   [SIN CAMBIOS]
assets.vence.es   → CloudFront (NUEVA distro)   → S3 (OAC, privado)      (solo /_next/static/*, inmutable+retención)
```

- Next.js `assetPrefix: 'https://assets.vence.es'` → los `<script src>` de chunks apuntan al subdominio.
- `/_next/image` (optimizador) y `/public/*` (logo, favicon, og-images) **siguen en `www`** (assetPrefix NO los reescribe) → no requieren cambios.
- Bucket con **retención** (sync sin `--delete`, ya lo hace el deploy) → los chunks viejos nunca mueren.

## 3. Recursos existentes reutilizables (verificado 05/07)

| Recurso | Valor |
|---------|-------|
| Bucket S3 | `vence-frontend-static` (eu-west-2) — ya poblado por deploy `[2b]` |
| OAC | `EQ1WY9CD6NF8M` (`vence-frontend-static-oac`) — reutilizable |
| Cert ACM (us-east-1) | `arn:aws:acm:us-east-1:349744179687:certificate/6bd69914-4c4c-4aef-a254-002ab478a448` → **cubre `*.vence.es`** (no hace falta cert nuevo) |
| Route53 hosted zone | `Z01385401PSL7GV8AZJ8G` (`vence.es.`) |
| Distro principal (referencia) | `E1EH4WF1H7ZGLA` (`www.vence.es`) — **NO se toca** |
| Deploy sync a S3 | `scripts/deploy-frontend.sh` paso `[2b]` — ya sincroniza `_next/static` a `vence-frontend-static` |
| Version del bundle | `NEXT_PUBLIC_DEPLOY_VERSION` (para version-check) — ya inyectada |

## 4. Plan paso a paso

> **Regla de oro (lección del incidente):** NO tocar el behavior de `_next/static` de la distro `www` con tráfico. Todo lo nuevo se monta en paralelo en `assets.vence.es` y solo se conecta con `assetPrefix` cuando esté verificado.

### Fase 0 — Precondición
1. Confirmar que S3 tiene los chunks del build **vivo**: el deploy `[2b]` ya sincroniza. Verificar un chunk actual: `aws s3 ls s3://vence-frontend-static/_next/static/chunks/ | tail`.
2. Bucket privado + política de acceso vía OAC (ya está privado tras la limpieza del 05/07).

### Fase 1 — Distribución de assets (en paralelo, sin afectar a nadie)
3. **Bucket policy** para el nuevo OAC/distro: permitir `s3:GetObject` solo desde la distribución de assets (principal `cloudfront.amazonaws.com`, condición `AWS:SourceArn` = ARN de la nueva distro). Reutilizar OAC `EQ1WY9CD6NF8M`.
4. **Crear distribución CloudFront** nueva:
   - **Origin:** `vence-frontend-static.s3.eu-west-2.amazonaws.com` con OAC `EQ1WY9CD6NF8M` (sigv4, always).
   - **Alias (CNAME):** `assets.vence.es`; **cert** `6bd69914-...` (SNI, TLSv1.2_2021).
   - **Default behavior:** `GET,HEAD`; **cache-policy** `CachingOptimized` (`658327ea-f89d-4fab-a63d-7e88639e58f6`); **origin-request-policy = NINGUNA** (clave: que NO reenvíe `Host`); compress=on; redirect-to-https.
   - **Response-headers-policy CORS:** managed `SimpleCORS` (`60669652-455b-4ae9-85a4-c4c02393f86c`) o una propia con `Access-Control-Allow-Origin` para que las **webfonts** cross-origin no fallen (gotcha crítico, §6).
   - Opcional: **OriginPath** vacío; los objetos ya están bajo `_next/static/` en el bucket, y `assetPrefix` pide `/_next/static/...` → casa 1:1 sin OriginPath.
5. **DNS:** registro `assets.vence.es` A/AAAA **ALIAS** al dominio de la nueva distro en Route53 zona `Z01385401PSL7GV8AZJ8G`.
6. **Verificar EN AISLADO** (sin tocar la app): `curl -I https://assets.vence.es/_next/static/chunks/<hash-actual>.js` → **200** + `access-control-allow-origin` presente. Probar un hash inexistente → **403/404 limpio** (no cuelga). Hasta que esto sea verde, NO seguir.

### Fase 2 — Conectar la app (el único cambio de código)
7. En `next.config.mjs`, dentro de `nextConfig`, añadir (solo en prod):
   ```js
   assetPrefix: process.env.NODE_ENV === 'production' ? 'https://assets.vence.es' : undefined,
   ```
   *(dejar `undefined` en dev para que `localhost:3000` sirva sus propios assets).*
8. **Deploy frontend** (`scripts/deploy-frontend.sh`) — el paso `[2b]` ya deja los chunks nuevos en S3 **antes** de que el HTML nuevo (que los referencia en `assets.vence.es`) se sirva. Orden seguro por construcción:
   - Build → sync a S3 (chunks nuevos disponibles en `assets`) → rolling del contenedor (HTML nuevo referencia `assets`).
   - Usuarios en bundle **viejo**: siguen pidiendo chunks a `www/_next/static` (mismo-origen, contenedor) → **funcionan** (aditivo, no se quita nada).
   - Usuarios nuevos: piden a `assets.vence.es` → S3.
9. **Verificar post-deploy:** ver `https://www.vence.es/` → los `<script src>` apuntan a `https://assets.vence.es/_next/static/...` y cargan 200. `chunk_load_error` sigue en 0.

### Fase 3 — Endurecer (opcional, cuando repose ~1 semana)
10. Actualizar el **smoke** del deploy (`scripts/deploy-frontend.sh`) para probar un chunk vía `assets.vence.es` (además de `www`).
11. Apuntar el **canario sintético externo** (`backend/src/canary-synthetic-external`) también a `assets.vence.es`.
12. Marcar en `despliegue-proteccion-congelacion.md` la Capa 2/3 como **ACTIVA** y actualizar la memoria.
13. (Higiene) el behavior `/_next/static/*` de la distro `www` puede quedarse como está (fallback natural para bundles viejos) — no urge quitarlo.

## 5. Verificación / Rollback

- **Verificar:**
  ```bash
  # objeto solo en S3, servido por assets → 200 + CORS
  curl -sI "https://assets.vence.es/_next/static/chunks/<hash>.js" | grep -iE "HTTP|access-control-allow-origin|x-cache"
  # la home referencia assets.vence.es
  curl -s https://www.vence.es/ | grep -oE 'https://assets\.vence\.es/_next/static/[^"]+' | head
  # 0 chunk_load_error tras el deploy
  # (query observable_events event_type='chunk_load_error' últimas 6h)
  ```
- **Rollback instantáneo:** quitar `assetPrefix` de `next.config.mjs` + redeploy → los chunks vuelven a mismo-origen (`www`), que sigue sirviéndolos desde el contenedor. La distro de assets puede quedarse (inocua). Las redes de seguridad (version-check + auto-reload) siguen activas en todo momento.

## 6. Gotchas (no tropezar)

1. **CORS de webfonts (crítico):** una fuente en `@font-face` servida desde `assets.vence.es` mientras la página está en `www.vence.es` es **cross-origin** → sin `Access-Control-Allow-Origin` la fuente **falla en silencio** (texto sin render / FOUT). Por eso el response-headers-policy CORS en el behavior de assets es **obligatorio**, no opcional.
2. **Orden de cutover:** S3 debe tener los chunks **antes** de servir el HTML que los referencia. El deploy ya lo garantiza (`[2b]` sync antes del rolling), pero si se cambia el script, respetar ese orden o los primeros clientes verán 404.
3. **NO reenviar `Host`** en el behavior de assets (origin-request-policy = ninguna). Reenviarlo reintroduce exactamente el bug del 05/07.
4. **`assetPrefix` NO afecta a `/public` ni `/_next/image`** → logo, favicon, og-images y el optimizador de imágenes siguen en `www`. Correcto y deseado (no requieren CDN separada).
5. **Redirect www:** la regla `host === 'vence.es' → www` en `next.config.mjs` **no** captura `assets.vence.es` (match exacto), y además los assets ni pasan por el server. Sin conflicto.
6. **Off-peak:** aunque el diseño es aditivo, cualquier cambio de CloudFront se hace con tráfico bajo. El incidente del 05/07 fue por tocar el behavior en caliente.

## 7. Coste
- Distribución CloudFront extra: **$0 fijo** (se paga por request/transferencia, y el tráfico de assets ya se paga hoy en la distro `www` — se **mueve**, no se suma).
- S3 storage de la retención: chunks son pequeños (~KB) y acumulan lento; céntimos/mes. Puede añadirse una **lifecycle rule** para expirar objetos > 90 días si preocupa (los bundles de hace 3 meses ya no los usa nadie).
- **Ahorro potencial:** el contenedor deja de servir estático → menos CPU → margen para bajar tasks ECS.
