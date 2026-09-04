import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/', '<rootDir>/tests/'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@scriptura/(.*)$': '<rootDir>/packages/$1/src',
  },
};

export default config;
