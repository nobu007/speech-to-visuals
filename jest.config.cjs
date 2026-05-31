module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testTimeout: 30000,
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  setupFiles: ['<rootDir>/tests/setupJestGlobals.ts'],
  testMatch: ['**/src/**/*.test.ts', '**/src/**/*.test.tsx', '**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^#supabase/(.*)$': '<rootDir>/supabase/$1',
    '^https://deno.land/std@0.168.0/http/server.ts$': '<rootDir>/tests/__mocks__/deno-server.ts',
    '^https://esm.sh/@supabase/supabase-js@2$': '<rootDir>/tests/__mocks__/deno-server.ts',
    '^(.*)/workers/worker-factories$': '<rootDir>/tests/__mocks__/worker-factories.ts',
    '^@dagrejs/dagre$': '<rootDir>/tests/__mocks__/dagre.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|express|cors|helmet|express-rate-limit|supertest)/)',
  ],
  detectOpenHandles: true,
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.test.json',
      },
    ],
    '^.+\\.js$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};
