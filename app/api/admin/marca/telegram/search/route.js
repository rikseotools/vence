/**
 * API para buscar mensajes en grupos de Telegram
 * GET: Buscar mensajes por keyword
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchMessages, getRecentMessages } from '@/lib/telegram/groups';
import { isConnected } from '@/lib/telegram/client';

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
 * GET: Buscar mensajes
 * Query params:
 * - groupId: ID del grupo (requerido)
 * - q: término de búsqueda (opcional, si no se proporciona devuelve mensajes recientes)
 * - limit: máximo de resultados (default 50)
 */
export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!groupId) {
      return NextResponse.json(
        { error: 'ID de grupo requerido' },
        { status: 400 }
      );
    }

    let messages;

    if (query && query.trim()) {
      // Buscar por keyword
      messages = await searchMessages(groupId, query.trim(), limit);
    } else {
      // Obtener mensajes recientes
      messages = await getRecentMessages(groupId, limit);
    }

    return NextResponse.json({
      messages,
      count: messages.length,
      query: query || null,
    });
  } catch (error) {
    console.error('Error buscando mensajes:', error);
    return NextResponse.json(
      { error: 'Error buscando mensajes' },
      { status: 500 }
    );
  }
}
