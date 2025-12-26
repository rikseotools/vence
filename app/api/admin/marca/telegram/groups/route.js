/**
 * API para gestión de grupos de Telegram
 * GET: Listar grupos monitorizados
 * POST: Añadir grupo a monitorización
 * PUT: Actualizar keywords de un grupo
 * DELETE: Quitar grupo de monitorización
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMyGroups, searchGroups, joinGroup } from '@/lib/telegram/groups';
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

  if (!token) return { isAdmin: false, userId: null };

  const supabaseUser = getSupabaseWithToken(token);
  const { data: { user } } = await supabaseUser.auth.getUser(token);
  if (!user) return { isAdmin: false, userId: null };

  const { data: isAdmin } = await supabaseUser.rpc('is_current_user_admin');
  return { isAdmin: !!isAdmin, userId: user.id };
}

/**
 * GET: Listar grupos
 * ?source=telegram - Obtener grupos del usuario en Telegram
 * ?source=db - Obtener grupos monitorizados de la BD
 * ?search=query - Buscar grupos públicos
 */
export async function GET(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'db';
    const searchQuery = searchParams.get('search');

    const supabase = getSupabaseAdmin();

    // Buscar grupos públicos
    if (searchQuery) {
      if (!isConnected()) {
        return NextResponse.json(
          { error: 'No hay conexión con Telegram' },
          { status: 400 }
        );
      }
      const groups = await searchGroups(searchQuery);
      return NextResponse.json({ groups });
    }

    // Obtener grupos del usuario en Telegram
    if (source === 'telegram') {
      if (!isConnected()) {
        return NextResponse.json(
          { error: 'No hay conexión con Telegram' },
          { status: 400 }
        );
      }

      const telegramGroups = await getMyGroups();

      // Obtener IDs de grupos ya monitorizados
      const { data: monitoredGroups } = await supabase
        .from('telegram_groups')
        .select('id');

      const monitoredIds = new Set(
        (monitoredGroups || []).map((g) => g.id.toString())
      );

      // Marcar cuáles ya están monitorizados
      const groups = telegramGroups.map((g) => ({
        ...g,
        isMonitored: monitoredIds.has(g.id),
      }));

      return NextResponse.json({ groups });
    }

    // Obtener grupos monitorizados de BD
    const { data: groups, error } = await supabase
      .from('telegram_groups')
      .select('*')
      .order('added_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ groups: groups || [] });
  } catch (error) {
    console.error('Error obteniendo grupos:', error);
    return NextResponse.json(
      { error: 'Error obteniendo grupos' },
      { status: 500 }
    );
  }
}

/**
 * POST: Añadir grupo a monitorización
 * Body: { id, title, username?, memberCount?, keywords? }
 * O: { username } para unirse a un grupo nuevo
 */
export async function POST(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = getSupabaseAdmin();

    // Si solo viene username, es para unirse a un grupo nuevo
    if (body.username && !body.id) {
      if (!isConnected()) {
        return NextResponse.json(
          { error: 'No hay conexión con Telegram' },
          { status: 400 }
        );
      }

      const result = await joinGroup(body.username);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      // Añadir a BD
      const { error } = await supabase.from('telegram_groups').upsert(
        {
          id: parseInt(result.group.id),
          title: result.group.title,
          username: result.group.username,
          member_count: result.group.memberCount,
          is_monitoring: true,
          keywords: body.keywords || ['test', 'vence', 'oposiciones'],
        },
        { onConflict: 'id' }
      );

      if (error) throw error;

      return NextResponse.json({
        success: true,
        group: result.group,
      });
    }

    // Añadir grupo existente a monitorización
    if (!body.id || !body.title) {
      return NextResponse.json(
        { error: 'ID y título son requeridos' },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('telegram_groups').upsert(
      {
        id: parseInt(body.id),
        title: body.title,
        username: body.username || null,
        member_count: body.memberCount || 0,
        is_monitoring: true,
        keywords: body.keywords || ['test', 'vence', 'oposiciones'],
      },
      { onConflict: 'id' }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error añadiendo grupo:', error);
    return NextResponse.json(
      { error: 'Error añadiendo grupo' },
      { status: 500 }
    );
  }
}

/**
 * PUT: Actualizar grupo (keywords, estado de monitorización)
 * Body: { id, keywords?, isMonitoring? }
 */
export async function PUT(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id, keywords, isMonitoring } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'ID de grupo requerido' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const updates = {};
    if (keywords !== undefined) updates.keywords = keywords;
    if (isMonitoring !== undefined) updates.is_monitoring = isMonitoring;

    const { error } = await supabase
      .from('telegram_groups')
      .update(updates)
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error actualizando grupo:', error);
    return NextResponse.json(
      { error: 'Error actualizando grupo' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Quitar grupo de monitorización
 * Query: ?id=groupId
 */
export async function DELETE(request) {
  try {
    const { isAdmin } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID de grupo requerido' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('telegram_groups')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando grupo:', error);
    return NextResponse.json(
      { error: 'Error eliminando grupo' },
      { status: 500 }
    );
  }
}
