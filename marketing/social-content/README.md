# Pregunta del día en Instagram (@vence.es)

Publica 1 pregunta/día en Instagram: elige una pregunta `approved` nunca
publicada, genera una imagen (Pillow), la sube a S3 y la publica vía Meta Graph
API, registrando en `instagram_posts` (anti-repetición).

- **Script:** `instagram_daily.py` (Python; `DRY_RUN=1` → elige+genera imagen, NO publica).
- Env que necesita: `DATABASE_URL`, `META_ADS_ACCESS_TOKEN`, `META_IG_USER_ID`,
  `AWS_S3_BUCKET`, `AWS_S3_REGION`. `DRY_RUN` opcional.

## Ejecución en AWS (Fargate programado) — desde 2026-07-07

**Migrado de GitHub Actions a AWS** (era `.github/workflows/instagram-pregunta-dia.yml`,
ahora `.DISABLED`). Motivo: el guard "solo 10:00 Madrid" + los retrasos habituales
de GitHub cron hacían que casi nunca disparara (llevaba semanas sin publicar; los
posts eran runs manuales). EventBridge Scheduler dispara **exacto** a las 10:00
Madrid (timezone con DST), sin guard ni retrasos.

**Por qué Fargate y no Lambda:** la tarea necesita a la vez RDS (VPC, SG
restringido) **e** internet (Meta/S3). La VPC no tiene NAT gateway, así que una
Lambda no puede tener ambas cosas sin pagar NAT (~32 $/mes). Una tarea Fargate en
las subnets **públicas** de ECS (IP pública) tiene las dos → mismo modelo que los
servicios ECS. Coste: céntimos (~1 min/día).

### Recursos AWS (cuenta 349744179687, eu-west-2)

| Recurso | Nombre |
|---|---|
| Imagen | ECR `vence-instagram-daily:fargate` (build `Dockerfile.fargate`) |
| Task def | `vence-instagram-daily` (Fargate, 256cpu/512mem) |
| Roles | `vence-instagram-daily-exec-role` (ECR+logs+SSM), `-task-role` (s3:PutObject), `-scheduler-role` (ecs:RunTask) |
| Secrets | SSM `/vence-social/{DATABASE_URL, META_ADS_ACCESS_TOKEN, META_IG_USER_ID}` (SecureString) |
| Schedule | EventBridge `vence-instagram-daily` — `cron(0 10 * * ? *)` tz `Europe/Madrid` → RunTask |
| Logs | CloudWatch `/ecs/vence-instagram-daily` |
| Red | subnets/SG de ECS (`sg-0663f77e0d44ca693`, subnets públicas, AssignPublicIp) |

### Rebuild + redeploy (tras cambiar el script)

```bash
IMG=349744179687.dkr.ecr.eu-west-2.amazonaws.com/vence-instagram-daily:fargate
aws ecr get-login-password --profile vence --region eu-west-2 | podman login --username AWS --password-stdin 349744179687.dkr.ecr.eu-west-2.amazonaws.com
podman build --platform linux/amd64 -f marketing/social-content/Dockerfile.fargate -t "$IMG" marketing/social-content/
podman push "$IMG"
# registrar nueva task def apuntando al nuevo digest + actualizar el target de la schedule
```

### Probar a mano (dry-run / post real)

```bash
NET='awsvpcConfiguration={subnets=[subnet-0858aeaab832cec8c,subnet-0d20aa7b48ab6a3c0,subnet-0c22c7925e9c7d509],securityGroups=[sg-0663f77e0d44ca693],assignPublicIp=ENABLED}'
# dry-run (no publica):
aws ecs run-task --cluster vence-backend --task-definition vence-instagram-daily --launch-type FARGATE \
  --network-configuration "$NET" \
  --overrides '{"containerOverrides":[{"name":"instagram-daily","environment":[{"name":"DRY_RUN","value":"1"}]}]}' \
  --profile vence --region eu-west-2
# real (publica): igual, sin el override de DRY_RUN
# logs: aws logs tail /ecs/vence-instagram-daily --profile vence --region eu-west-2
```
