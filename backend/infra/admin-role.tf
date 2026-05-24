# ============================================================
# vence-backend-admin — role IAM asumido por claude-cli para tocar
# task definitions del backend (Bloque 3 + futuras necesidades).
#
# Por qué no inline policy en claude-cli: ver
# docs/architecture/bloque3-admin-role-bootstrap.md §1 (auditabilidad,
# privilegios temporales, MFA opcional, blast radius si claude-cli
# se compromete).
#
# Bootstrap (UNA vez, requiere admin/root): ver §2 del mismo doc.
# Después claude-cli usa AWS_PROFILE=vence-admin para asumir el role
# cuando necesite cambiar task definitions o IAM del backend.
# ============================================================

resource "aws_iam_role" "backend_admin" {
  name = "vence-backend-admin"

  # Quién puede asumir este role: actualmente sólo claude-cli.
  # Para ampliar (otro user/agente), añadir más principals a la lista.
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowClaudeCliToAssume"
      Effect = "Allow"
      Principal = {
        AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/claude-cli"
      }
      Action = "sts:AssumeRole"

      # MFA: comentado por defecto. Para activarlo (recomendado en
      # producción con cambios destructivos):
      # Condition = {
      #   Bool = { "aws:MultiFactorAuthPresent" = "true" }
      # }
    }]
  })

  # Sesiones limitadas a 1h. Tras eso hay que re-asumir el role.
  # Reduce blast radius si una sesión queda colgada.
  max_session_duration = 3600

  description = "Role asumido por claude-cli para gestionar IAM y task definitions del backend vence-*. Bloque 3 — ver docs/architecture/bloque3-admin-role-bootstrap.md"
}

# ─── Policy del role: permisos IAM scoped a vence-backend-* ──
resource "aws_iam_role_policy" "backend_admin" {
  name = "vence-backend-admin-policy"
  role = aws_iam_role.backend_admin.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ManageVenceBackendRoles"
        Effect = "Allow"
        Action = [
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
          "iam:UntagRole",
        ]
        Resource = [
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/vence-backend-*",
        ]
      },
      {
        # PassRole: para que ECS pueda usar los task roles al lanzar tasks.
        # Scoped sólo a los 2 roles que el task definition referencia.
        Sid    = "PassBackendTaskRoles"
        Effect = "Allow"
        Action = ["iam:PassRole"]
        Resource = [
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/vence-backend-task",
          "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/vence-backend-task-execution",
        ]
        Condition = {
          # Sólo permitir PassRole a servicios ECS — anti-misuso.
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      },
      {
        # Leer el OIDC provider de GitHub (necesario para Terraform refresh
        # del recurso aws_iam_openid_connect_provider.github).
        Sid      = "ReadGitHubOIDCProvider"
        Effect   = "Allow"
        Action   = ["iam:GetOpenIDConnectProvider"]
        Resource = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"]
      },
    ]
  })
}

# ─── Output: ARN del role para configurar ~/.aws/config ──
output "backend_admin_role_arn" {
  description = "ARN del role vence-backend-admin. Usar en ~/.aws/config como role_arn del profile vence-admin."
  value       = aws_iam_role.backend_admin.arn
}
