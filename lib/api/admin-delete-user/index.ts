// lib/api/admin-delete-user/index.ts

export {
  deleteUserRequestSchema,
  deleteUserResponseSchema,
  deleteUserErrorSchema,
  deleteUserPendingSchema,
  archivedUserDataSchema,
  type DeleteUserRequest,
  type DeleteUserResponse,
  type DeleteUserError,
  type DeleteUserPending,
  type DeletionResult,
  type ArchivedUserData
} from './schemas'

export {
  deleteUserData,
  ensureDeletionLogRow,
  markDeletionCompleted,
  buildDeletionReason,
  archiveUserLegalData,
  persistArchivedData,
  type DeletionLogProfile
} from './queries'

export {
  sendDeletionConfirmationEmail,
  type SendDeletionEmailParams,
  type SendDeletionEmailResult
} from './email'
