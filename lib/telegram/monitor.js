/**
 * Sistema de monitorización de mensajes en grupos de Telegram
 * Detecta keywords y crea alertas
 */

import { NewMessage } from 'telegram/events/index.js';
import { getCurrentClient, isConnected } from './client.js';
import { createClient } from '@supabase/supabase-js';

// Keywords por defecto para detectar
const DEFAULT_KEYWORDS = [
  // Marca directa
  'vence',

  // Competencia
  'opositatest',
  'testoposiciones',

  // Búsquedas genéricas
  'test',
  'tests',
  'oposiciones',
  'auxiliar administrativo',
  'app para estudiar',
  'donde estudiar',
  'preparar oposicion',
];

// Estado del monitor
let isMonitoring = false;
let monitoredGroupIds = new Set();
let keywordsByGroup = new Map(); // groupId -> keywords[]

// Cliente de Supabase para guardar alertas
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Verifica si un mensaje contiene alguno de los keywords
 * @param {string} text - Texto del mensaje
 * @param {string[]} keywords - Lista de keywords a buscar
 * @returns {string[]} Keywords encontrados
 */
export function checkKeywords(text, keywords = DEFAULT_KEYWORDS) {
  if (!text) return [];

  const lowerText = text.toLowerCase();
  const matched = [];

  for (const keyword of keywords) {
    // Buscar palabra completa o como parte de una frase
    const lowerKeyword = keyword.toLowerCase();
    if (lowerText.includes(lowerKeyword)) {
      matched.push(keyword);
    }
  }

  return matched;
}

/**
 * Manejador de nuevos mensajes
 */
async function handleNewMessage(event) {
  try {
    const message = event.message;

    // Ignorar mensajes propios
    if (message.out) return;

    // Verificar que es de un grupo monitorizado
    const chatId = message.chatId?.toString();
    if (!chatId || !monitoredGroupIds.has(chatId)) return;

    // Obtener keywords para este grupo (o usar default)
    const keywords = keywordsByGroup.get(chatId) || DEFAULT_KEYWORDS;

    // Verificar keywords
    const matchedKeywords = checkKeywords(message.text, keywords);
    if (matchedKeywords.length === 0) return;

    // Obtener info del sender
    let senderName = 'Usuario';
    let senderUsername = null;
    let senderId = null;

    if (message.sender) {
      senderId = message.sender.id?.toString();
      senderName = message.sender.firstName || message.sender.title || 'Usuario';
      if (message.sender.lastName) {
        senderName += ' ' + message.sender.lastName;
      }
      senderUsername = message.sender.username || null;
    }

    // Guardar alerta en BD
    const supabase = getSupabase();

    const { error } = await supabase.from('telegram_alerts').insert({
      group_id: parseInt(chatId),
      message_id: parseInt(message.id.toString()),
      message_text: message.text?.substring(0, 4000) || '', // Limitar longitud
      sender_id: senderId ? parseInt(senderId) : null,
      sender_name: senderName,
      sender_username: senderUsername,
      matched_keywords: matchedKeywords,
      is_read: false,
      is_replied: false,
      detected_at: new Date().toISOString(),
    });

    if (error) {
      // Ignorar error de duplicado
      if (!error.message.includes('duplicate')) {
        console.error('Error guardando alerta:', error);
      }
    } else {
      console.log(`🔔 Nueva alerta en grupo ${chatId}: "${message.text?.substring(0, 50)}..." [${matchedKeywords.join(', ')}]`);
    }
  } catch (error) {
    console.error('Error procesando mensaje:', error);
  }
}

/**
 * Inicia la monitorización de grupos
 * @param {Array<{id: string, keywords?: string[]}>} groups - Grupos a monitorizar
 */
export async function startMonitoring(groups) {
  if (!isConnected()) {
    throw new Error('No hay conexión activa con Telegram');
  }

  const client = getCurrentClient();

  // Configurar grupos y keywords
  monitoredGroupIds.clear();
  keywordsByGroup.clear();

  for (const group of groups) {
    monitoredGroupIds.add(group.id.toString());
    if (group.keywords && group.keywords.length > 0) {
      keywordsByGroup.set(group.id.toString(), group.keywords);
    }
  }

  // Si ya estamos monitorizando, solo actualizar grupos
  if (isMonitoring) {
    console.log(`📡 Monitorización actualizada: ${groups.length} grupos`);
    return {
      success: true,
      groupCount: groups.length,
    };
  }

  // Añadir handler de nuevos mensajes
  client.addEventHandler(handleNewMessage, new NewMessage({}));

  isMonitoring = true;

  console.log(`📡 Monitorización iniciada: ${groups.length} grupos`);

  return {
    success: true,
    groupCount: groups.length,
  };
}

/**
 * Detiene la monitorización
 */
export async function stopMonitoring() {
  if (!isMonitoring) return { success: true };

  // Nota: gramjs no tiene un método fácil para remover handlers específicos
  // así que marcamos como no monitorizando y limpiamos los grupos
  isMonitoring = false;
  monitoredGroupIds.clear();
  keywordsByGroup.clear();

  console.log('📡 Monitorización detenida');

  return { success: true };
}

/**
 * Obtiene el estado actual de la monitorización
 */
export function getMonitoringStatus() {
  return {
    isMonitoring,
    groupCount: monitoredGroupIds.size,
    groupIds: Array.from(monitoredGroupIds),
  };
}

/**
 * Envía una respuesta a un mensaje específico
 * @param {string|number} groupId - ID del grupo
 * @param {number} messageId - ID del mensaje a responder
 * @param {string} text - Texto de la respuesta
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function replyToMessage(groupId, messageId, text) {
  if (!isConnected()) {
    throw new Error('No hay conexión activa con Telegram');
  }

  const client = getCurrentClient();

  try {
    // Obtener entidad del grupo
    const entity = await client.getEntity(BigInt(groupId));

    // Enviar mensaje como respuesta
    await client.sendMessage(entity, {
      message: text,
      replyTo: messageId,
    });

    // Marcar la alerta como respondida en BD
    const supabase = getSupabase();
    await supabase
      .from('telegram_alerts')
      .update({
        is_replied: true,
        reply_text: text,
        replied_at: new Date().toISOString(),
      })
      .eq('group_id', parseInt(groupId))
      .eq('message_id', messageId);

    return { success: true };
  } catch (error) {
    console.error('Error enviando respuesta:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Envía un mensaje nuevo a un grupo (sin responder a otro)
 * @param {string|number} groupId - ID del grupo
 * @param {string} text - Texto del mensaje
 * @returns {Promise<{success: boolean, messageId?: number, error?: string}>}
 */
export async function sendMessage(groupId, text) {
  if (!isConnected()) {
    throw new Error('No hay conexión activa con Telegram');
  }

  const client = getCurrentClient();

  try {
    const entity = await client.getEntity(BigInt(groupId));
    const result = await client.sendMessage(entity, { message: text });

    return {
      success: true,
      messageId: result.id,
    };
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
