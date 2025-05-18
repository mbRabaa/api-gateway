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
  coverageReporters: ['text', 'lcov', 'text-summary', 'cobertura'],
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '.',
        outputName: 'junit.xml',
        suiteName: 'Jest Tests',
        classNameTemplate: '{classname}-{title}',
        titleTemplate: '{title}',
        ancestorSeparator: ' > ',
        includeConsoleOutput: true,
        outputFile: 'junit.xml'
      }
    ]
  ],
  testResultsProcessor: 'jest-junit'
};