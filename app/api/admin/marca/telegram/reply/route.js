/**
 * API para enviar respuestas en Telegram
 * POST: Responder a un mensaje específico
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { replyToMessage, sendMessage } from '@/lib/telegram/monitor';
import { isConnected } from '@/lib/telegram/client';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function getSupabaseWithToken(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

async function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) return { isAdmin: false };

  const supabaseUser = getSupabaseWithToken(token);
  const { data: { user } } = await supabaseUser.auth.getUser(token);
  if (!user) return { isAdmin: false };

  const { data: isAdmin } = await supabaseUser.rpc('is_current_user_admin');
  return { isAdmin: !!isAdmin };
}

/**
 * POST: Enviar respuesta
 * Body:
 * - alertId: UUID de la alerta (para responder a un mensaje detectado)
 * - groupId: ID del grupo (si no hay alertId)
 * - messageId: ID del mensaje a responder (si no hay alertId)
 * - text: Texto de la respuesta
 * - asReply: boolean - si debe ser respuesta al mensaje o mensaje nuevo
 */
export async function POST(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (!isConnected()) {
      return NextResponse.json(
        { error: 'No hay conexión con Telegram' },
        { status: 400 }
      );
    }

    const { alertId, groupId, messageId, text, asReply = true } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'El texto de la respuesta es requerido' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    let targetGroupId = groupId;
    let targetMessageId = messageId;

    // Si viene alertId, obtener groupId y messageId de la alerta
    if (alertId) {
      const { data: alert, error } = await supabase
        .from('telegram_alerts')
        .select('group_id, message_id')
        .eq('id', alertId)
        .single();

      if (error || !alert) {
        return NextResponse.json(
          { error: 'Alerta no encontrada' },
          { status: 404 }
        );
      }

      targetGroupId = alert.group_id;
      targetMessageId = alert.message_id;
    }

    if (!targetGroupId) {
      return NextResponse.json(
        { error: 'ID de grupo requerido' },
        { status: 400 }
      );
    }

    let result;

    if (asReply && targetMessageId) {
      // Responder al mensaje específico
      result = await replyToMessage(targetGroupId, targetMessageId, text.trim());
    } else {
      // Enviar mensaje nuevo al grupo
      result = await sendMessage(targetGroupId, text.trim());
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error enviando mensaje' },
        { status: 400 }
      );
    }

    // Si había alertId, marcar como respondida
    if (alertId) {
      await supabase
        .from('telegram_alerts')
        .update({
          is_replied: true,
          is_read: true,
          reply_text: text.trim(),
          replied_at: new Date().toISOString(),
        })
        .eq('id', alertId);
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('Error enviando respuesta:', error);
    return NextResponse.json(
      { error: 'Error enviando respuesta' },
      { status: 500 }
    );
  }
}
