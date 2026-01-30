// lib/api/laws-configurator/index.ts - Exports del módulo

export {
  lawDataSchema,
  getAllLawsResponseSchema,
  errorResponseSchema,
  type LawData,
  type GetAllLawsResponse,
  type ErrorResponse
} from './schemas'

export {
  getAllLawsWithStats
} from './queries'
