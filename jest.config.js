// jest.config.js
export default {
  testEnvironment: 'jsdom', // Cambiado para soportar React Testing Library
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { 
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ] 
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.afterEnv.js'],
  collectCoverageFrom: [
    'lib/**/*.js',
    'hooks/**/*.js',
    'components/**/*.js',
    'utils/**/*.js',
    '!lib/supabase.js',
    '!**/*.config.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/stories/**',
    '!**/.next/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    // Umbrales específicos para funciones críticas
    './hooks/useTopicUnlock.js': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85
    }
  },
  // Ignorar archivos que no necesitan testing
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/scripts/'
  ],
  // Timeout para tests async
  testTimeout: 10000,
  // Verbose para debugging
  verbose: true
};