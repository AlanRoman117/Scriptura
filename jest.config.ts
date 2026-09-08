import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/', '<rootDir>/tests/'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    // Subpath first — @scriptura/core/books must land on packages/core/src/books,
    // not packages/core/books/src. The subpaths exist so browser code can reach
    // the pure modules without the fs-importing barrel; see the exports maps.
    '^@scriptura/([^/]+)/(.*)$': '<rootDir>/packages/$1/src/$2',
    '^@scriptura/([^/]+)$': '<rootDir>/packages/$1/src',
    // The sources use NodeNext-style './loader.js' specifiers, which Jest will
    // not resolve to './loader.ts' on its own. Without this, importing any
    // runtime code from a test fails at resolution.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // ESM, matching what the packages ship. Requires `--experimental-vm-modules`,
  // which the `test` script passes; without it jest cannot load an ES module at
  // all. `.ts` is not ESM to jest by default however the package.json reads, so
  // it has to be named explicitly.
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json', useESM: true }],
  },
  // tests/contract/ belongs to Playwright — see playwright.config.ts. Jest must
  // not try to run those specs; they import @playwright/test, not jest globals.
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/tests/contract/', '/tests/reader/', '/apps/'],
  // Integration tests read real translations off disk on first touch.
  testTimeout: 30000,
};

export default config;
