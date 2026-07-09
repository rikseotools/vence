// jest.config.js
export default {
  testEnvironment: 'jsdom', // Cambiado para soportar React Testing Library
  testMatch: ['**/__tests__/**/*.test.{js,ts,tsx}'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript'
      ]
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // `server-only` es un guard de build; no-op en tests (permite importar
    // fetchers/queries de servidor como oráculos de paridad).
    '^server-only$': '<rootDir>/__mocks__/server-only.js',
    // Mock de módulos ESM que Jest no puede importar
    '^react-markdown$': '<rootDir>/__mocks__/react-markdown.js',
    '^@supabase/realtime-js$': '<rootDir>/__mocks__/@supabase/realtime-js.js',
    '^@upstash/redis$': '<rootDir>/__mocks__/@upstash/redis.js',
  },
  // jose v6 es ESM puro (sin build CJS) → dejar que babel-jest lo transforme
  // en vez de tratarlo como CJS. Necesario para verifyJwtRs256/mintAccessToken.
  // jose + cadena ESM de next-auth v5 (Auth.js) — sin esto, cualquier test cuyo
  // grafo de imports llegue a lib/auth/client.ts → authjsAdapter → next-auth/react
  // peta con "Cannot use import statement outside a module" (Fase B, adapter dormido).
  transformIgnorePatterns: ['/node_modules/(?!(jose|next-auth|@auth/core|oauth4webapi|preact|preact-render-to-string|@panva/hkdf)/)'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.afterEnv.js'],
  collectCoverageFrom: [
    'hooks/**/*.{js,ts}',
    '!lib/supabase.js',
    '!**/*.config.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/stories/**',
    '!**/.next/**',
    '!components/ChatInterface.js'
  ],
  coverageThreshold: {
    global: {
      branches: 3,
      functions: 3,
      lines: 3,
      statements: 3,
    },
    // TODO: Incrementar gradualmente a 50%+ cuando se añadan más tests de hooks
  },
  // Ignorar archivos que no necesitan testing
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/scripts/',
  ],
  // Timeout para tests async
  testTimeout: 10000,
  // Verbose para debugging
  verbose: true
};