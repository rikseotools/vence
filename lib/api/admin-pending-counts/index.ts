// lib/api/admin-pending-counts/index.ts
export {
  pendingCountsResponseSchema,
  pendingCountsErrorSchema,
  type PendingCountsResponse,
  type PendingCountsError,
} from './schemas'

export { getPendingDisputeCounts } from './queries'
