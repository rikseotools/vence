// lib/api/admin-email-events/index.ts
export {
  emailEventsQuerySchema,
  emailEventSchema,
  emailEventsResponseSchema,
  type EmailEventsQuery,
  type EmailEvent,
  type EmailEventsResponse,
} from './schemas'

export { getEmailEvents } from './queries'
