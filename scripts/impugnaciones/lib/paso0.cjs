// scripts/impugnaciones/lib/paso0.cjs — el «PASO 0» del dossier: lo primero que lee quien va a
// trabajar una impugnación, y lo que decide si hay que ESCRIBIRLE a la persona o no.
//
// ## Dos situaciones que se parecen en la BD y son opuestas para el usuario
//
// Las dos tienen `admin_response` relleno y el estado sin cerrar. Pero:
//
//   · **Desync del 504** (`status='pending'`): la respuesta se guardó y se emailó, y el estado no
//     se volteó porque la petición murió por el camino. La persona YA tiene su contestación. Si
//     vuelves a responder, le llega el mismo correo dos veces. → cerrar en silencio.
//   · **RÉPLICA** (`status='appealed'`): la persona leyó tu respuesta y ha vuelto a escribir. El
//     `admin_response` que hay es JUSTAMENTE lo que está replicando. → hay que contestarle.
//
// Hasta el 31/07/2026 el dossier trataba las dos igual —miraba solo si había `admin_response`—,
// así que el aviso «NO re-respondas, cierra en silencio» saltaba en el **100 % de las
// apelaciones**. Es la avería que el vigía existe para evitar, agravada: una réplica ya
// desaparece de toda lista de pendientes al cerrarse el hilo, y encima el dossier mandaba
// cerrarla muda. Visto en vivo con `349b5132` (Estela, art. 9.2 de la Ley 39/2015), donde se
// ignoró el aviso a propósito porque la persona pedía la fuente literal del BOE. Ficha: T-402.
//
// El módulo es puro (entra la fila, sale el texto) porque el defecto vivía en una condición
// enterrada en un script que abre conexión a la RDS de producción: no se podía testear, y por
// eso nadie lo vio hasta que mordió.

/** Recorta un texto a una línea legible, sin cortar en mitad de un espacio raro. */
function unaLinea(texto, max) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

/**
 * @param {{status?: string, admin_response?: string, appeal_text?: string, updated_at?: any}} d
 * @returns {{tipo: 'ninguno'|'ya_respondida'|'replica', texto: string}}
 */
function avisoPaso0(d = {}) {
  const status = d.status;
  if (!['pending', 'appealed'].includes(status)) return { tipo: 'ninguno', texto: '' };

  const resp = String(d.admin_response || '').trim();
  const replica = String(d.appeal_text || '').trim();

  // RÉPLICA: manda el estado, no la presencia de respuesta. Aunque `appeal_text` viniera vacío
  // (los hay antiguos), `appealed` significa que la persona volvió a escribir: se le contesta.
  if (status === 'appealed') {
    const partes = [
      '🔁 PASO 0 — ES UNA RÉPLICA (status=appealed): te han contestado, NO es una impugnación nueva.',
    ];
    if (resp) partes.push('   • Tu respuesta anterior: ' + unaLinea(resp, 300));
    partes.push(replica
      ? '   • Lo que replica:\n' + replica.split('\n').map((l) => '     ' + l).join('\n')
      : '   • (sin `appeal_text` guardado — léelo con la persona en mente antes de contestar)');
    partes.push('   → RESPÓNDELE por el flujo normal (cerrar.ts → /resolve, que manda el email nuevo).');
    partes.push('     Que se le note que has leído su réplica y tu respuesta anterior. Manual §0.bis.');
    return { tipo: 'replica', texto: partes.join('\n') };
  }

  // Desync del 504: pending CON respuesta ya escrita (y, por tanto, ya emailada).
  if (!resp) return { tipo: 'ninguno', texto: '' };
  const fecha = d.updated_at ? ' de ' + new Date(d.updated_at).toISOString().slice(0, 16) : '';
  return {
    tipo: 'ya_respondida',
    texto: '🛑 PASO 0 — YA RESPONDIDA (status=pending pero ya tiene admin_response' + fecha + '):\n'
      + '   • ' + unaLinea(resp, 90) + '\n'
      + '   → NO re-respondas (duplicarías el email). Solo falta CERRAR el estado (silent close):\n'
      + "     UPDATE status → 'resolved'/'rejected' preservando admin_response, SIN /resolve (reenviaría email).",
  };
}

module.exports = { avisoPaso0, unaLinea };
