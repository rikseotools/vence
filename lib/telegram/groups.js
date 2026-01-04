/**
 * Gestión de grupos de Telegram
 * Listar, buscar y unirse a grupos
 */

import { Api } from 'telegram';
import { getCurrentClient } from './client.js';

/**
 * Obtiene todos los grupos/canales donde está el usuario
 * @returns {Promise<Array>} Lista de grupos
 */
export async function getMyGroups() {
  const client = getCurrentClient();

  const dialogs = await client.getDialogs({
    limit: 100,
  });

  const groups = dialogs
    .filter((dialog) => {
      // Filtrar solo grupos y supergrupos (no canales de broadcast ni chats privados)
      return dialog.isGroup || (dialog.isChannel && !dialog.entity?.broadcast);
    })
    .map((dialog) => ({
      id: dialog.id.toString(),
      title: dialog.title,
      username: dialog.entity?.username || null,
      memberCount: dialog.entity?.participantsCount || 0,
      isChannel: dialog.isChannel,
      isGroup: dialog.isGroup,
      // Acceso a info adicional si está disponible
      photo: dialog.entity?.photo ? true : false,
    }));

  return groups;
}

/**
 * Busca grupos públicos por keyword
 * @param {string} query - Término de búsqueda
 * @param {number} limit - Máximo de resultados
 * @returns {Promise<Array>} Lista de grupos encontrados
 */
export async function searchGroups(query, limit = 20) {
  const client = getCurrentClient();

  try {
    const result = await client.invoke(
      new Api.contacts.Search({
        q: query,
        limit,
      })
    );

    const groups = [];

    // Procesar chats encontrados
    for (const chat of result.chats) {
      // Solo grupos y supergrupos públicos (con username)
      if (chat.username && (chat.className === 'Channel' || chat.className === 'Chat')) {
        // Saltar canales de broadcast
        if (chat.broadcast) continue;

        groups.push({
          id: chat.id.toString(),
          title: chat.title,
          username: chat.username,
          memberCount: chat.participantsCount || 0,
          isVerified: chat.verified || false,
          about: chat.about || '',
        });
      }
    }

    return groups;
  } catch (error) {
    console.error('Error buscando grupos:', error.message);
    return [];
  }
}

/**
 * Obtiene información detallada de un grupo
 * @param {string|number} groupId - ID o username del grupo
 * @returns {Promise<object|null>}
 */
export async function getGroupInfo(groupId) {
  const client = getCurrentClient();

  try {
    // Si es un username, resolver primero
    let entity;
    if (typeof groupId === 'string' && groupId.startsWith('@')) {
      entity = await client.getEntity(groupId);
    } else {
      entity = await client.getEntity(BigInt(groupId));
    }

    return {
      id: entity.id.toString(),
      title: entity.title,
      username: entity.username || null,
      memberCount: entity.participantsCount || 0,
      about: entity.about || '',
      isChannel: entity.className === 'Channel',
      photo: entity.photo ? true : false,
    };
  } catch (error) {
    console.error('Error obteniendo info del grupo:', error.message);
    return null;
  }
}

/**
 * Une al usuario a un grupo público
 * @param {string} username - Username del grupo (@grupo o grupo)
 * @returns {Promise<{success: boolean, group: object|null, error: string|null}>}
 */
export async function joinGroup(username) {
  const client = getCurrentClient();

  try {
    // Normalizar username
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

    const result = await client.invoke(
      new Api.channels.JoinChannel({
        channel: cleanUsername,
      })
    );

    // Obtener info del grupo después de unirse
    const group = await getGroupInfo(`@${cleanUsername}`);

    return {
      success: true,
      group,
      error: null,
    };
  } catch (error) {
    console.error('Error uniéndose al grupo:', error.message);

    let errorMsg = 'Error desconocido';
    if (error.errorMessage === 'CHANNELS_TOO_MUCH') {
      errorMsg = 'Has alcanzado el límite de grupos';
    } else if (error.errorMessage === 'INVITE_HASH_INVALID') {
      errorMsg = 'Enlace de invitación inválido';
    } else if (error.errorMessage === 'CHANNEL_PRIVATE') {
      errorMsg = 'Este grupo es privado';
    }

    return {
      success: false,
      group: null,
      error: errorMsg,
    };
  }
}

/**
 * Sale de un grupo
 * @param {string|number} groupId - ID del grupo
 * @returns {Promise<boolean>}
 */
export async function leaveGroup(groupId) {
  const client = getCurrentClient();

  try {
    const entity = await client.getEntity(BigInt(groupId));

    await client.invoke(
      new Api.channels.LeaveChannel({
        channel: entity,
      })
    );

    return true;
  } catch (error) {
    console.error('Error saliendo del grupo:', error.message);
    return false;
  }
}

/**
 * Busca mensajes en un grupo por keyword
 * @param {string|number} groupId - ID del grupo
 * @param {string} query - Término de búsqueda
 * @param {number} limit - Máximo de resultados
 * @returns {Promise<Array>} Lista de mensajes encontrados
 */
export async function searchMessages(groupId, query, limit = 50) {
  const client = getCurrentClient();

  try {
    const entity = await client.getEntity(BigInt(groupId));

    const result = await client.invoke(
      new Api.messages.Search({
        peer: entity,
        q: query,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate: 0,
        maxDate: 0,
        offsetId: 0,
        addOffset: 0,
        limit,
        maxId: 0,
        minId: 0,
        hash: BigInt(0),
      })
    );

    const messages = [];

    for (const message of result.messages) {
      if (!message.message) continue; // Skip messages without text

      // Find sender info
      let senderName = 'Desconocido';
      let senderUsername = null;

      if (message.fromId) {
        const senderId = message.fromId.userId || message.fromId.channelId;
        // Try to find user in result.users or result.chats
        const user = result.users?.find((u) => u.id.toString() === senderId?.toString());
        const chat = result.chats?.find((c) => c.id.toString() === senderId?.toString());

        if (user) {
          senderName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Usuario';
          senderUsername = user.username || null;
        } else if (chat) {
          senderName = chat.title || 'Canal';
          senderUsername = chat.username || null;
        }
      }

      messages.push({
        id: message.id,
        text: message.message,
        date: new Date(message.date * 1000).toISOString(),
        senderName,
        senderUsername,
        replyToMsgId: message.replyTo?.replyToMsgId || null,
      });
    }

    return messages;
  } catch (error) {
    console.error('Error buscando mensajes:', error.message);
    return [];
  }
}

/**
 * Obtiene mensajes recientes de un grupo (sin búsqueda)
 * @param {string|number} groupId - ID del grupo
 * @param {number} limit - Máximo de resultados
 * @returns {Promise<Array>} Lista de mensajes
 */
export async function getRecentMessages(groupId, limit = 50) {
  const client = getCurrentClient();

  try {
    const entity = await client.getEntity(BigInt(groupId));

    const messages = await client.getMessages(entity, {
      limit,
    });

    return messages
      .filter((msg) => msg.message) // Only messages with text
      .map((message) => ({
        id: message.id,
        text: message.message,
        date: new Date(message.date * 1000).toISOString(),
        senderName: message.sender
          ? [message.sender.firstName, message.sender.lastName].filter(Boolean).join(' ') ||
            message.sender.title ||
            'Usuario'
          : 'Desconocido',
        senderUsername: message.sender?.username || null,
        replyToMsgId: message.replyTo?.replyToMsgId || null,
      }));
  } catch (error) {
    console.error('Error obteniendo mensajes recientes:', error.message);
    return [];
  }
}
