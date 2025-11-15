// jest.config.js
export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFilesAfterEnv: [],
  collectCoverageFrom: [
    'lib/**/*.js',
    'utils/**/*.js',
    '!lib/supabase.js', // Excluir archivo de configuración
    '!**/*.config.js',
    '!**/node_modules/**'
  ]
};