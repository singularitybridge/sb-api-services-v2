// Suppress deprecation warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && (args[0].includes('DeprecationWarning') || args[0].includes('trace-deprecation'))) {
    return;
  }
  originalWarn.apply(console, args);
};

// Suppress other specific warnings if needed
const originalEmit = process.emitWarning;
process.emitWarning = (warning, type, ...args) => {
  if (type === 'DeprecationWarning' || (typeof warning === 'string' && warning.includes('trace-deprecation'))) {
    return;
  }
  originalEmit.apply(process, [warning, type, ...args]);
};

// Suppress console.error during tests
const originalError = console.error;
console.error = (...args) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  originalError.apply(console, args);
};

// Mock OpenAI for tests
jest.mock('openai', () => {
  const OpenAIMock = jest.fn().mockImplementation(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      })
    },
    // Add any other methods you need to mock here
  }));
  return OpenAIMock;
});

// Set a dummy OPENAI_API_KEY for tests
process.env.OPENAI_API_KEY = 'dummy-api-key-for-tests';