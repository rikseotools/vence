# 🎯 Load Testing — Vence

Suite k6 profesional para validar el frontend antes del cutover de Vercel
a AWS. Cubre 5 escenarios complementarios + observabilidad post-run.

## 📋 Índice

1. [Cuándo correr cada escenario](#cuándo-correr-cada-escenario)
2. [Cómo correr local](#cómo-correr-local)
3. [Cómo correr en CI (GHA)](#cómo-correr-en-ci-gha)
4. [Interpretar resultados](#interpretar-resultados)
5. [Thresholds que BLOQUEAN cutover](#thresholds-que-bloquean-cutover)
6. [Debugging fallos](#debugging-fallos)

---

## Cuándo correr cada escenario

| TYPE | Duración | VUs pico | Cuándo |
|---|---|---|---|
| `smoke` | 2 min | 5 | Sanity check, validar que el script funciona. **Siempre antes de correr otro escenario**. |
| `load` | 18 min | 1000 | **PRE-CUTOVER OBLIGATORIO**. Simula pre-examen real. p95<800ms o no se cutover. |
| `stress` | 20 min | 5000 | Encontrar el techo: ¿a qué carga rompe ECS? Sin thresholds (queremos ver dónde cae). |
| `spike` | 5 min | 2000 | Pico súbito (post Twitter viral pre-examen). Aceptamos 5% errores mientras autoscaling reacciona. |
| `soak` | 1 hora | 100 | Detecta memory leaks + conexiones DB colgadas. Sostenido moderado. |

## Cómo correr local

### Setup (primera vez)

```bash
# Instalar k6 — Fedora
sudo dnf install -y k6

# o brew (Mac)
brew install k6

# o docker (cualquier OS)
docker pull grafana/k6
```

### Smoke (siempre primero)

```bash
# Default target: preview-aws.vence.es
k6 run -e TYPE=smoke loadtest/k6-vence.js

# Contra producción Vercel (baseline)
k6 run -e TYPE=smoke -e TARGET=https://www.vence.es loadtest/k6-vence.js
```

Smoke pasa en 2 minutos. Si revienta, el script tiene un bug — arregla antes de seguir.

### Load (pre-cutover crítico)

```bash
# Contra preview AWS — comparar contra Vercel después
k6 run -e TYPE=load -e TARGET=https://preview-aws.vence.es loadtest/k6-vence.js

# Salida en stdout + JSON en ./loadtest/k6-results.json + resumen ./loadtest/k6-load-summary.txt
```

### Stress (encontrar el techo)

```bash
# Ojo: cuesta dinero AWS (ECS autoscaling, CloudFront bandwidth).
# Sólo en preview, NUNCA contra prod sin avisar usuarios.
k6 run -e TYPE=stress -e TARGET=https://preview-aws.vence.es loadtest/k6-vence.js
```

Mira a partir de qué VUs el `error rate` sube del 5%. Ese es el límite real.

### Spike (chaos)

```bash
k6 run -e TYPE=spike -e TARGET=https://preview-aws.vence.es loadtest/k6-vence.js
```

Verifica que ECS Auto Scaling reacciona en <2 min (es el SLA típico).

### Soak (overnight)

```bash
# Déjalo correr antes de irte a dormir. 1h.
k6 run -e TYPE=soak -e TARGET=https://preview-aws.vence.es loadtest/k6-vence.js
```

Vigila si la latencia crece monotónicamente — indica leak. Si p95 estable durante 1h, no hay leaks.

---

## Cómo correr en CI (GHA)

Workflow `.github/workflows/loadtest.yml` (a crear si no existe):

```yaml
on:
  workflow_dispatch:
    inputs:
      type:
        type: choice
        options: [smoke, load, stress, spike, soak]
        default: smoke
      target:
        default: https://preview-aws.vence.es
```

Cuando lances el workflow:

```bash
# Dispara desde local
gh workflow run loadtest.yml -f type=load -f target=https://preview-aws.vence.es
```

Resultados se publican en:
- `./loadtest/k6-results.json` (artifact GHA, 14 días retención)
- `observable_events` tabla (si `POST_TO_OBSERVABILITY=1` + `INGEST_SECRET` seteado)
- Summary en el step output (markdown formateado)

---

## Interpretar resultados

### El summary que printea k6

```
═══════════════════════════════════════════════════════════════════
  🎯 Vence — LOAD test
  Target:    https://preview-aws.vence.es
  Duración:  1080s
═══════════════════════════════════════════════════════════════════

REQUESTS (45000 total)
  p50 / p95 / p99:     120ms / 420ms / 980ms
  max:                 3200ms
  failed rate:         0.02%

POR ENDPOINT (p95)
  home:                85ms       ← cache CloudFront edge
  oposicion-landing:   210ms      ← SSR
  temario:             190ms      ← SSR
  tema (★):            580ms      ← SSR + BD query, el más crítico
  ley:                 240ms
  ayuda:               150ms

ERRORES
  4xx rate:            0.01%      ← OK, alguien hizo 404 random
  5xx rate:            0.00%      ← ✅ ningún 5xx
  content broken rate: 0.00%      ← ✅ todo body válido

VEREDICTO (★ aplica thresholds cutover)
  ✅ error rate < 1%       (real: 0.02%)
  ✅ p95 < 800ms             (real: 420ms)
  ✅ p99 < 2000ms            (real: 980ms)
  ✅ home p95 < 500ms        (real: 85ms)
  ✅ tema p95 < 1500ms       (real: 580ms)
  ✅ 5xx rate < 0.1%        (real: 0.00%)
  ✅ content broken < 1%    (real: 0.00%)

  🟢 PASS — cutover GO
═══════════════════════════════════════════════════════════════════
```

### Qué mirar primero

1. **Verdict bloque final**. 🟢 PASS = puedes cutover. 🔴 FAIL = NO cutover.
2. **5xx rate**. Cualquier 5xx significa que ECS/RDS no responde. Investigar logs CloudWatch.
3. **p95 vs p50**. Diferencia grande (>5x) = cola larga (algo lento bajo carga). Cache miss masivo, conexión DB exhausta, etc.
4. **Por endpoint**. ¿Es `tema` quien lleva la carga? Esperable (SSR + BD). Si es `home` => CloudFront NO está cacheando.

---

## Thresholds que BLOQUEAN cutover

Solo aplican a `TYPE=load`. Los demás escenarios tienen thresholds adaptados.

| Métrica | Threshold | Razón |
|---|---|---|
| `http_req_failed` | <1% | Si más errores, hay un bug funcional bajo carga |
| `http_req_duration p95` | <800ms | UX malo si más alto, usuarios abandonan |
| `http_req_duration p99` | <2000ms | Cola larga máxima razonable |
| `home_latency p95` | <500ms | Home es CDN-cached, debe ser rápida |
| `tema_latency p95` | <1500ms | Página dinámica más crítica, hay margen |
| `errors_5xx` | <0.1% | 5xx = servidor falla, casi cero tolerancia |
| `content_broken` | <1% | 200 OK con body roto, cubre regresiones tipo |

Si alguno falla → **no cutover, investigar primero**.

---

## Debugging fallos

### "Errores 5xx altos"

1. CloudWatch logs: `aws logs tail /ecs/vence-frontend --since 30m --region eu-west-2`
2. Sentry issues: filtra por entorno preview-aws las últimas 24h.
3. observable_events: `SELECT * FROM observable_events WHERE event_type='http_5xx' AND ts > NOW() - INTERVAL '30 min'`.

### "p95 muy alto"

Causa posible: CloudFront NO está cacheando lo que debería.

```bash
# Ver cache hits/miss desde CloudFront real-time logs
aws cloudfront get-distribution --id E1EH4WF1H7ZGLA --query 'Distribution.Status'
```

Si en headers ves `x-cache: Miss from cloudfront` para `/_next/static/*`, hay bug en behaviors de la distribution.

### "El test mismo se cae (k6 OOM)"

Tu máquina local NO tiene RAM para 1000+ VUs. Opciones:
- Reducir VUs: `-e MAX_VUS=200`
- Correr en GHA (runner tiene 7 GB RAM)
- Usar k6 Cloud (de pago) para >5000 VUs

### "Resultados inconsistentes entre runs"

Causas comunes:
- **Cache warmup**: primer run con cache vacío. Repite 2-3 veces, descarta el primero.
- **ECS cold start**: si `desired_count=0→1`, hay ~30s de tiempo de arranque. Asegúrate de que `desired_count>=1` antes.
- **Hora del día**: prod tráfico real puede contender. Corre a las 3am.

---

## Ver también

- `loadtest/k6-vence.js` — script principal
- `.github/workflows/loadtest.yml` — automatización CI (pendiente E.4.3)
- [docs/runbooks/observability.md](../docs/runbooks/observability.md) — métricas runtime
- [docs k6 oficial](https://k6.io/docs/) — referencia
