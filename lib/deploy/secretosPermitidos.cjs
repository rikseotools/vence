// lib/deploy/secretosPermitidos.cjs
//
// ¿Puede el rol de ejecución de ECS leer TODOS los secretos que la task definition pide?
//
// POR QUÉ EXISTE (T-399, 31/07/2026). El deploy del backend cablea secretos nuevos en la task
// def (`c.secrets.push({name:'DEVICE_LIMIT_MODE', valueFrom:'…/parameter/vence-backend/…'})`),
// pero el permiso para LEERLOS se concede en una política IAM que enumera los ARNs **uno a uno**.
// Añadir el secreto y conceder el permiso son dos actos separados, y nada comprobaba que fueran
// juntos.
//
// Lo que cuesta el hueco es que **el fallo llega tarde y mudo**: el deploy dice OK, registra la
// task def, y ECS empieza a arrancar una tarea cada ~5 min que muere ANTES de encender el
// contenedor con `ResourceInitializationError … AccessDeniedException … ssm:GetParameters`.
// `describe-services` se queda en `PRIMARY / IN_PROGRESS` con **0 running y 0 pending** — que a
// simple vista parece «va lento», no «no puede». Medido: **de 17:47 a 23:30 el 31/07**, con dos
// sesiones esperando una convergencia imposible y el lock de deploy retenido todo ese rato (con
// él, ninguna otra sesión podía desplegar nada).
//
// Producción NO se cae — el deployment viejo sigue sirviendo — así que tampoco salta ninguna
// alarma. Es exactamente el modo de fallo que este proyecto persigue: algo que no funciona y no
// se distingue de algo que tarda.
//
// La comprobación es pura para poder testearla: los comodines de IAM tienen reglas propias y
// equivocarse aquí sería peor que no comprobar (abortaría deploys buenos).

/**
 * Convierte un `Resource` de IAM en expresión regular.
 * IAM admite `*` (cualquier secuencia, incluida vacía) y `?` (exactamente un carácter).
 * Todo lo demás es literal, incluidos los `.` y `+` que abundan en un ARN.
 * @param {string} recurso
 * @returns {RegExp}
 */
function aRegExp(recurso) {
  let out = ''
  for (const ch of String(recurso)) {
    if (ch === '*') out += '.*'
    else if (ch === '?') out += '.'
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + out + '$')
}

/**
 * ¿El `Resource` de la política cubre este ARN?
 * @param {string} recurso  entrada de la política (puede llevar comodines)
 * @param {string} arn      ARN concreto del secreto
 */
function cubre(recurso, arn) {
  if (!recurso || !arn) return false
  return aRegExp(recurso).test(arn)
}

/**
 * ARNs de secretos que NINGÚN recurso de la política permite leer.
 *
 * Devuelve la lista para poder decir CUÁL falta —«no converge» no ayuda a nadie— y sin duplicados,
 * porque un mismo parámetro puede aparecer en varios contenedores de la task def.
 *
 * @param {string[]} arnsSecretos   `valueFrom` de cada secreto de la task def
 * @param {string[]} recursosPolitica  `Resource` de los statements que permiten ssm:GetParameters
 * @returns {string[]} los que faltan (vacío = todo cubierto)
 */
function arnsSinPermiso(arnsSecretos, recursosPolitica) {
  const recursos = Array.isArray(recursosPolitica) ? recursosPolitica : []
  const vistos = new Set()
  const faltan = []
  for (const arn of Array.isArray(arnsSecretos) ? arnsSecretos : []) {
    if (!arn || vistos.has(arn)) continue
    vistos.add(arn)
    // Solo se juzgan los secretos de SSM: un `valueFrom` de Secrets Manager se gobierna con otra
    // acción (`secretsmanager:GetSecretValue`) y decidir sobre él con esta lista sería inventar.
    if (!/^arn:aws[\w-]*:ssm:/.test(arn)) continue
    if (!recursos.some((r) => cubre(r, arn))) faltan.push(arn)
  }
  return faltan
}

/**
 * Saca los `valueFrom` de todos los contenedores de una task definition.
 * @param {{containerDefinitions?: Array<{secrets?: Array<{valueFrom?: string}>}>}} td
 * @returns {string[]}
 */
function secretosDeTaskDef(td) {
  const contenedores = (td && td.containerDefinitions) || []
  return contenedores.flatMap((c) => (c.secrets || []).map((s) => s.valueFrom).filter(Boolean))
}

module.exports = { cubre, arnsSinPermiso, secretosDeTaskDef }
