module.exports = {
  preset: '@babel/preset-env',
  testEnvironment: 'node',
  coverageDirectory: './coverage',
  collectCoverage: true,
  collectCoverageFrom: [
    'server.js',
    '**/*.js',
    '!**/node_modules/**'
  ],
  coverageReporters: ['text', 'lcov', 'cobertura'],
  reporters: [
    'default',
    [
      './node_modules/jest-junit',
      {
        outputDirectory: '.',
        outputName: 'junit.xml',
        includeConsoleOutput: true
      }
    ]
  ]
}