# Infraestructura — Vence backend (Etapa 1)

Terraform para desplegar el backend en **AWS ECS Fargate** (worker de crons).
Footprint mínimo: ECR + 1 task Fargate + SSM + CloudWatch. Sin balanceador
(el worker no tiene endpoint público). Coste estimado ~$20-40/mes.

## Requisitos previos (una vez)

1. **Cuenta AWS.** Activar MFA en el usuario root, crear un usuario IAM con
   acceso de administrador para el día a día (no usar root).
2. Instalar **AWS CLI** y **Terraform** (>= 1.7).
3. `aws configure` con las credenciales del usuario IAM.

## Despliegue (primera vez)

### 1. Crear el secreto DATABASE_URL en SSM

El secreto NO entra en Terraform. Se crea aparte:

```bash
aws ssm put-parameter \
  --name /vence-backend/DATABASE_URL \
  --type SecureString \
  --value 'postgresql://...' \
  --region eu-west-2
```

### 2. Aplicar Terraform

```bash
cd backend/infra
cp terraform.tfvars.example terraform.tfvars   # revisar github_repo
terraform init
terraform plan      # revisar lo que se va a crear
terraform apply
```

Apunta los outputs: `ecr_repository_url` y `ci_deploy_role_arn`.

### 3. Conectar el CI

En GitHub → repo → Settings → Secrets and variables → Actions, crear el
secret **`AWS_DEPLOY_ROLE_ARN`** con el valor de `ci_deploy_role_arn`.

### 4. Primera imagen

El servicio ECS arranca sin imagen útil hasta el primer push. Lánzalo:

```bash
gh workflow run "Deploy backend"
```

(o `git push` de cualquier cambio en `backend/`). El workflow construye la
imagen, la sube a ECR y fuerza el despliegue.

### 5. Verificar

```bash
# Logs del worker
aws logs tail /ecs/vence-backend --follow --region eu-west-2
```

El cron `check-boe-changes` corre a las 08:00 UTC. Para un disparo manual,
entrar a la task (`aws ecs execute-command`) o esperar al horario.

## Período shadow y cutover

Mientras `BOE_NOTIFY_ENABLED=false`, el cron nuevo corre **en paralelo** al
de Vercel sin enviar emails. Tras 2-3 semanas comparando que revisa el 100%
de las leyes a diario:

1. Desactivar el workflow viejo `.github/workflows/check-boe-changes.yml`.
2. `terraform apply` con `boe_notify_enabled = "true"`.
3. Borrar el cron viejo (`app/api/cron/check-boe-changes/` + su workflow).

## Notas

- **Estado de Terraform**: local (`terraform.tfstate`) para Etapa 1. Migrar a
  backend S3 + lock cuando aplique más de una persona.
- **OIDC**: si la cuenta ya tiene el proveedor OIDC de GitHub, importarlo
  (`terraform import aws_iam_openid_connect_provider.github <arn>`) antes del apply.
- `terraform.tfvars` y `*.tfstate` NO se commitean (ver `.gitignore`).
