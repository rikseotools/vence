# Lambda Headless Fetcher

Función AWS Lambda que renderiza páginas JS-rendered con Playwright + Chromium headless y devuelve el HTML post-hydration.

**Fase 1 del roadmap** `docs/roadmap/deteccion-convocatorias-oeps-completo.md`.

## ¿Por qué existe?

El audit Fase 0 (`docs/maintenance/audit-seguimiento-coverage.md`) confirmó que **38 de 45 oposiciones activas (84%)** tienen `seguimiento_url` apuntando a portales que requieren JavaScript para renderizar el contenido. El `fetch` nativo del backend NestJS solo ve el shell HTML vacío.

Esta Lambda resuelve el problema sin acoplar Chromium al backend principal: el backend invoca la Lambda síncronamente, recibe el HTML rendido y lo pasa por su pipeline existente (`cleanHtml` + Claude Haiku).

## Arquitectura

```
backend NestJS (Fargate)
   │
   │  AWS SDK invoke (sync)
   ▼
Lambda vence-backend-headless-fetcher
   │
   │  Playwright + Chromium
   ▼
Portal externo (Ayto, CCAA, etc.)
```

Aislamiento: si Chromium revienta, la Lambda muere y la siguiente invocación arranca limpia. El backend NestJS no se ve afectado.

## Bootstrap (primera vez)

La función Lambda referencia una imagen en ECR. Si el repo está vacío, `terraform apply` falla. Secuencia:

```bash
# 1. Crear solo el ECR repo
cd backend/infra
terraform apply -target=aws_ecr_repository.headless_fetcher

# 2. Build + push imagen inicial
cd headless-fetcher
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=eu-west-2
ECR_URL=${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/vence-headless-fetcher

aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

docker build --platform linux/amd64 -t vence-headless-fetcher:latest .
docker tag vence-headless-fetcher:latest ${ECR_URL}:latest
docker push ${ECR_URL}:latest

# 3. Apply completo (crea Lambda + IAM + log group + budget alert)
cd ..
terraform apply
```

Tras el bootstrap, los siguientes deploys de código van por CI/CD (ver más abajo).

## Deploy de código (post-bootstrap)

Terraform tiene `lifecycle { ignore_changes = [image_uri] }` en la Lambda. Esto separa la gestión de infra (Terraform) del deploy de código (CI/CD).

Manualmente:

```bash
cd backend/infra/headless-fetcher
docker build --platform linux/amd64 -t vence-headless-fetcher:latest .
docker tag vence-headless-fetcher:latest ${ECR_URL}:latest
docker push ${ECR_URL}:latest

aws lambda update-function-code \
  --function-name vence-backend-headless-fetcher \
  --image-uri ${ECR_URL}:latest \
  --region eu-west-2
```

Automatización CI/CD pendiente — ver Sprint 4 del roadmap.

## Test local

Con SAM CLI:

```bash
sam local invoke -e test/event-ayto-badajoz.json
```

Con Docker directo:

```bash
docker run --rm -p 9000:8080 vence-headless-fetcher:latest
curl -X POST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{"url": "https://www.aytobadajoz.es/es/ayto/convocatoriasempleo/59441/9-plazas-de-auxiliar-administrativo/"}'
```

## API del handler

**Input (event):**

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `url` | string | (obligatorio) | URL a renderizar |
| `wait_for` | string \| null | `null` | Selector CSS a esperar tras `networkidle` |
| `timeout_ms` | number | 30000 | Timeout total. Máx 55000 |
| `user_agent` | string | Chrome 130 macOS | UA custom |
| `viewport` | `{width, height}` | 1366×768 | Tamaño de viewport |

**Output:**

| Campo | Tipo | Descripción |
|---|---|---|
| `ok` | boolean | `true` si status ∈ [200, 400) y sin error |
| `status` | number | HTTP status final |
| `html` | string \| null | HTML rendido |
| `final_url` | string | URL final tras redirects |
| `render_time_ms` | number | Tiempo render (sin cold start) |
| `error` | string? | Mensaje si `ok=false` |

## Costes

Free tier AWS Lambda cubre 1M req/mes + 400.000 GB-seg/mes.

Volumen previsto: 26 oposiciones × 4 fetch/día × 30 días = 3.120 invocaciones/mes.
Por invocación: 2 GB × 15s avg = 30 GB-seg → 93.600 GB-seg/mes (23% del free tier).

CloudWatch logs marginales (~$1/mes con 30d retention).

**Coste real previsto primer año: $0-1/mes.**

AWS Budget alert configurado en $20/mes para detectar runaway.

## Observabilidad

Cada invocación emite evento a `OBSERVABILITY_INGEST_URL` (`/api/observability/ingest` del backend) con:

- `source = 'lambda-headless-fetcher'`
- `event_type = 'headless_fetch'`
- `duration_ms`, `status`, `final_url`, `html_bytes`
- `severity = 'error'` si `ok=false`

Visible en `/admin/observability` filtrando por source.

## Referencias

- Roadmap: `docs/roadmap/deteccion-convocatorias-oeps-completo.md`
- Audit: `docs/maintenance/audit-seguimiento-coverage.md`
- Terraform: `backend/infra/headless-fetcher.tf`
- @sparticuz/chromium: <https://github.com/Sparticuz/chromium>
