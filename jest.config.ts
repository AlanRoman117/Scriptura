import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/', '<rootDir>/tests/'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@scriptura/(.*)$': '<rootDir>/packages/$1/src',
    // The sources use NodeNext-style './loader.js' specifiers, which Jest will
    // not resolve to './loader.ts' on its own. Without this, importing any
    // runtime code from a test fails at resolution.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  // tests/contract/ belongs to Playwright — see playwright.config.ts. Jest must
  // not try to run those specs; they import @playwright/test, not jest globals.
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/tests/contract/'],
  // Integration tests read real translations off disk on first touch.
  testTimeout: 30000,
};

export default config;
