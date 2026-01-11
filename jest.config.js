// jest.config.js
export default {
  testEnvironment: 'jsdom', // Cambiado para soportar React Testing Library
  testMatch: ['**/__tests__/**/*.test.js'],
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
    // Umbrales específicos para funciones críticas
    './hooks/useTopicUnlock.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 75
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