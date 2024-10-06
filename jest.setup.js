// Suppress deprecation warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && args[0].includes('DeprecationWarning')) {
    return;
  }
  originalWarn.apply(console, args);
};

// Suppress other specific warnings if needed
// For example, to suppress punycode warnings:
const originalEmit = process.emitWarning;
process.emitWarning = (warning, type, ...args) => {
  if (type === 'DeprecationWarning' && warning.includes('punycode')) {
    return;
  }
  originalEmit.apply(process, [warning, type, ...args]);
};