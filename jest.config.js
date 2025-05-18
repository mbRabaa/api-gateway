module.exports = {
  testEnvironment: 'node',
  coverageDirectory: './coverage',
  collectCoverage: true,
  collectCoverageFrom: [
    'server.js',
    '**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  coverageReporters: ['text', 'lcov', 'cobertura'],
  reporters: [
    'default',
    [
      './node_modules/jest-junit',
      {
        outputDirectory: '.',
        outputName: 'junit.xml',
        suiteName: 'Jest Tests',
        includeConsoleOutput: true,
        outputFile: 'junit.xml'
      }
    ]
  ],
  testResultsProcessor: 'jest-junit'
}