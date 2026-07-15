// lib/api/admin-delete-user/index.ts

export {
  deleteUserRequestSchema,
  deleteUserResponseSchema,
  deleteUserErrorSchema,
  archivedUserDataSchema,
  type DeleteUserRequest,
  type DeleteUserResponse,
  type DeleteUserError,
  type DeletionResult,
  type ArchivedUserData
} from './schemas'

export {
  deleteUserData,
  ensureDeletionLogRow,
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
