/**
 * Cliente de Telegram usando gramjs (MTProto)
 * Permite autenticación con cuenta personal y operaciones de monitorización
 */

import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import CryptoJS from 'crypto-js';

// Configuración de Telegram API
const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION_SECRET = process.env.TELEGRAM_SESSION_SECRET || 'default-secret-key';

// Cliente singleton para reutilizar conexión
let clientInstance = null;
let currentSessionString = '';

// Almacenamiento temporal de phoneCodeHash (entre peticiones)
const pendingAuth = new Map();

/**
 * Encripta la sesión de Telegram para almacenar en BD
 */
export function encryptSession(sessionString) {
  return CryptoJS.AES.encrypt(sessionString, SESSION_SECRET).toString();
}

/**
 * Desencripta la sesión de Telegram desde BD
 */
export function decryptSession(encryptedSession) {
  const bytes = CryptoJS.AES.decrypt(encryptedSession, SESSION_SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Obtiene o crea una instancia del cliente de Telegram
 */
export async function getClient(sessionString = '') {
  // Validar configuración
  if (!API_ID || !API_HASH) {
    throw new Error('TELEGRAM_API_ID y TELEGRAM_API_HASH son requeridos');
  }

  // Si hay un cliente conectado con la misma sesión, reutilizar
  if (clientInstance && clientInstance.connected && currentSessionString === sessionString) {
    return clientInstance;
  }

  // Si hay un cliente diferente, desconectar primero
  if (clientInstance && clientInstance.connected) {
    try {
      await clientInstance.disconnect();
    } catch (e) {
      // Ignorar errores de desconexión
    }
  }

  const session = new StringSession(sessionString);

  clientInstance = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: false, // TCP es más estable
  });

  currentSessionString = sessionString;

  await clientInstance.connect();

  return clientInstance;
}

/**
 * Envía código de verificación al teléfono
 */
export async function sendCode(phoneNumber) {
  const client = await getClient('');

  const result = await client.sendCode(
    { apiId: API_ID, apiHash: API_HASH },
    phoneNumber
  );

  // Guardar phoneCodeHash para esta sesión
  pendingAuth.set(phoneNumber, {
    phoneCodeHash: result.phoneCodeHash,
    timestamp: Date.now(),
  });

  // Limpiar entradas antiguas (> 10 min)
  for (const [key, value] of pendingAuth) {
    if (Date.now() - value.timestamp > 10 * 60 * 1000) {
      pendingAuth.delete(key);
    }
  }

  return {
    phoneCodeHash: result.phoneCodeHash,
  };
}

/**
 * Obtiene el phoneCodeHash guardado para un número
 */
export function getPhoneCodeHash(phoneNumber) {
  const pending = pendingAuth.get(phoneNumber);
  return pending?.phoneCodeHash || null;
}

/**
 * Completa el login con el código recibido
 */
export async function signIn(phoneNumber, phoneCode, phoneCodeHash, password = null) {
  const client = await getClient('');

  try {
    // Usar la API directamente
    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phoneNumber,
        phoneCodeHash: phoneCodeHash,
        phoneCode: phoneCode,
      })
    );

    const sessionString = client.session.save();
    const user = result.user;

    // Limpiar pending auth
    pendingAuth.delete(phoneNumber);

    return {
      sessionString,
      user: {
        id: user.id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        phone: user.phone,
      },
    };
  } catch (error) {
    // Si requiere 2FA
    if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      if (!password) {
        throw new Error('2FA_REQUIRED');
      }

      // Obtener la contraseña necesaria
      const passwordInfo = await client.invoke(new Api.account.GetPassword());

      // Calcular el hash de la contraseña
      const passwordHash = await client.computeSrpCheck(passwordInfo, password);

      const result = await client.invoke(
        new Api.auth.CheckPassword({
          password: passwordHash,
        })
      );

      const sessionString = client.session.save();
      const user = result.user;

      pendingAuth.delete(phoneNumber);

      return {
        sessionString,
        user: {
          id: user.id.toString(),
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          phone: user.phone,
        },
      };
    }
    throw error;
  }
}

/**
 * Conecta usando una sesión existente
 */
export async function connectWithSession(encryptedSession) {
  try {
    const sessionString = decryptSession(encryptedSession);
    const client = await getClient(sessionString);

    // Verificar que la sesión es válida
    const me = await client.getMe();

    return {
      connected: true,
      user: {
        id: me.id.toString(),
        firstName: me.firstName,
        lastName: me.lastName,
        username: me.username,
        phone: me.phone,
      },
    };
  } catch (error) {
    console.error('Error conectando con sesión:', error.message);
    return {
      connected: false,
      user: null,
      error: error.message,
    };
  }
}

/**
 * Desconecta el cliente actual
 */
export async function disconnect() {
  if (clientInstance) {
    try {
      await clientInstance.disconnect();
    } catch (e) {
      // Ignorar
    }
    clientInstance = null;
    currentSessionString = '';
  }
}

/**
 * Verifica si hay una conexión activa
 */
export function isConnected() {
  return clientInstance?.connected || false;
}

/**
 * Obtiene el cliente actual (debe estar conectado)
 */
export function getCurrentClient() {
  if (!clientInstance || !clientInstance.connected) {
    throw new Error('No hay conexión activa con Telegram');
  }
  return clientInstance;
}
