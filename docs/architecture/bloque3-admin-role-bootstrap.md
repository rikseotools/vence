# Bootstrap del role `vence-backend-admin` (UNA vez, ~15 min)

**Fecha:** 2026-05-24
**Reemplaza:** [`bloque3-iam-bloqueante.md`](bloque3-iam-bloqueante.md) (queda como histórico — la solución inline policy de allí NO se aplica; vamos por role asumido).

---

## §1. Por qué role asumido y no policy inline en claude-cli

- **Privilegios temporales**: claude-cli sólo tiene permisos IAM cuando asume el role explícitamente. La sesión caduca en 1h. Resto del tiempo claude-cli es `PowerUserAccess` puro (sin IAM).
- **Auditabilidad**: cada `AssumeRole` se logea en CloudTrail con quién/cuándo/para qué. Las inline policies son operaciones "normales", invisibles en logs.
- **Reutilizable**: si en el futuro hay otro user/agente que necesita los mismos permisos, basta con añadir su ARN al `assume_role_policy` del role. Sin replicar permisos en cada user.
- **MFA opcional**: el role tiene un bloque condition comentado en `admin-role.tf` líneas 30-32 — descomentar para exigir MFA al asumir (recomendado para producción con cambios destructivos).
- **Blast radius limitado**: si claude-cli se compromete (prompt injection, credenciales filtradas), el atacante ve `PowerUserAccess` pero NO los permisos IAM. Para escalada tendría que conseguir `sts:AssumeRole` válido al role, y eso aparece en CloudTrail.
- **Versionado**: el role vive en Terraform (`backend/infra/admin-role.tf`). Cambios pasan por commit + revisión + revert.
- **Limpieza fácil**: si dejas de usar Claude Code, basta con borrar el `sts:AssumeRole` del user claude-cli (1 línea). El role queda inerte sin que nadie lo asuma.

Es el patrón estándar AWS. Lo que se hace en empresas con compliance serio.

---

## §2. Bootstrap — los 3 pasos que sólo tú puedes hacer (~10 min)

### Paso 1 — Aplicar `admin-role.tf` con credenciales admin (5 min)

Necesitas credenciales con permisos IAM admin para CREAR el role la primera vez. Dos opciones:

**Opción A — Desde tu máquina con AWS CLI (recomendada, versionada)**

Si tienes credenciales root o admin configuradas en un profile (p.ej. `vence-root`):

```bash
cd /home/manuel/Documentos/github/vence/backend/infra
AWS_PROFILE=vence-root terraform apply -target=aws_iam_role.backend_admin \
                                        -target=aws_iam_role_policy.backend_admin \
                                        -refresh=false
```

Si NO tienes profile root pero sí acceso al AWS Console root user, puedes:
- Login web → IAM → Users → tu usuario admin → Security credentials → Create access key
- `aws configure --profile vence-root` con esas keys
- Ejecutar el comando de arriba
- IMPORTANTE: borrar la access key después si era temporal

**Opción B — Crear el role desde la consola web (más simple si no quieres CLI admin)**

1. AWS Console → IAM → Roles → Create role
2. Trusted entity type: **AWS account** → **This account**
3. Options: marca **Require external ID** = NO, **Require MFA** = opcional (recomendado)
4. Next
5. Permissions: skip de momento (lo añadimos en el siguiente paso vía inline policy)
6. Next
7. Role name: `vence-backend-admin`
8. Description: `Role asumido por claude-cli para gestionar IAM y task definitions del backend vence-*`
9. Create role

Editar el role recién creado:
- Trust relationships tab → Edit trust policy → pegar:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowClaudeCliToAssume",
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::349744179687:user/claude-cli"
    },
    "Action": "sts:AssumeRole"
  }]
}
```

- Permissions tab → Add permissions → Create inline policy → JSON → pegar:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageVenceBackendRoles",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:UpdateAssumeRolePolicy",
        "iam:TagRole",
        "iam:UntagRole"
      ],
      "Resource": ["arn:aws:iam::349744179687:role/vence-backend-*"]
    },
    {
      "Sid": "PassBackendTaskRoles",
      "Effect": "Allow",
      "Action": ["iam:PassRole"],
      "Resource": [
        "arn:aws:iam::349744179687:role/vence-backend-task",
        "arn:aws:iam::349744179687:role/vence-backend-task-execution"
      ],
      "Condition": {
        "StringEquals": {"iam:PassedToService": "ecs-tasks.amazonaws.com"}
      }
    },
    {
      "Sid": "ReadGitHubOIDCProvider",
      "Effect": "Allow",
      "Action": ["iam:GetOpenIDConnectProvider"],
      "Resource": ["arn:aws:iam::349744179687:oidc-provider/token.actions.githubusercontent.com"]
    }
  ]
}
```

- Policy name: `vence-backend-admin-policy`
- Create policy

Apunta el **ARN del role** (Summary tab del role): será algo como `arn:aws:iam::349744179687:role/vence-backend-admin`.

Notas:
- Si vas por Opción B, **importa el role a Terraform después** para que quede versionado:
  ```bash
  AWS_PROFILE=vence-admin terraform import aws_iam_role.backend_admin vence-backend-admin
  AWS_PROFILE=vence-admin terraform import aws_iam_role_policy.backend_admin vence-backend-admin:vence-backend-admin-policy
  ```
  (Eso ya lo puedes ejecutar yo después de que añadas el AssumeRole permission al claude-cli.)

### Paso 2 — Añadir `sts:AssumeRole` al user claude-cli (3 min, AWS Console)

Esta es la pieza que claude-cli NO puede hacer por sí mismo (anti-escalada).

1. AWS Console → IAM → Users → **claude-cli**
2. Permissions tab → Add permissions → **Create inline policy**
3. JSON → pegar:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AssumeVenceBackendAdmin",
    "Effect": "Allow",
    "Action": "sts:AssumeRole",
    "Resource": "arn:aws:iam::349744179687:role/vence-backend-admin"
  }]
}
```

4. Policy name: `assume-vence-backend-admin`
5. Create policy

Esa es la **única** inline policy que añades al user. Es 1 línea de permiso. Bonita y limpia.

### Paso 3 — Avísame "role listo"

Cuando termines los pasos 1 y 2, dime "role listo" y yo:

1. Configuro `~/.aws/config` con `[profile vence-admin]` apuntando al role.
2. Verifico con `aws sts get-caller-identity --profile vence-admin` (debe mostrar el role asumido).
3. Importo el role a Terraform si fuiste por Opción B (web).
4. Reaplico el bloque `load_balancer` en `aws_ecs_service.backend` (comentado actualmente).
5. Re-añado los UPSTASH secrets al task definition (con `iam:PutRolePolicy` permitido ahora).
6. `AWS_PROFILE=vence-admin terraform apply` → crea task def `:3` ACTIVE, conecta service al TG.
7. Verifico CI deploy + smoke `https://api.vence.es/api/medals?userId=<uuid>`.
8. Frontend → router + proxy + tests → push (flag OFF).
9. Activar flag → smoke prod → monitor 30 min.

Tiempo total tras tu bootstrap: ~1h.

---

## §3. Lo que NO recomiendo

- **MFA forzado AHORA**: lo dejé comentado en el TF. Activarlo después, cuando el flujo esté validado, para no añadir fricción al primer canary.
- **Permisos más amplios** ("iam:*" sobre toda la cuenta): rompe el scope. La belleza del role es que sólo puede tocar `vence-backend-*`.
- **Compartir el role con otros agentes ya** (Cursor, otra cuenta de Claude, etc.): si lo quieres después, añadir su ARN al `assume_role_policy`. Hoy: sólo claude-cli.

---

## §4. Mantenimiento futuro

- **Si Vence añade un Bloque 4 con otro tipo de infra**: ampliar el scope del Resource a `vence-*` o crear otro role `vence-frontend-admin`.
- **Si activas MFA**: añade `Condition` al `assume_role_policy` y configura `mfa_serial` en el profile `~/.aws/config`.
- **Si rotas credenciales claude-cli**: el role sigue funcionando sin cambios (el ARN del user no cambia al rotar access keys).
- **Si dejas de usar Claude Code**: borrar la inline policy `assume-vence-backend-admin` del user claude-cli (1 click). Role queda inerte.

---

## §5. Histórico — por qué este doc reemplaza al `bloqueante-iam-bloqueante.md`

El doc anterior proponía añadir inline policy directamente al user claude-cli con 4 permisos IAM (PassRole, GetRole, GetRolePolicy, PutRolePolicy). Funcional pero **mediocre profesional**: permisos permanentes, sin auditoría temporal, no escalable a otros agentes.

Esta solución (role asumido) tarda 10 min más en bootstrap pero te queda algo robusto, auditable y versionado. Encaja con la prioridad #2 del roadmap (agnóstico + buen patrón estándar) y con la filosofía AWS de mínimo privilegio.
