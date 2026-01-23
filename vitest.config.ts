import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],

  test: {
    root: './',
    passWithNoTests: true,
    environment: 'node',
    include: ['**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*', '**/.h3ravel/**'],
    }
  }
})


// /** @type {import('ts-jest').JestConfigWithTsJest} */
// module.exports = {
//   preset: 'ts-jest',
//   testEnvironment: 'node',
//   testMatch: ['**/__tests__/**/*.test.ts'],
//   collectCoverage: true,
//   coverageDirectory: 'coverage',
//   rootDir: '.',
//   moduleNameMapper: {
//     '^src/(.*)$': '<rootDir>/src/$1',
//   },
//   collectCoverageFrom: [
//     'src/**/*.ts',
//     '!src/**/*.d.ts',
//     '!src/index.ts',
//     '!src/database/seed.ts',
//   ],
//   coverageReporters: ['text', 'lcov'],
//   modulePaths: ['<rootDir>'],
//   // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
// };
