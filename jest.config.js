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
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.afterEnv.js'],
  collectCoverageFrom: [
    'hooks/**/*.js',
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
      branches: 5,
      functions: 5,
      lines: 5,
      statements: 5,
    },
    // TODO: Incrementar gradualmente a 50%+ cuando se añadan más tests
  },
  // Ignorar archivos que no necesitan testing
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/scripts/',
    'configDbIntegrity', // Requiere BD real, ejecutar con: npx jest configDbIntegrity
  ],
  // Timeout para tests async
  testTimeout: 10000,
  // Verbose para debugging
  verbose: true
};