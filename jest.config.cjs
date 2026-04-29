module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/src/**/*.test.ts', '**/src/**/*.test.tsx', '**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^https://deno.land/std@0.168.0/http/server.ts$': '<rootDir>/tests/__mocks__/deno-server.ts',
    '^https://esm.sh/@supabase/supabase-js@2$': '<rootDir>/tests/__mocks__/deno-server.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|express|cors|helmet|express-rate-limit|supertest)/)',
  ],
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
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
};
