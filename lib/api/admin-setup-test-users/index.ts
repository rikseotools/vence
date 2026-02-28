// lib/api/admin-setup-test-users/index.ts

export {
  setupTestUsersRequestSchema,
  setupTestUsersResponseSchema,
  setupTestUsersErrorSchema,
  type SetupTestUsersRequest,
  type SetupTestUsersResponse,
  type SetupTestUsersError,
  type TestUserResult
} from './schemas'

export {
  setupTestUsers
} from './queries'
