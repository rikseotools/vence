# Bloqueante IAM — Bloque 3 canary medals (24/05/2026 00:10 noche)

**Status:** ⛔ bloqueante, requiere intervención manual del owner (Manuel) en AWS Console.

## Qué pasó

Sesión 23/05 noche tirando del canary medals (commit `dc1b039c` con backend code). Al aplicar Terraform para:
- Conectar el ECS service al Target Group del ALB (cambio del `load_balancer` block).
- Añadir 2 secrets más al task definition (`UPSTASH_REDIS_REST_URL/TOKEN` del SSM).

Falló con `AccessDeniedException`:

```
User: arn:aws:iam::349744179687:user/claude-cli is not authorized to perform:
  - iam:PutRolePolicy on resource: role vence-backend-task-execution
  - iam:PassRole on resource: arn:aws:iam::349744179687:role/vence-backend-task
```

El user `claude-cli` tiene `PowerUserAccess` que **excluye operaciones IAM por diseño** (escalada de privilegios). Para cambiar el task definition de ECS, AWS exige `iam:PassRole` sobre los roles referenciados — sin escape.

## Estado actual de la infra (al cierre nocturno)

| Recurso | Estado | Comentario |
|---|---|---|
| ALB `vence-backend-alb` | ✅ Operativo | `https://api.vence.es/health` HTTP/2 503 + TLS válido |
| ACM cert `api.vence.es` | ✅ Issued | Hasta dic 2026, renovación automática |
| ECS task corriente | ✅ Corriendo (`vence-backend:2`) | Status INACTIVE pero la task sigue viva (los crons funcionan) |
| ECS service ↔ TG | ❌ NO conectado | `loadBalancers: []` — quedó pendiente |
| Task definition con UPSTASH secrets | ❌ NO creada | Bloqueante `iam:PassRole` |
| SSM params `/vence-backend/UPSTASH_REDIS_REST_URL` y `_TOKEN` | ✅ Existen | Listos para ser referenciados cuando se cree la task def nueva |
| Código backend `MedalsModule` | ✅ Pusheado (commit `dc1b039c`) | GHA está construyendo la imagen `latest` |
| Código frontend (router + proxy) | ❌ NO hecho | Bloqueado por el backend canary |

**Importante**: la task corriente está usando `vence-backend:2` que está en status **INACTIVE** (alguien hizo `deregister-task-definition` en un apply previo). La task sigue viva por inercia, pero **si se reinicia (kernel update, OOM, deploy manual), ECS NO podrá relanzarla**. Los crons funcionan mientras tanto.

## Lo que hay que hacer en AWS Console (Manuel, ~5 min)

Necesito que añadas una policy inline al user `claude-cli` con estos permisos mínimos:

1. **AWS Console → IAM → Users → claude-cli → Add permissions → Create inline policy → JSON**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageBackendTaskDef",
      "Effect": "Allow",
      "Action": [
        "iam:PassRole",
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:PutRolePolicy"
      ],
      "Resource": [
        "arn:aws:iam::349744179687:role/vence-backend-task",
        "arn:aws:iam::349744179687:role/vence-backend-task-execution"
      ]
    },
    {
      "Sid": "ManageBackendOIDCAndCIRole",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:GetOpenIDConnectProvider"
      ],
      "Resource": [
        "arn:aws:iam::349744179687:role/vence-backend-ci-deploy",
        "arn:aws:iam::349744179687:oidc-provider/token.actions.githubusercontent.com"
      ]
    }
  ]
}
```

2. **Nombre de la policy**: `vence-backend-passrole-and-readiam`.

3. Guardar.

**Esta policy es scoped a roles `vence-backend-*`**: claude-cli NO puede tocar otros roles del sistema, ni crear users, ni asumir roles administrativos. No escala privilegios fuera de su scope.

## Lo que yo haré tras tu confirmación

1. **Re-aplicar el bloque `load_balancer`** en `backend/infra/main.tf` (que dejé comentado en commit `<este-commit>`).
2. **Re-añadir UPSTASH secrets refs** en task definition + IAM policy.
3. **`terraform apply`** → crea task def `:3` ACTIVE, conecta el service al TG, registra UPSTASH_*.
4. **Esperar GHA `Deploy backend` build** (si ya terminó, re-disparar con `workflow_dispatch`).
5. **Smoke test** `curl https://api.vence.es/api/medals?userId=<uuid>`.
6. **Frontend** — `lib/api/backend-router.ts` + proxy condicional en `app/api/medals/route.ts`.
7. **Canary ON** — commit que flippa el flag.
8. **Vigilar 30 min**.

Tiempo total tras desbloqueo IAM: ~1h.

## Alternativas que NO recomiendo

- **Subir claude-cli a `AdministratorAccess`**: rompe el principio de menor privilegio.
- **Hardcodear UPSTASH tokens en task definition `environment` block (no `secrets`)**: deja tokens visibles en TF state + ECS console. Mala práctica (memoria `incidente GitGuardian` Postgres URI leaked).
- **Esperar a CI workflow para que cree task def**: el rol `vence-backend-ci-deploy` actual tampoco tiene `ecs:RegisterTaskDefinition` ni `iam:PassRole` — sólo `ecs:UpdateService`. Habría que ampliarlo también.

## Referencias

- Backend code commiteado: `dc1b039c` (módulos Db, Cache, Medals)
- Infra HTTP del backend (paso anterior OK): `3c7624fe` + `3879a999`
- Audit Bloque 3: [`bloque3-audit-hot-path.md`](bloque3-audit-hot-path.md)
- Patrón BACKEND_URL: [`bloque3-backend-url-pattern.md`](bloque3-backend-url-pattern.md)
