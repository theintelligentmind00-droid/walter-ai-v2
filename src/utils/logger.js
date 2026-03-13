const fs = require('fs');
const path = require('path');
const config = require('./config');

const logDir = config.paths.logs;
const logFile = path.join(logDir, 'walter.log');

function ensureLogDir() {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

function writeToFile(line) {
  try {
    fs.appendFileSync(logFile, line + '\n');
  } catch (err) {
    // If file write fails, don't crash — just skip
    console.error('[LOGGER] Failed to write to log file:', err.message);
  }
}

function log(level, message) {
  ensureLogDir();
  const line = formatMessage(level, message);
  console.log(line);
  writeToFile(line);
}

const logger = {
  info: (message) => log('INFO', message),
  warn: (message) => log('WARN', message),
  error: (message) => log('ERROR', message),
  debug: (message) => log('DEBUG', message),
  tick: (message) => log('TICK', message),
};

module.exports = logger;
