// lib/api/admin-feedback/queries.ts - Queries tipadas para admin feedback usando Drizzle
import { getDb } from '@/db/client'
import { userFeedback, feedbackConversations, feedbackMessages, userProfiles } from '@/db/schema'
import { eq, desc, and, sql, inArray, isNull, ne } from 'drizzle-orm'
import type {
  AdminSendMessageRequest,
  UpdateFeedbackStatusRequest,
  CreateConversationRequest,
  MarkMessagesReadRequest,
  FeedbackWithDetails,
  ConversationWithMessages,
  MessageWithSender,
  UserProfile,
  FeedbackStats,
  AdminFeedbackResponse,
  PaginatedResponse,
  FilterType
} from './schemas'

// ============================================
// GET ALL FEEDBACKS WITH PAGINATION
// ============================================

export async function getAllFeedbacks(
  filter: FilterType = 'all',
  limit = 50,
  offset = 0
): Promise<PaginatedResponse<FeedbackWithDetails>> {
  try {
    const db = getDb()

    // Build where conditions based on filter
    let whereCondition = undefined
    if (filter !== 'all') {
      if (filter === 'in_progress') {
        whereCondition = eq(userFeedback.status, 'in_progress')
      } else {
        whereCondition = eq(userFeedback.status, filter)
      }
    }

    // Get feedbacks
    const feedbacks = await db
      .select({
        id: userFeedback.id,
        userId: userFeedback.userId,
        email: userFeedback.email,
        type: userFeedback.type,
        message: userFeedback.message,
        url: userFeedback.url,
        userAgent: userFeedback.userAgent,
        viewport: userFeedback.viewport,
        referrer: userFeedback.referrer,
        screenshotUrl: userFeedback.screenshotUrl,
        status: userFeedback.status,
        priority: userFeedback.priority,
        adminResponse: userFeedback.adminResponse,
        adminUserId: userFeedback.adminUserId,
        wantsResponse: userFeedback.wantsResponse,
        createdAt: userFeedback.createdAt,
        updatedAt: userFeedback.updatedAt,
        resolvedAt: userFeedback.resolvedAt,
        questionId: userFeedback.questionId,
      })
      .from(userFeedback)
      .where(whereCondition)
      .orderBy(desc(userFeedback.createdAt))
      .limit(limit)
      .offset(offset)

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFeedback)
      .where(whereCondition)

    const total = countResult[0]?.count || 0

    console.log('✅ [AdminFeedback] Loaded feedbacks:', {
      filter,
      count: feedbacks.length,
      total
    })

    return {
      success: true,
      data: feedbacks as FeedbackWithDetails[],
      total,
      offset,
      limit
    }
  } catch (error) {
    console.error('❌ [AdminFeedback] Error loading feedbacks:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error cargando feedbacks'
    }
  }
}

// ============================================
// GET CONVERSATIONS WITH MESSAGES
// ============================================

export async function getConversationsWithMessages(
  limit = 50,
  offset = 0
): Promise<PaginatedResponse<ConversationWithMessages>> {
  try {
    const db = getDb()

    // Get conversations
    const conversations = await db
      .select({
        id: feedbackConversations.id,
        feedbackId: feedbackConversations.feedbackId,
        userId: feedbackConversations.userId,
        adminUserId: feedbackConversations.adminUserId,
        status: feedbackConversations.status,
        lastMessageAt: feedbackConversations.lastMessageAt,
        createdAt: feedbackConversations.createdAt,
        adminViewedAt: feedbackConversations.adminViewedAt,
      })
      .from(feedbackConversations)
      .orderBy(desc(feedbackConversations.lastMessageAt))
      .limit(limit)
      .offset(offset)

    // Get messages for each conversation
    const conversationIds = conversations.map(c => c.id)

    let messagesMap = new Map<string, MessageWithSender[]>()

    if (conversationIds.length > 0) {
      const messages = await db
        .select({
          id: feedbackMessages.id,
          conversationId: feedbackMessages.conversationId,
          senderId: feedbackMessages.senderId,
          isAdmin: feedbackMessages.isAdmin,
          message: feedbackMessages.message,
          createdAt: feedbackMessages.createdAt,
          readAt: feedbackMessages.readAt,
          senderFullName: userProfiles.fullName,
          senderEmail: userProfiles.email,
        })
        .from(feedbackMessages)
        .leftJoin(userProfiles, eq(feedbackMessages.senderId, userProfiles.id))
        .where(inArray(feedbackMessages.conversationId, conversationIds))
        .orderBy(desc(feedbackMessages.createdAt))

      // Group messages by conversation
      for (const msg of messages) {
        const convId = msg.conversationId!
        if (!messagesMap.has(convId)) {
          messagesMap.set(convId, [])
        }
        messagesMap.get(convId)!.push({
          id: msg.id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          isAdmin: msg.isAdmin,
          message: msg.message,
          createdAt: msg.createdAt,
          readAt: msg.readAt,
          sender: msg.senderFullName || msg.senderEmail ? {
            fullName: msg.senderFullName,
            email: msg.senderEmail
          } : null
        })
      }
    }

    // Get feedbacks for conversations
    const feedbackIds = conversations.map(c => c.feedbackId).filter((id): id is string => id !== null)
    let feedbacksMap = new Map<string, FeedbackWithDetails>()

    if (feedbackIds.length > 0) {
      const feedbacks = await db
        .select({
          id: userFeedback.id,
          userId: userFeedback.userId,
          email: userFeedback.email,
          type: userFeedback.type,
          message: userFeedback.message,
          url: userFeedback.url,
          userAgent: userFeedback.userAgent,
          viewport: userFeedback.viewport,
          referrer: userFeedback.referrer,
          screenshotUrl: userFeedback.screenshotUrl,
          status: userFeedback.status,
          priority: userFeedback.priority,
          adminResponse: userFeedback.adminResponse,
          adminUserId: userFeedback.adminUserId,
          wantsResponse: userFeedback.wantsResponse,
          createdAt: userFeedback.createdAt,
          updatedAt: userFeedback.updatedAt,
          resolvedAt: userFeedback.resolvedAt,
          questionId: userFeedback.questionId,
        })
        .from(userFeedback)
        .where(inArray(userFeedback.id, feedbackIds))

      for (const fb of feedbacks) {
        feedbacksMap.set(fb.id, fb as FeedbackWithDetails)
      }
    }

    // Combine all data
    const result: ConversationWithMessages[] = conversations.map(conv => ({
      ...conv,
      messages: messagesMap.get(conv.id) || [],
      feedback: conv.feedbackId ? feedbacksMap.get(conv.feedbackId) || null : null
    }))

    console.log('✅ [AdminFeedback] Loaded conversations:', {
      count: result.length
    })

    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('❌ [AdminFeedback] Error loading conversations:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error cargando conversaciones'
    }
  }
}

// ============================================
// GET FEEDBACK STATS
// ============================================

export async function getFeedbackStats(): Promise<AdminFeedbackResponse<FeedbackStats>> {
  try {
    const db = getDb()

    const stats = await db
      .select({
        status: userFeedback.status,
        count: sql<number>`count(*)::int`
      })
      .from(userFeedback)
      .groupBy(userFeedback.status)

    const result: FeedbackStats = {
      total: 0,
      pending: 0,
      inProgress: 0,
      resolved: 0,
      dismissed: 0
    }

    for (const row of stats) {
      result.total += row.count
      if (row.status === 'pending') result.pending = row.count
      else if (row.status === 'in_progress' || row.status === 'in_review') result.inProgress += row.count
      else if (row.status === 'resolved' || row.status === 'closed') result.resolved += row.count
      else if (row.status === 'dismissed') result.dismissed = row.count
    }

    console.log('✅ [AdminFeedback] Stats:', result)

    return {
      success: true,
      stats: result
    }
  } catch (error) {
    console.error('❌ [AdminFeedback] Error getting stats:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error obteniendo estadísticas'
    }
  }
}

// ============================================
// GET USER PROFILES FOR FEEDBACKS
// ============================================

export async function getUserProfiles(userIds: string[]): Promise<AdminFeedbackResponse<UserProfile[]>> {
  try {
    if (userIds.length === 0) {
      return { success: true, data: [] }
    }

    const db = getDb()

    const profiles = await db
      .select({
        id: userProfiles.id,
        email: userProfiles.email,
        fullName: userProfiles.fullName,
        nickname: userProfiles.nickname,
        planType: userProfiles.planType,
        targetOposicion: userProfiles.targetOposicion,
        registrationDate: userProfiles.registrationDate,
        createdAt: userProfiles.createdAt,
        ciudad: userProfiles.ciudad,
        isActiveStudent: userProfiles.isActiveStudent,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.id, userIds))

    return {
      success: true,
      data: profiles as UserProfile[]
    }
  } catch (error) {
    console.error('❌ [AdminFeedback] Error getting user profiles:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error obteniendo perfiles'
    }
  }
}

// ============================================
// ADMIN SEND MESSAGE
// ============================================

export async function adminSendMessage(
  params: AdminSendMessageRequest
): Promise<AdminFeedbackResponse<MessageWithSender>> {
  try {
    const db = getDb()

    // Verify conversation exists
    const convResult = await db
      .select({ id: feedbackConversations.id })
      .from(feedbackConversations)
      .where(eq(feedbackConversations.id, params.conversationId))
      .limit(1)

    if (convResult.length === 0) {
      return {
        success: false,
        error: 'Conversación no encontrada'
      }
    }

    // Insert message
    const [newMessage] = await db
      .insert(feedbackMessages)
      .values({
        conversationId: params.conversationId,
        senderId: params.adminUserId,
        message: params.message.trim(),
        isAdmin: true
      })
      .returning({
        id: feedbackMessages.id,
        conversationId: feedbackMessages.conversationId,
        senderId: feedbackMessages.senderId,
        isAdmin: feedbackMessages.isAdmin,
        message: feedbackMessages.message,
        createdAt: feedbackMessages.createdAt,
        readAt: feedbackMessages.readAt,
      })

    // Update conversation status to waiting_user
    await db
      .update(feedbackConversations)
      .set({
        status: 'waiting_user',
        lastMessageAt: new Date().toISOString(),
        adminUserId: params.adminUserId,
        adminViewedAt: new Date().toISOString()
      })
      .where(eq(feedbackConversations.id, params.conversationId))

    console.log('✅ [AdminFeedback] Admin message sent:', {
      messageId: newMessage.id,
      conversationId: params.conversationId
    })

    return {
      success: true,
      data: {
        ...newMessage,
        sender: null
      }
    }
  } catch (error) {
    console.error('❌ [AdminFeedback] Error sending admin message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error enviando mensaje'
    }
  }
}

// ============================================
// UPDATE FEEDBACK STATUS
// ============================================

export async function updateFeedbackStatus(
  params: UpdateFeedbackStatusRequest
): Promise<AdminFeedbackResponse<FeedbackWithDetails>> {
  try {
    const db = getDb()

    const updateData: Record<string, unknown> = {
      status: params.status,
      adminUserId: params.adminUserId,
      updatedAt: new Date().toISOString()
    }

    if (params.adminResponse) {
      updateData.adminResponse = params.adminResponse
    }

    if (params.status === 'resolved' || params.status === 'dismissed') {
      updateData.resolvedAt = new Date().toISOString()
    }

    const [updated] = await db
      .update(userFeedback)
      .set(updateData)
      .where(eq(userFeedback.id, params.feedbackId))
      .returning({
        id: userFeedback.id,
        userId: userFeedback.userId,
        email: userFeedback.email,
        type: userFeedback.type,
        message: userFeedback.message,
        url: userFeedback.url,
        userAgent: userFeedback.userAgent,
        viewport: userFeedback.viewport,
        referrer: userFeedback.referrer,
        screenshotUrl: userFeedback.screenshotUrl,
        status: userFeedback.status,
        priority: userFeedback.priority,
        adminResponse: userFeedback.adminResponse,
        adminUserId: userFeedback.adminUserId,
        wantsResponse: userFeedback.wantsResponse,
        createdAt: userFeedback.createdAt,
        updatedAt: userFeedback.updatedAt,
        resolvedAt: userFeedback.resolvedAt,
        questionId: userFeedback.questionId,
      })

    if (!updated) {
      return {
        success: false,
        error: 'Feedback no encontrado'
      }
    }

    // Also update conversation status if feedback is resolved/dismissed
    if (params.status === 'resolved' || params.status === 'dismissed') {
      await db
        .update(feedbackConversations)
        .set({
          status: params.status,
          adminUserId: params.adminUserId
        })
        .where(eq(feedbackConversations.feedbackId, params.feedbackId))
    }

    console.log('✅ [AdminFeedback] Status updated:', {
      feedbackId: params.feedbackId,
      newStatus: params.status
    })

    return {
      success: true,
      data: updated as FeedbackWithDetails
    }
  } catch (error) {
    console.error('❌ [AdminFeedback] Error updating status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error actualizando estado'
    }
  }
}

// ============================================
// CREATE CONVERSATION FOR FEEDBACK
// ============================================

export async function createConversation(
  params: CreateConversationRequest
): Promise<AdminFeedbackResponse<ConversationWithMessages>> {
  try {
    const db = getDb()

    // Get feedback to get userId
    const feedbackResult = await db
      .select({ userId: userFeedback.userId })
      .from(userFeedback)
      .where(eq(userFeedback.id, params.feedbackId))
      .limit(1)

    if (feedbackResult.length === 0) {
      return {
        success: false,
        error: 'Feedback no encontrado'
      }
    }

    // Check if conversation already exists
    const existingConv = await db
      .select({ id: feedbackConversations.id })
      .from(feedbackConversations)
      .where(eq(feedbackConversations.feedbackId, params.feedbackId))
      .limit(1)

    if (existingConv.length > 0) {
      return {
        success: false,
        error: 'Ya existe una conversación para este feedback'
      }
    }

    // Create conversation
    const [newConv] = await db
      .insert(feedbackConversations)
      .values({
        feedbackId: params.feedbackId,
        userId: feedbackResult[0].userId,
        adminUserId: params.adminUserId,
        status: 'open'
      })
      .returning({
        id: feedbackConversations.id,
        feedbackId: feedbackConversations.feedbackId,
        userId: feedbackConversations.userId,
        adminUserId: feedbackConversations.adminUserId,
        status: feedbackConversations.status,
        lastMessageAt: feedbackConversations.lastMessageAt,
        createdAt: feedbackConversations.createdAt,
        adminViewedAt: feedbackConversations.adminViewedAt,
      })

    console.log('✅ [AdminFeedback] Conversation created:', {
      conversationId: newConv.id,
      feedbackId: params.feedbackId
    })

    return {
      success: true,
      data: {
        ...newConv,
        messages: [],
        feedback: null
      }
    }
  } catch (error) {
    console.error('❌ [AdminFeedback] Error creating conversation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error creando conversación'
    }
  }
}

// ============================================
// MARK MESSAGES AS READ
// ============================================

export async function markMessagesAsRead(
  params: MarkMessagesReadRequest
): Promise<AdminFeedbackResponse<{ updatedCount: number }>> {
  try {
    const db = getDb()

    // Update all unread messages from non-admin users
    const result = await db
      .update(feedbackMessages)
      .set({
        readAt: new Date().toISOString()
      })
      .where(
        and(
          eq(feedbackMessages.conversationId, params.conversationId),
          eq(feedbackMessages.isAdmin, false),
          isNull(feedbackMessages.readAt)
        )
      )
      .returning({ id: feedbackMessages.id })

    // Update conversation adminViewedAt
    await db
      .update(feedbackConversations)
      .set({
        adminViewedAt: new Date().toISOString()
      })
      .where(eq(feedbackConversations.id, params.conversationId))

    console.log('✅ [AdminFeedback] Messages marked as read:', {
      conversationId: params.conversationId,
      count: result.length
    })

    return {
      success: true,
      data: { updatedCount: result.length }
    }
  } catch (error) {
    console.error('❌ [AdminFeedback] Error marking messages as read:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error marcando mensajes como leídos'
    }
  }
}

// ============================================
// GET PENDING COUNTS (For notifications)
// ============================================

export async function getPendingCounts(): Promise<AdminFeedbackResponse<{
  pendingFeedbacks: number
  waitingAdmin: number
  unreadMessages: number
}>> {
  try {
    const db = getDb()

    // Pending feedbacks
    const pendingResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFeedback)
      .where(eq(userFeedback.status, 'pending'))

    // Conversations waiting for admin
    const waitingResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedbackConversations)
      .where(eq(feedbackConversations.status, 'waiting_admin'))

    // Unread messages from users
    const unreadResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedbackMessages)
      .where(
        and(
          eq(feedbackMessages.isAdmin, false),
          isNull(feedbackMessages.readAt)
        )
      )

    return {
      success: true,
      data: {
        pendingFeedbacks: pendingResult[0]?.count || 0,
        waitingAdmin: waitingResult[0]?.count || 0,
        unreadMessages: unreadResult[0]?.count || 0
      }
    }
  } catch (error) {
    console.error('❌ [AdminFeedback] Error getting pending counts:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error obteniendo contadores'
    }
  }
}
