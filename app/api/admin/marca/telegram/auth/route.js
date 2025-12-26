/**
 * API para autenticación de Telegram
 * POST: Enviar código de verificación
 * PUT: Verificar código y completar login
 * DELETE: Cerrar sesión
 * GET: Estado de conexión
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  sendCode,
  signIn,
  connectWithSession,
  disconnect,
  encryptSession,
  isConnected,
} from '@/lib/telegram/client';

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

// Verificar que el usuario es admin
async function verifyAdmin(request) {
  // Obtener token de la cookie o header
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return { isAdmin: false, userId: null };
  }

  // Usar cliente con token del usuario para verificar admin
  const supabaseUser = getSupabaseWithToken(token);

  const {
    data: { user },
  } = await supabaseUser.auth.getUser(token);

  if (!user) {
    return { isAdmin: false, userId: null };
  }

  // Llamar RPC con contexto de usuario
  const { data: isAdmin, error } = await supabaseUser.rpc('is_current_user_admin');

  console.log('📱 Telegram Auth: verifyAdmin result:', { userId: user.id, isAdmin, error });

  return { isAdmin: !!isAdmin, userId: user.id };
}

/**
 * GET: Obtener estado de conexión de Telegram
 */
export async function GET(request) {
  try {
    const { isAdmin, userId } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Buscar sesión existente
    const { data: session } = await supabase
      .from('telegram_session')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!session) {
      return NextResponse.json({
        connected: false,
        hasSession: false,
      });
    }

    // Intentar conectar con la sesión existente
    const result = await connectWithSession(session.session_string);

    return NextResponse.json({
      connected: result.connected,
      hasSession: true,
      user: result.user,
      phoneNumber: session.phone_number,
    });
  } catch (error) {
    console.error('Error verificando conexión Telegram:', error);
    return NextResponse.json(
      { error: 'Error verificando conexión' },
      { status: 500 }
    );
  }
}

/**
 * POST: Iniciar proceso de login (enviar código al teléfono)
 */
export async function POST(request) {
  try {
    const { isAdmin, userId } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Número de teléfono requerido' },
        { status: 400 }
      );
    }

    // Validar formato del número
    if (!phoneNumber.startsWith('+')) {
      return NextResponse.json(
        { error: 'El número debe incluir código de país (+34...)' },
        { status: 400 }
      );
    }

    // Enviar código
    const result = await sendCode(phoneNumber);

    // Devolver phoneCodeHash al frontend (lo enviará de vuelta al verificar)
    return NextResponse.json({
      success: true,
      message: 'Código enviado a Telegram',
      phoneCodeHash: result.phoneCodeHash,
      phoneNumber: phoneNumber,
    });
  } catch (error) {
    console.error('Error enviando código Telegram:', error);

    let errorMsg = 'Error enviando código';
    if (error.message?.includes('PHONE_NUMBER_INVALID')) {
      errorMsg = 'Número de teléfono inválido';
    } else if (error.message?.includes('PHONE_NUMBER_BANNED')) {
      errorMsg = 'Este número está baneado de Telegram';
    } else if (error.message?.includes('FLOOD')) {
      errorMsg = 'Demasiados intentos. Espera unos minutos.';
    }

    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}

/**
 * PUT: Verificar código y completar login
 */
export async function PUT(request) {
  try {
    const { isAdmin, userId } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { code, password, phoneCodeHash, phoneNumber } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Código de verificación requerido' },
        { status: 400 }
      );
    }

    if (!phoneCodeHash || !phoneNumber) {
      return NextResponse.json(
        { error: 'Datos de sesión inválidos. Solicita un nuevo código.' },
        { status: 400 }
      );
    }

    // Completar login
    const result = await signIn(
      phoneNumber,
      code,
      phoneCodeHash,
      password
    );

    // Encriptar y guardar sesión
    const encryptedSession = encryptSession(result.sessionString);

    const supabase = getSupabaseAdmin();

    // Upsert sesión (reemplazar si existe)
    await supabase.from('telegram_session').upsert(
      {
        user_id: userId,
        session_string: encryptedSession,
        phone_number: phoneNumber,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );

    return NextResponse.json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    console.error('Error verificando código Telegram:', error);

    let errorMsg = 'Error verificando código';
    if (error.message === '2FA_REQUIRED') {
      return NextResponse.json(
        { error: '2FA_REQUIRED', message: 'Se requiere contraseña de verificación en dos pasos' },
        { status: 200 }
      );
    } else if (error.message?.includes('PHONE_CODE_INVALID')) {
      errorMsg = 'Código inválido';
    } else if (error.message?.includes('PHONE_CODE_EXPIRED')) {
      errorMsg = 'Código expirado. Solicita uno nuevo.';
    } else if (error.message?.includes('PASSWORD_HASH_INVALID')) {
      errorMsg = 'Contraseña 2FA incorrecta';
    }

    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}

/**
 * DELETE: Cerrar sesión de Telegram
 */
export async function DELETE(request) {
  try {
    const { isAdmin, userId } = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Desconectar cliente
    await disconnect();

    // Desactivar sesión en BD
    const supabase = getSupabaseAdmin();
    await supabase
      .from('telegram_session')
      .update({ is_active: false })
      .eq('user_id', userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cerrando sesión Telegram:', error);
    return NextResponse.json(
      { error: 'Error cerrando sesión' },
      { status: 500 }
    );
  }
}
