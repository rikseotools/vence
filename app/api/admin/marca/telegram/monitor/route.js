/**
 * API para control de monitorización de Telegram
 * GET: Estado del monitor
 * POST: Iniciar monitorización
 * DELETE: Detener monitorización
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  startMonitoring,
  stopMonitoring,
  getMonitoringStatus,
} from '@/lib/telegram/monitor';
import { isConnected, connectWithSession } from '@/lib/telegram/client';

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

  if (!token) return { isAdmin: false, userId: null };

  const supabaseUser = getSupabaseWithToken(token);
  const { data: { user } } = await supabaseUser.auth.getUser(token);
  if (!user) return { isAdmin: false, userId: null };

  const { data: isAdmin } = await supabaseUser.rpc('is_current_user_admin');
  return { isAdmin: !!isAdmin, userId: user.id };
}

/**
 * GET: Obtener estado de la monitorización
 */
export async function GET(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const status = getMonitoringStatus();

    return NextResponse.json({
      ...status,
      telegramConnected: isConnected(),
    });
  } catch (error) {
    console.error('Error obteniendo estado del monitor:', error);
    return NextResponse.json(
      { error: 'Error obteniendo estado' },
      { status: 500 }
    );
  }
}

/**
 * POST: Iniciar monitorización
 * Conecta a Telegram si no está conectado y comienza a escuchar mensajes
 */
export async function POST(request) {
  try {
    const { isAdmin, userId } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Verificar conexión a Telegram
    if (!isConnected()) {
      // Intentar conectar con sesión guardada
      const { data: session } = await supabase
        .from('telegram_session')
        .select('session_string')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!session) {
        return NextResponse.json(
          { error: 'No hay sesión de Telegram. Inicia sesión primero.' },
          { status: 400 }
        );
      }

      const result = await connectWithSession(session.session_string);
      if (!result.connected) {
        return NextResponse.json(
          { error: 'Error conectando a Telegram. Inicia sesión de nuevo.' },
          { status: 400 }
        );
      }
    }

    // Obtener grupos a monitorizar
    const { data: groups, error } = await supabase
      .from('telegram_groups')
      .select('id, keywords')
      .eq('is_monitoring', true);

    if (error) throw error;

    if (!groups || groups.length === 0) {
      return NextResponse.json(
        { error: 'No hay grupos configurados para monitorizar' },
        { status: 400 }
      );
    }

    // Formatear grupos para el monitor
    const groupsToMonitor = groups.map((g) => ({
      id: g.id.toString(),
      keywords: g.keywords,
    }));

    // Iniciar monitorización
    const result = await startMonitoring(groupsToMonitor);

    return NextResponse.json({
      success: true,
      groupCount: result.groupCount,
      message: `Monitorizando ${result.groupCount} grupos`,
    });
  } catch (error) {
    console.error('Error iniciando monitorización:', error);
    return NextResponse.json(
      { error: 'Error iniciando monitorización' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Detener monitorización
 */
export async function DELETE(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await stopMonitoring();

    return NextResponse.json({
      success: true,
      message: 'Monitorización detenida',
    });
  } catch (error) {
    console.error('Error deteniendo monitorización:', error);
    return NextResponse.json(
      { error: 'Error deteniendo monitorización' },
      { status: 500 }
    );
  }
}
