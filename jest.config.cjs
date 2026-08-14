module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testTimeout: 30000,
  maxWorkers: 2,
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  setupFiles: ['<rootDir>/tests/setupJestGlobals.ts'],
  testMatch: ['**/src/**/*.test.ts', '**/src/**/*.test.tsx', '**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^#supabase/(.*)$': '<rootDir>/supabase/$1',
    '^https://deno.land/std@0.168.0/http/server.ts$': '<rootDir>/tests/__mocks__/deno-server.ts',
    '^https://esm.sh/@supabase/supabase-js@2$': '<rootDir>/tests/__mocks__/deno-server.ts',
    '^(.*)/workers/worker-factories$': '<rootDir>/tests/__mocks__/worker-factories.ts',
    '^@dagrejs/dagre$': '<rootDir>/tests/__mocks__/dagre.ts',
    // whisper-node chdirs the whole process at module load (shelljs `cd` in
    // src/shell.ts) — mapping it to an empty stub keeps that side effect out
    // of jest workers. See tests/__mocks__/whisper-node.ts for the full story.
    '^whisper-node$': '<rootDir>/tests/__mocks__/whisper-node.ts',
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
