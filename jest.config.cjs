module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testTimeout: 30000,
  // 2026-08: was `maxWorkers: 2` with `detectOpenHandles: true` — the latter
  // forced jest to run the ENTIRE suite in-band (single process, zero workers;
  // jest skips worker spawning entirely when detectOpenHandles is set), so this
  // number was silently ignored and every full run was serial (~11.5 min, CI
  // and local). Workers now actually spawn; leak diagnosis, when needed, is a
  // targeted run with --detectOpenHandles on a subset.
  maxWorkers: '75%',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  setupFiles: ['<rootDir>/tests/setupJestGlobals.ts'],
  testMatch: ['**/src/**/*.test.ts', '**/src/**/*.test.tsx', '**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  // AI Hub が repo 直下に作る `worktrees/<timestamp>/` は stale な mirror で、
  // `**/src/**/*.test.ts` がそこも拾って偽 RED を出す（feedback 2026-08-27 §1）。
  // .gitignore でファイルとしては除外しているが jest 起動時の testMatch glob は
  // .gitignore を尊重しないので、ここで明示的に除外する。
  //
  // ⚠️ `<rootDir>/worktrees/` と **rootDir 相対で** 書く事。裸の `/worktrees/` は
  // パス中の任意位置に一致する為、repo 自体が `…/worktrees/<ts>/` 配下に
  // checkout されている場合（ai-hub の自律ループは常にこの形）に *自分自身の*
  // test path も除外し、`--listTests` が 0 件になってスイート全体が沈黙する
  // （CI は /home/runner/work/… なので気付けない = self-disabling guard）。
  // 契約は tests/guards/jest-worktree-isolation.test.ts が pin する。
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/worktrees/'],
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
