/**
 * API para gestión de alertas de Telegram
 * GET: Listar alertas (con filtros)
 * PUT: Marcar como leída/respondida
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
 * GET: Listar alertas
 * Query params:
 * - unread: true/false - solo no leídas
 * - groupId: number - filtrar por grupo
 * - limit: number - límite de resultados (default 50)
 * - offset: number - paginación
 */
export async function GET(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const unread = searchParams.get('unread') === 'true';
    const groupId = searchParams.get('groupId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('telegram_alerts')
      .select(`
        *,
        telegram_groups (
          id,
          title,
          username
        )
      `)
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unread) {
      query = query.eq('is_read', false);
    }

    if (groupId) {
      query = query.eq('group_id', parseInt(groupId));
    }

    const { data: alerts, error, count } = await query;

    if (error) throw error;

    // Obtener conteo de no leídas
    const { count: unreadCount } = await supabase
      .from('telegram_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    return NextResponse.json({
      alerts: alerts || [],
      unreadCount: unreadCount || 0,
      hasMore: alerts?.length === limit,
    });
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    return NextResponse.json(
      { error: 'Error obteniendo alertas' },
      { status: 500 }
    );
  }
}

/**
 * PUT: Actualizar alerta (marcar como leída, etc.)
 * Body: { id, isRead?, isReplied?, replyText? }
 * O: { markAllRead: true } para marcar todas como leídas
 */
export async function PUT(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = getSupabaseAdmin();

    // Marcar todas como leídas
    if (body.markAllRead) {
      const { error } = await supabase
        .from('telegram_alerts')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Actualizar alerta específica
    if (!body.id) {
      return NextResponse.json(
        { error: 'ID de alerta requerido' },
        { status: 400 }
      );
    }

    const updates = {};
    if (body.isRead !== undefined) updates.is_read = body.isRead;
    if (body.isReplied !== undefined) {
      updates.is_replied = body.isReplied;
      if (body.isReplied) updates.replied_at = new Date().toISOString();
    }
    if (body.replyText !== undefined) updates.reply_text = body.replyText;

    const { error } = await supabase
      .from('telegram_alerts')
      .update(updates)
      .eq('id', body.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error actualizando alerta:', error);
    return NextResponse.json(
      { error: 'Error actualizando alerta' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Eliminar alertas antiguas
 * Query: ?olderThan=days (ej: ?olderThan=30)
 */
export async function DELETE(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get('olderThan') || '30');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const supabase = getSupabaseAdmin();

    const { error, count } = await supabase
      .from('telegram_alerts')
      .delete({ count: 'exact' })
      .lt('detected_at', cutoffDate.toISOString())
      .eq('is_read', true); // Solo eliminar las ya leídas

    if (error) throw error;

    return NextResponse.json({
      success: true,
      deletedCount: count || 0,
    });
  } catch (error) {
    console.error('Error eliminando alertas:', error);
    return NextResponse.json(
      { error: 'Error eliminando alertas' },
      { status: 500 }
    );
  }
}
