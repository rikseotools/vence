import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Incluir solo el schema public
  schemaFilter: ['public'],
  // Verbose para ver el progreso
  verbose: true,
  // Strict mode
  strict: true,
})
